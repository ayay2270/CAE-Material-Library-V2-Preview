import type { Material } from '../types';
import { defaultIndexes, deriveIndexes, INDEX_KEY, type MaterialIndexes } from './indexes';
import { canonicalJson, validateDatabase, type MasterDatabase } from './database-schema.mjs';

export const LEGACY_MATERIAL_KEY = 'cae-material-library:v1';
export const RECOVERY_KEY = 'cae-material-library:legacy-recovery:v1';
type StorageReader = Pick<Storage, 'getItem'>;
export interface LegacyRecovery {
  fingerprint: string;
  raw: string;
  rawIndexes: string | null;
  database?: MasterDatabase;
  error?: string;
}

// The old keys are read only; detection never writes or deletes a material record.
export function detectLegacy(storage: StorageReader, master: MasterDatabase, includeDismissed = false): LegacyRecovery | null {
  let raw, rawIndexes;
  try { raw = storage.getItem(LEGACY_MATERIAL_KEY); rawIndexes = storage.getItem(INDEX_KEY); }
  catch { return null; }
  if (raw === null && rawIndexes === null) return null;
  const contents = JSON.stringify([raw, rawIndexes]);
  // A lightweight content signature records only which notice was acknowledged.
  let hash = 2166136261;
  for (let i = 0; i < contents.length; i++) hash = Math.imul(hash ^ contents.charCodeAt(i), 16777619);
  const fingerprint = `${contents.length}:${hash >>> 0}`;
  try { if (!includeDismissed && storage.getItem(RECOVERY_KEY) === fingerprint) return null; } catch { /* keep notice available */ }
  const result: LegacyRecovery = { fingerprint, raw: raw ?? '', rawIndexes };
  try {
    const materials = raw === null ? master.materials : JSON.parse(raw) as Material[];
    const indexes = rawIndexes === null ? defaultIndexes() : JSON.parse(rawIndexes) as MaterialIndexes;
    // Preserve unused custom indexes. Invalid catalogs are reported, not silently filtered.
    if (!Array.isArray(materials) || !indexes || !Array.isArray(indexes.categories) || !Array.isArray(indexes.sources)) throw new Error('旧資料格式不完整。');
    const database = validateDatabase({ schemaVersion: 1, materials, indexes: deriveIndexes(materials, indexes) });
    if (canonicalJson(database) === canonicalJson(master)) return null;
    return { ...result, database };
  } catch (error) { return { ...result, error: error instanceof Error ? error.message : '舊資料格式無效。' }; }
}

/** Recovery is an explicit full draft replacement, preserving IDs/history/extra fields. */
export function recoverLegacy(recovery: LegacyRecovery): MasterDatabase {
  if (!recovery.database) throw new Error(recovery.error ?? '舊資料無法直接匯入，請下載原始備份。');
  return validateDatabase(JSON.parse(JSON.stringify(recovery.database)));
}

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
