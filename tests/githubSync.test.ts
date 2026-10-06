import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../src/lib/database-schema.mjs';
import { readRemoteDatabase, compareRemote, SYNC_LABELS, contentHash, readDeploymentMatch, boundedChecks, SYNC_DELAYS } from '../src/lib/githubSync';

const master = JSON.parse(await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8'));
const commit = 'a'.repeat(40);
const remote = (database = master) => ({ database, canonical: canonicalJson(database), commit, checkedAt: Date.now() });
test('canonical equality/hash covers all data and preserves array/curve order', async () => {
  const reordered = { indexes: master.indexes, materials: master.materials, schemaVersion: 1 };
  assert.equal(compareRemote(master, remote(reordered)), 'synced');
  assert.equal(SYNC_LABELS[compareRemote(master, remote())], '已同步至 GitHub');
  assert.equal(await contentHash(master), createHash('sha256').update(canonicalJson(master)).digest('hex'));
  const changed = structuredClone(master); changed.materials[0].notes += 'changed';
  assert.equal(compareRemote(changed, remote()), 'pending');
  assert.equal(SYNC_LABELS[compareRemote(changed, remote())], '尚未同步');
  const independent = structuredClone(master); independent.materials[1].notes = 'independent';
  assert.equal(compareRemote(changed, remote(independent), canonicalJson(master)), 'changed');
  assert.notEqual(await contentHash(changed), await contentHash(master));
  const order = structuredClone(master); order.materials.reverse(); assert.equal(compareRemote(master, remote(order)), 'pending');
});
test('remote checks use uncached read-only public API and pin file content to a validated main commit', async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const fetcher = async (url: any, options: any) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ sha: commit }) : new Response(JSON.stringify(master));
  };
  const value = await readRemoteDatabase(undefined, fetcher as typeof fetch);
  assert.equal(value.commit, commit); assert.deepEqual(value.database, master);
  assert.match(calls[0].url, /commits\/main\?check=\d+/);
  assert.match(calls[1].url, new RegExp(`contents/src/data/materials.json\\?ref=${commit}`));
  assert.equal(calls[1].options.headers?.['Accept' as keyof HeadersInit], 'application/vnd.github.raw+json');
  for (const call of calls) {
    assert.equal(call.options.cache, 'no-store'); assert.equal(call.options.credentials, 'omit');
    assert.equal(call.options.method, undefined); assert.equal(JSON.stringify(call.options.headers).includes('Authorization'), false);
  }
});
test('network/API/rate-limit/malformed responses fail instead of creating a false synchronization success', async () => {
  for (const status of [403, 429, 500]) await assert.rejects(readRemoteDatabase(undefined, (async () => new Response('', { status })) as typeof fetch), /[\u3400-\u9fff]/);
  await assert.rejects(readRemoteDatabase(undefined, (async () => { throw new Error('network'); }) as typeof fetch));
  await assert.rejects(readRemoteDatabase(undefined, (async () => Response.json({ sha: '../bad' })) as typeof fetch), /回應格式無效/);
  let calls = 0;
  await assert.rejects(readRemoteDatabase(undefined, (async () => ++calls === 1 ? Response.json({ sha: commit }) : new Response('{broken')) as typeof fetch), /JSON 格式無效/);
});
test('Pages status verifies the deployed canonical database hash; missing or stale metadata cannot claim updated', async () => {
  const metadata = { schemaVersion: 1, databaseSha256: await contentHash(master) };
  assert.equal(await readDeploymentMatch(master, '/base/', undefined, (async url => { assert.match(String(url), /\/base\/database-version.json\?check=/); return Response.json(metadata); }) as typeof fetch), true);
  assert.equal(await readDeploymentMatch(master, '/base/', undefined, (async () => Response.json({ ...metadata, databaseSha256: '0'.repeat(64) })) as typeof fetch), false);
  await assert.rejects(readDeploymentMatch(master, '/base/', undefined, (async () => new Response('', { status: 404 })) as typeof fetch));
  await assert.rejects(readDeploymentMatch(master, '/base/', undefined, (async () => Response.json({})) as typeof fetch));
});
test('automatic synchronization checks are bounded, sequential and stop immediately on success/error/cancel', async () => {
  assert.deepEqual([...SYNC_DELAYS], [0, 15000, 45000, 105000]);
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let calls = 0;
  boundedChecks(async () => { calls++; return false; }, [0, 5, 10]); await wait(50); assert.equal(calls, 3);
  calls = 0; boundedChecks(async () => { calls++; return true; }, [0, 5, 10]); await wait(35); assert.equal(calls, 1);
  calls = 0; boundedChecks(async () => { calls++; throw new Error('rate limit'); }, [0, 5, 10]); await wait(35); assert.equal(calls, 1);
  calls = 0; const cancel = boundedChecks(async () => { calls++; return false; }, [10, 15]); cancel(); await wait(30); assert.equal(calls, 0);
});
