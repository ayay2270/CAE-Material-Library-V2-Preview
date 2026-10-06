import type { SourceFile, SourceFileKind } from '../types';

/* Source documents (Excel / PDF / other) are stored as references only: a display name plus a link or path.
   This module has no runtime imports so it can be unit-tested directly with `node --test`. */

export const SOURCE_KINDS: { id: SourceFileKind; label: string; short: string }[] = [
  { id: 'excel', label: 'Excel', short: 'XLS' },
  { id: 'pdf', label: 'PDF', short: 'PDF' },
  { id: 'other', label: '其他', short: 'FILE' },
];
const KIND_IDS: string[] = SOURCE_KINDS.map((k) => k.id);

export const MAX_SOURCE_FILES = 20;
export const MAX_NAME = 200;
export const MAX_URL = 2048;

export function newFileId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Guess the file type from a file name or link; null when the extension is not recognised. */
export function guessKind(text: string): SourceFileKind | null {
  const clean = text.trim().split(/[?#]/)[0].toLowerCase();
  if (/\.(xlsx|xlsm|xlsb|xls|csv)$/.test(clean)) return 'excel';
  if (/\.pdf$/.test(clean)) return 'pdf';
  return null;
}

/** The href to open, only for http(s) links. Every other value (UNC / drive paths, file:, javascript:, data:…) is plain text. */
export function webHref(url: string): string | null {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Last path segment of a link or path, used as the display name when none was typed. */
export function deriveName(url: string): string {
  const u = url.trim();
  if (!u) return '';
  const href = webHref(u);
  let path = u;
  if (href) path = new URL(href).pathname;
  const last = path.split(/[\\/]/).filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

type Draft = { id?: string; kind?: string; name?: string; url?: string };

/** Trim, drop empty rows, fix unknown kinds, derive missing names, cap lengths and always return fresh, valid entries. */
export function normalizeSourceFiles(list: readonly Draft[]): SourceFile[] {
  const out: SourceFile[] = [];
  for (const raw of list) {
    const url = (raw.url ?? '').trim().slice(0, MAX_URL);
    let name = (raw.name ?? '').trim().slice(0, MAX_NAME);
    if (!url && !name) continue;
    if (!name) name = deriveName(url).slice(0, MAX_NAME);
    const kind = (KIND_IDS.includes(raw.kind ?? '') ? raw.kind : guessKind(name) ?? guessKind(url) ?? 'other') as SourceFileKind;
    out.push({ id: raw.id || newFileId(), kind, name, url });
    if (out.length >= MAX_SOURCE_FILES) break;
  }
  return out;
}

/** Stable text used to compare two lists (ids ignored) for the change history. */
export function sourceFilesSignature(list: readonly SourceFile[] | undefined): string {
  return JSON.stringify((list ?? []).map(({ kind, name, url }) => [kind, name, url]));
}

/** CSV cell content: ids are left out so the backup stays portable. */
export function sourceFilesToJson(list: readonly SourceFile[] | undefined): string {
  return list && list.length ? JSON.stringify(list.map(({ kind, name, url }) => ({ kind, name, url }))) : '';
}

/** Strict parse of the CSV cell: null when it is not a JSON array of {kind, name, url} objects. */
export function parseSourceFilesJson(raw: string): SourceFile[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length > MAX_SOURCE_FILES) return null;
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const d = item as Record<string, unknown>;
    if (typeof d.kind !== 'string' || !KIND_IDS.includes(d.kind)) return null;
    if (typeof d.name !== 'string' || typeof d.url !== 'string') return null;
    if (d.name.length > MAX_NAME || d.url.length > MAX_URL) return null;
  }
  return normalizeSourceFiles(value as Draft[]);
}
