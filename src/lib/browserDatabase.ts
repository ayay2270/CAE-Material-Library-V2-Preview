import { canonicalJson, validateDatabase, type MasterDatabase } from './database-schema.mjs';

// Only a user-selected external file handle is used. No directory enumeration or OPFS database.
export interface DatabaseFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  createWritable(options?: { mode: 'exclusive' }): Promise<{
    write(contents: string): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
}
export interface FileSession {
  handle: DatabaseFileHandle;
  database: MasterDatabase;
  canonical: string;
  text: string;
  backupText?: string;
}
type PickerWindow = {
  isSecureContext: boolean;
  showOpenFilePicker?: (options: unknown) => Promise<DatabaseFileHandle[]>;
};
export const UNSUPPORTED_MESSAGE = '此瀏覽器不支援直接編輯本機資料庫。建議使用最新版 Google Chrome 或 Microsoft Edge。';
export function supportsFileDatabase(scope: PickerWindow | undefined = typeof window === 'undefined' ? undefined : window as unknown as PickerWindow): boolean {
  return !!scope?.isSecureContext && typeof scope.showOpenFilePicker === 'function';
}
export function pickDatabaseFile(): Promise<DatabaseFileHandle[]> {
  const scope = window as unknown as PickerWindow;
  if (!supportsFileDatabase(scope)) return Promise.reject(new Error(UNSUPPORTED_MESSAGE));
  // Invoke immediately from the click, before any asynchronous validation/storage work.
  return scope.showOpenFilePicker!({ multiple: false, excludeAcceptAllOption: true,
    id: 'cae-material-database', types: [{ description: '材料資料庫 JSON', accept: { 'application/json': ['.json'] } }] });
}
export function databaseErrorChinese(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '本機資料庫權限不足或已撤銷，請按「重新授權」。';
    if (error.name === 'NotFoundError') return '找不到已連結的檔案，請重新選取本機 materials.json。';
    if (error.name === 'NoModificationAllowedError') return '檔案正在由其他視窗或程式使用，請稍後再儲存。';
    if (/Duplicate material ID/.test(error.message)) return '材料 ID 重複，未通過資料庫驗證。';
    if (/schemaVersion/.test(error.message)) return '資料庫版本無效，目前只支援 schemaVersion 1。';
    if (/empty or missing material/.test(error.message)) return '材料資料庫不可為空，請至少保留一筆材料。';
    if (/curve/.test(error.message)) return '應力–應變曲線格式無效，請檢查資料點與曲線定義。';
    if (/index|category|source/i.test(error.message) && !/[\u3400-\u9fff]/.test(error.message)) return '材料分類或 SOURCE 索引無效、不完整或重複。';
    if (/[\u3400-\u9fff]/.test(error.message)) return error.message;
  }
  return '資料庫讀取或儲存失敗，請確認檔案格式、權限及可用磁碟空間。';
}
export function validateFileDatabase(value: unknown): MasterDatabase {
  try { return validateDatabase(value); }
  catch (error) { throw new Error(databaseErrorChinese(error)); }
}
export function parseFileDatabase(contents: string): MasterDatabase {
  let value: unknown;
  try { value = JSON.parse(contents); }
  catch { throw new Error('JSON 格式無效，未連結或寫入任何資料。'); }
  return validateFileDatabase(value);
}
export async function readDatabaseFile(handle: DatabaseFileHandle): Promise<FileSession> {
  if (handle.kind !== 'file' || handle.name !== 'materials.json') throw new Error('請選取本機 Git 儲存庫的 src/data/materials.json。');
  const text = await (await handle.getFile()).text();
  const database = parseFileDatabase(text);
  return { handle, text, database, canonical: canonicalJson(database) };
}
export async function authorizeDatabaseFile(handle: DatabaseFileHandle): Promise<boolean> {
  return await handle.requestPermission({ mode: 'readwrite' }) === 'granted';
}
export async function restoreDatabaseFile(handle: DatabaseFileHandle): Promise<FileSession | null> {
  // Restoring a handle never opens a permission prompt automatically.
  if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') return null;
  return readDatabaseFile(handle);
}
export function databaseIsDirty(draft: MasterDatabase, saved: MasterDatabase): boolean {
  return canonicalJson(draft) !== canonicalJson(saved);
}
export async function saveDatabaseFile(session: FileSession, snapshot: MasterDatabase): Promise<FileSession> {
  validateFileDatabase(snapshot);
  const serialized = JSON.stringify(snapshot, null, 2) + '\n';
  const expected = canonicalJson(parseFileDatabase(serialized));
  if (await session.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new DOMException('Permission revoked', 'NotAllowedError');
  const current = await readDatabaseFile(session.handle);
  if (current.canonical !== session.canonical) throw new Error('本機檔案已由其他程式更新，未覆寫。請匯出草稿，再重新讀取本機資料庫並確認差異。');
  session.backupText = current.text; // Memory only; available even after a failed write/verification.
  const writer = await session.handle.createWritable({ mode: 'exclusive' });
  let closed = false;
  try {
    // Check again after acquiring the browser writer lock.
    if ((await readDatabaseFile(session.handle)).canonical !== session.canonical) throw new Error('本機檔案在儲存前已變更，已取消寫入。');
    await writer.write(serialized);
    await writer.close();
    closed = true;
    const verified = await readDatabaseFile(session.handle);
    if (verified.canonical !== expected) throw new Error('寫入後的內容驗證不一致，不能確認儲存成功。請下載寫入前備份並檢查檔案。');
    return { ...verified, backupText: current.text };
  } catch (error) {
    if (!closed) try { await writer.abort(); } catch { /* closed/aborted streams need no further cleanup */ }
    // Never overwrite unexpected post-write content: it might be another program's update.
    throw error;
  }
}
