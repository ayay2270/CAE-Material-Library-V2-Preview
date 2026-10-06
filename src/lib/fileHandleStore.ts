import type { DatabaseFileHandle } from './browserDatabase';

const DATABASE = 'cae-material-library:file-handles:v1';
const STORE = 'handles';
const KEY = 'master-materials';
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('此瀏覽器無法記住檔案連結，下次需重新選取。'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openStore();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('此瀏覽器無法記住檔案連結，下次需重新選取。'));
    });
  } finally { database.close(); }
}
export async function getRememberedHandle(): Promise<DatabaseFileHandle | undefined> {
  return transaction('readonly', store => store.get(KEY));
}
export async function rememberHandle(handle: DatabaseFileHandle): Promise<void> {
  await transaction('readwrite', store => store.put(handle, KEY));
}
export async function forgetHandle(): Promise<void> {
  await transaction('readwrite', store => store.delete(KEY));
}
