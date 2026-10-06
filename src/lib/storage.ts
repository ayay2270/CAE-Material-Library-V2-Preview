import { useEffect, useMemo, useRef, useState } from 'react';
import { committedDatabase, LOCAL_EDITOR, readLocalDatabase, writeLocalDatabase } from './masterDatabase';
import { canonicalJson, validateDatabase } from './database-schema.mjs';
import { detectLegacy, recoverLegacy, RECOVERY_KEY, type LegacyRecovery } from './legacy';
import { PROPS } from './props';
import { formatValue } from './format';
import type { HistoryEntry, Material, MaterialInput, StressStrainData } from '../types';
import { isStressStrainData } from './curveData';
import { changeIndex, deriveIndexes, type IndexKind } from './indexes';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
const NO_CHANGES = '無欄位變更';
/** Human-readable diff of two records for the history log. */
function describeChanges(before: Material, after: MaterialInput): string {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`名稱: ${before.name} → ${after.name}`);
  if (before.category !== after.category) changes.push(`Category: ${before.category} → ${after.category}`);
  for (const p of PROPS) {
    if (before[p.key] !== after[p.key])
      changes.push(`${p.label}: ${formatValue(p.key, before[p.key])} → ${formatValue(p.key, after[p.key])}`);
  }
  if (before.source !== after.source) changes.push('Source');
  if (before.notes !== after.notes) changes.push('備註');
  if (after.stressStrainCurve !== undefined && JSON.stringify(before.stressStrainCurve ?? null) !== JSON.stringify(after.stressStrainCurve)) changes.push('Stress–strain curve');
  return changes.length ? changes.join('; ') : NO_CHANGES;
}

