import committed from '../data/materials.json';
import { validateDatabase, type MasterDatabase } from './database-schema.mjs';
export const LOCAL_EDITOR = import.meta.env.DEV;
export function committedDatabase(): MasterDatabase {
  return validateDatabase(JSON.parse(JSON.stringify(committed)));
}
export async function readLocalDatabase() {
  if (!import.meta.env.DEV) throw new Error('GitHub Pages 是唯讀檢視器。');
  const response = await fetch(`${import.meta.env.BASE_URL}__database`, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? '無法讀取本機資料庫。');
  return { database: validateDatabase(body.database), revision: String(body.revision), token: String(body.token) };
}
export async function writeLocalDatabase(database: MasterDatabase, revision: string, token: string) {
  if (!import.meta.env.DEV) throw new Error('GitHub Pages 是唯讀檢視器。');
  validateDatabase(database);
  const response = await fetch(`${import.meta.env.BASE_URL}__database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Local-Database': token },
    body: JSON.stringify({ database, revision }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? '寫入失敗，請保留或匯出目前變更。');
  return String(body.revision);
}
