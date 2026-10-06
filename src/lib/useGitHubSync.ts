import { useEffect, useRef, useState } from 'react';
import { canonicalJson, type MasterDatabase } from './database-schema.mjs';
import { boundedChecks, compareRemote, readDeploymentMatch, readRemoteDatabase, type SyncState } from './githubSync';

export function useGitHubSync(saved: MasterDatabase, active: boolean, saveSequence: number) {
  const [status, setStatus] = useState<SyncState>('idle');
  const [resultKey, setResultKey] = useState('');
  const [commit, setCommit] = useState('');
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deployment, setDeployment] = useState<'idle' | 'waiting' | 'updated' | 'unknown'>('idle');
  const generation = useRef(0);
  const baseline = useRef<string>();
  const cancelPoll = useRef<() => void>();
  const abort = useRef<AbortController>();
  const manual = useRef<() => void>(() => {});
  const savedCanonical = canonicalJson(saved);
  const targetKey = `${saveSequence}:${savedCanonical}`;

  useEffect(() => {
    const version = ++generation.current;
    abort.current?.abort(); cancelPoll.current?.();
    if (!active) {
      baseline.current = undefined; setStatus('idle'); setCommit(''); setError(null); setDeployment('idle');
      return;
    }
    const snapshot = JSON.parse(savedCanonical) as MasterDatabase;
    const controller = new AbortController(); abort.current = controller;
    const current = () => generation.current === version && !controller.signal.aborted;
    const check = async () => {
      if (!current()) return true;
      setStatus('checking'); setError(null);
      try {
        const remote = await readRemoteDatabase(controller.signal);
        if (!current()) return true;
        const next = compareRemote(snapshot, remote, baseline.current);
        baseline.current ??= remote.canonical;
        setResultKey(targetKey);
        setStatus(next); setCommit(remote.commit); setCheckedAt(remote.checkedAt);
        if (next === 'synced') {
          setDeployment('waiting');
          const checkDeployment = async () => {
            try {
              const match = await readDeploymentMatch(snapshot, import.meta.env.BASE_URL, controller.signal);
              if (!current()) return true;
              setDeployment(match ? 'updated' : 'waiting'); return match;
            } catch { if (current()) setDeployment('unknown'); return true; }
          };
          cancelPoll.current = boundedChecks(checkDeployment, [0, 15000, 45000, 105000]);
          return true;
        }
        setDeployment('idle');
        return next === 'changed';
      } catch (cause) {
        if (current()) {
          setResultKey(targetKey);
          setStatus('error'); setError(cause instanceof Error && /[\u3400-\u9fff]/.test(cause.message) ? cause.message : 'GitHub 查詢失敗，請稍後重試。本機檔案仍已儲存。');
          setDeployment('unknown');
        }
        return true;
      }
    };
    manual.current = () => { cancelPoll.current?.(); void check(); };
    cancelPoll.current = boundedChecks(check, saveSequence > 0 ? undefined : [0]);
    return () => { controller.abort(); cancelPoll.current?.(); };
  }, [active, savedCanonical, saveSequence]);
  // A prior snapshot's successful check must never label a newly saved snapshot as synced.
  const relevant = active && resultKey === targetKey;
  return { status: !active ? 'idle' as const : relevant ? status : 'checking' as const,
    commit: relevant ? commit : '', checkedAt: relevant ? checkedAt : null, error: relevant ? error : null,
    deployment: relevant ? deployment : 'idle' as const, check: () => manual.current() };
}
