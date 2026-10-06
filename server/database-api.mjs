import { randomBytes } from 'node:crypto';
import { createDatabaseStore, DatabaseError } from './database-store.mjs';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const hostname = new Set(['localhost', '127.0.0.1', '[::1]']);

export function createDatabaseMiddleware(root, base = '/') {
  const store = createDatabaseStore(root);
  const token = randomBytes(32).toString('hex'); // Ephemeral local anti-CSRF token; never a GitHub credential.
  const endpoint = `${base}__database`;
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== endpoint) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const respond = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    try {
      const address = new URL(`http://${req.headers.host}`);
      if (!loopback.has(req.socket.remoteAddress) || !hostname.has(address.hostname)) throw new DatabaseError('Local connections only.', 403);
      if (req.headers.origin && req.headers.origin !== address.origin) throw new DatabaseError('Same-origin requests only.', 403);
      if (req.method === 'GET') return respond(200, { ...await store.read(), token });
      if (req.method !== 'POST') return respond(405, { error: 'Method not allowed.' });
      if (req.headers.origin !== address.origin || req.headers['x-local-database'] !== token)
        throw new DatabaseError('Local save authorization missing. Reload the editor.', 403);
      if (!req.headers['content-type']?.startsWith('application/json')) throw new DatabaseError('JSON required.', 415);
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32 * 1024 * 1024) throw new DatabaseError('Database request exceeds 32 MiB. Nothing was saved.', 413);
        chunks.push(chunk);
      }
      const { database, revision } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return respond(200, await store.save(database, revision));
    } catch (error) { respond(error.status ?? 400, { error: error.message || 'Database save failed. Nothing was saved.' }); }
  };
}

export function localDatabasePlugin() {
  let root, base;
  return {
    name: 'local-material-database',
    apply: 'serve',
    configResolved(config) { root = config.root; base = config.base; },
    configureServer(server) { server.middlewares.use(createDatabaseMiddleware(root, base)); },
    // Explicit Save handles the new revision. Do not let JSON HMR discard drafts.
    handleHotUpdate(context) {
      if (context.file.replaceAll('\\', '/').endsWith('/src/data/materials.json')) return [];
    },
  };
}
