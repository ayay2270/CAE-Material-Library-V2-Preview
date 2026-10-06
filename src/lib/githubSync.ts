import { canonicalJson, type MasterDatabase } from './database-schema.mjs';
import { parseFileDatabase } from './browserDatabase';

const REPO = 'https://api.github.com/repos/ayay2270/CAE-Material-Library-V2-Preview';
export const SYNC_DELAYS = [0, 15000, 45000, 105000] as const;
export type SyncState = 'idle' | 'checking' | 'pending' | 'synced' | 'changed' | 'error';
export const SYNC_LABELS: Record<SyncState, string> = {
  idle: '尚未檢查', checking: '檢查中', pending: '尚未同步', synced: '已同步至 GitHub', changed: '尚未同步', error: '檢查失敗',
};
export interface RemoteDatabase {
  database: MasterDatabase;
  canonical: string;
  commit: string;
  checkedAt: number;
}
export async function contentHash(database: MasterDatabase): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(database));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
async function responseOk(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(response.status === 403 || response.status === 429
    ? 'GitHub 暫時限制查詢次數，請稍後手動檢查。'
    : '目前無法讀取 GitHub 資料，請稍後重試。本機儲存不受影響。');
  return response;
}
export async function readRemoteDatabase(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<RemoteDatabase> {
  // Read a fresh main commit, then pin the content request to that immutable commit.
  // No raw/CDN latest-branch URL, credentials, authentication or write methods.
  const timeout = AbortSignal.timeout(15000);
  const options = { cache: 'no-store' as const, credentials: 'omit' as const, signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
  const headResponse = await responseOk(await fetcher(`${REPO}/commits/main?check=${Date.now()}`, { ...options, headers: { Accept: 'application/vnd.github+json' } }));
  const head = await headResponse.json();
  if (typeof head.sha !== 'string' || !/^[a-f0-9]{40}$/.test(head.sha)) throw new Error('GitHub 回應格式無效，尚未確認同步。');
  const response = await responseOk(await fetcher(`${REPO}/contents/src/data/materials.json?ref=${head.sha}`, {
    ...options, headers: { Accept: 'application/vnd.github.raw+json' },
  }));
  const database = parseFileDatabase(await response.text());
  return { database, canonical: canonicalJson(database), commit: head.sha, checkedAt: Date.now() };
}
export function compareRemote(saved: MasterDatabase, remote: RemoteDatabase, baseline?: string): SyncState {
  if (canonicalJson(saved) === remote.canonical) return 'synced';
  return baseline && baseline !== remote.canonical ? 'changed' : 'pending';
}
export async function readDeploymentMatch(saved: MasterDatabase, base: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<boolean> {
  const timeout = AbortSignal.timeout(12000);
  const response = await responseOk(await fetcher(`${base}database-version.json?check=${Date.now()}`, { cache: 'no-store', credentials: 'omit', signal: signal ? AbortSignal.any([signal, timeout]) : timeout }));
  const version = await response.json();
  if (version.schemaVersion !== 1 || typeof version.databaseSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(version.databaseSha256)) throw new Error('目前無法確認線上部署版本。');
  return await contentHash(saved) === version.databaseSha256;
}
/** Sequential, bounded polling. A positive result stops; cancel prevents stale results. */
export function boundedChecks(check: () => Promise<boolean>, delays: readonly number[] = SYNC_DELAYS) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let index = 0;
  const run = async () => {
    let done = false;
    try { done = await check(); } catch { done = true; } // Errors stop automatic traffic; manual retry remains.
    if (stopped || done || ++index >= delays.length) return;
    timer = setTimeout(() => void run(), delays[index] - delays[index - 1]);
  };
  timer = setTimeout(() => void run(), delays[0] ?? 0);
  return () => { stopped = true; clearTimeout(timer); };
}