export function useMaterials() {
  const [initial] = useState(committedDatabase);
  const [draft, setDraft] = useState(initial);
  const latest = useRef(draft);
  latest.current = draft;
  const [saved, setSaved] = useState(initial);
  const [ready, setReady] = useState(!LOCAL_EDITOR);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const connection = useRef({ revision: '', token: '' });
  const [legacy, setLegacy] = useState<LegacyRecovery | null>(null);
  const indexes = useMemo(() => deriveIndexes(draft.materials, draft.indexes), [draft]);
  const editable = LOCAL_EDITOR && ready;
  const dirty = canonicalJson({ ...draft, indexes }) !== canonicalJson(saved);
  const setMaterials = (update: Material[] | ((list: Material[]) => Material[])) => {
    const materials = typeof update === 'function' ? update(latest.current.materials) : update;
    // Keep previously-used, now unused categories/sources rather than losing zero-count entries.
    latest.current = { ...latest.current, materials, indexes: deriveIndexes(materials, deriveIndexes(latest.current.materials, latest.current.indexes)) };
    setDraft(latest.current);
  };
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const master = LOCAL_EDITOR ? await readLocalDatabase() : { database: initial, revision: '', token: '' };
        if (cancelled) return;
        connection.current = master;
        latest.current = master.database;
        setDraft(master.database); setSaved(master.database); setReady(true);
        try { setLegacy(detectLegacy(localStorage, master.database)); } catch { /* blocked browser storage does not block the Git master */ }
      } catch (error) {
        if (!cancelled) setSaveError(error instanceof Error ? error.message : '本機資料庫讀取失敗。');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [initial]);
  useEffect(() => {
    if (!LOCAL_EDITOR || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const assertEditor = () => { if (!editable) throw new Error('資料庫尚未就緒，或目前為唯讀模式。'); };
  const saveDatabase = async () => {
    if (!editable || savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError(null);
    try {
      const snapshot = validateDatabase({ ...latest.current, indexes: deriveIndexes(latest.current.materials, latest.current.indexes) });
      connection.current.revision = await writeLocalDatabase(snapshot, connection.current.revision, connection.current.token);
      // An edit made while the request is in flight stays dirty; it was not in this snapshot.
      setSaved(snapshot);
    } catch (error) { setSaveError(error instanceof Error ? error.message : '儲存失敗，變更仍在記憶體中。'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const dismissLegacy = () => {
    if (legacy) try { localStorage.setItem(RECOVERY_KEY, legacy.fingerprint); } catch { /* never delete old data */ }
    setLegacy(null);
  };
  const importLegacy = () => {
    assertEditor();
    if (!legacy) return;
    latest.current = recoverLegacy(legacy); setDraft(latest.current); dismissLegacy();
  };
  const showLegacy = () => {
    try { setLegacy(detectLegacy(localStorage, saved, true)); } catch { setLegacy(null); }
  };
  const importDatabase = (value: unknown) => {
    assertEditor();
    latest.current = validateDatabase(value); setDraft(latest.current);
  };

  const add = (input: MaterialInput): Material => {
    assertEditor();
    const now = new Date().toISOString();
    const m: Material = { ...input, id: newId(), updatedAt: now, history: [{ at: now, action: 'created', summary: '建立記錄' }] };
    setMaterials(list => [...list, m]);
    return m;
  };
  const update = (id: string, input: MaterialInput) => {
    assertEditor();
    setMaterials(list => list.map(m => {
      if (m.id !== id) return m;
      const now = new Date().toISOString();
      const entry: HistoryEntry = { at: now, action: 'edited', summary: describeChanges(m, input) };
      return { ...m, ...input, updatedAt: now, history: [entry, ...m.history] };
    }));
  };
  const remove = (id: string) => { assertEditor(); setMaterials(list => list.filter(m => m.id !== id)); };
  const setCurve = (id: string, curve: StressStrainData): string | null => {
    if (!editable) return '目前為唯讀模式，請在本機編輯資料庫。';
    if (!isStressStrainData(curve)) return '曲線資料無效，未儲存。';
    const current = latest.current.materials;
    if (!current.some(m => m.id === id)) return '材料已不存在，未儲存。';
    const now = new Date().toISOString();
    setMaterials(current.map(m => m.id !== id ? m : {
      ...m, stressStrainCurve: curve, updatedAt: now,
      history: [{ at: now, action: 'edited' as const, summary: `Stress–strain curve：${curve.points.length} 個完整資料點` }, ...m.history],
    }));
    return null;
  };
  /** Original CSV name matching, history behavior and absent-curve preservation. */
  const importMany = (rows: MaterialInput[]) => {
    assertEditor();
    let added = 0, updated = 0, unchanged = 0;
    const next = [...latest.current.materials];
    const now = new Date().toISOString();
    for (const row of rows) {
      const idx = next.findIndex(m => m.name.toLowerCase() === row.name.toLowerCase());
      if (idx >= 0) {
        const m = next[idx];
        const diff = describeChanges(m, row);
        if (diff === NO_CHANGES) { unchanged++; continue; }
        next[idx] = { ...m, ...row, updatedAt: now, history: [{ at: now, action: 'imported', summary: `CSV 匯入 — ${diff}` }, ...m.history] };
        updated++;
      } else {
        next.push({ ...row, id: newId(), updatedAt: now, history: [{ at: now, action: 'imported', summary: '由 CSV 匯入建立' }] });
        added++;
      }
    }
    setMaterials(next);
    return { added, updated, unchanged };
  };
  const discardDraft = () => { assertEditor(); latest.current = saved; setDraft(saved); setSaveError(null); };
  const editIndex = (kind: IndexKind, id: string | null, name: string): string | null => {
    if (!editable) return '目前為唯讀模式，請在本機編輯資料庫。';
    const current = latest.current.materials;
    const result = changeIndex(deriveIndexes(current, latest.current.indexes), kind, id, name);
    if (!result.next) return result.error ?? '無法儲存索引。';
    const now = new Date().toISOString();
    const materials = kind === 'source' && id !== null && id !== name.trim()
      ? current.map(m => m.source !== id ? m : { ...m, source: name.trim(), updatedAt: now, history: [{ at: now, action: 'edited' as const, summary: `Source：${id} → ${name.trim()}（來源索引重新命名）` }, ...m.history] })
      : current;
    latest.current = { ...latest.current, materials, indexes: result.next }; setDraft(latest.current);
    return null;
  };
  return { materials: draft.materials, add, update, remove, importMany, discardDraft, setCurve, indexes, editIndex,
    editable, dirty, ready, saving, saveError, saveDatabase, legacy, dismissLegacy, importLegacy, showLegacy, importDatabase, database: draft };
}
