import { open, readFile, rename, mkdir, unlink, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateDatabase } from '../src/lib/database-schema.mjs';

export const revisionOf = (raw) => createHash('sha256').update(raw).digest('hex');
export class DatabaseError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function rejectSymlinks(path) {
  let current = resolve(path);
  while (true) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new DatabaseError('Database paths must not be symbolic links.', 403); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function atomicWrite(path, raw) {
  await rejectSymlinks(path);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(raw, 'utf8'); await file.sync(); } finally { await file.close(); }
    // Validate the bytes actually written before replacing the destination.
    validateDatabase(JSON.parse(await readFile(temporary, 'utf8')));
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}

export function createDatabaseStore(root) {
  const path = resolve(root, 'src/data/materials.json');
  const backup = resolve(root, 'data/backups/materials.backup.json');
  const lockPath = `${path}.lock`;
  let pending = Promise.resolve();
  const read = async () => {
    await rejectSymlinks(path);
    const raw = await readFile(path, 'utf8');
    return { database: validateDatabase(JSON.parse(raw)), revision: revisionOf(raw) };
  };
  const save = (database, expectedRevision) => {
    const operation = pending.then(async () => {
      validateDatabase(database);
      await rejectSymlinks(path);
      await rejectSymlinks(lockPath);
      let lock;
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw new DatabaseError('Another save is in progress. Retry after it completes. If a server crashed, stop all local editors before removing src/data/materials.json.lock.', 409);
        throw error;
      }
      try {
      const previous = await readFile(path, 'utf8');
      // Never overwrite a corrupt on-disk master or another editor's newer save.
      validateDatabase(JSON.parse(previous));
      if (expectedRevision !== revisionOf(previous))
        throw new DatabaseError('Database changed on disk. Export your draft, then reload before saving.', 409);
      const raw = JSON.stringify(database, null, 2) + '\n';
      await rejectSymlinks(backup);
      await mkdir(dirname(backup), { recursive: true });
      await atomicWrite(backup, previous);
      await atomicWrite(path, raw);
      return { revision: revisionOf(raw) };
      } finally { await lock.close(); await unlink(lockPath); }
    });
    pending = operation.catch(() => {});
    return operation;
  };
  return { path, backup, read, save };
}
