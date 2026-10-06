import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SOURCE_FILES, deriveName, guessKind, normalizeSourceFiles, parseSourceFilesJson, sourceFilesSignature, sourceFilesToJson, webHref,
} from '../src/lib/sourceFiles.ts';

test('file type follows the extension of the name or link', () => {
  assert.equal(guessKind('EPE.xlsx'), 'excel');
  assert.equal(guessKind('data.XLS'), 'excel');
  assert.equal(guessKind('table.csv'), 'excel');
  assert.equal(guessKind('https://x.example/report.pdf?download=1#p2'), 'pdf');
  assert.equal(guessKind('\\\\srv\\share\\Report.PDF'), 'pdf');
  assert.equal(guessKind('notes.docx'), null);
  assert.equal(guessKind(''), null);
});

test('only http(s) links become clickable; every other value stays text', () => {
  assert.equal(webHref('https://contoso.sharepoint.com/a b.pdf'), 'https://contoso.sharepoint.com/a%20b.pdf');
  assert.equal(webHref('  http://intranet/x.xlsx '), 'http://intranet/x.xlsx');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///C:/x.pdf', '\\\\server\\share\\x.xlsx', 'C:\\data\\x.xlsx', 'ftp://h/x', 'www.example.com', '', 'https://']) {
    assert.equal(webHref(bad), null, bad);
  }
});

test('display name is derived from the link when none is typed', () => {
  assert.equal(deriveName('https://h.example/dir/EPE%2096%20report.pdf?x=1'), 'EPE 96 report.pdf');
  assert.equal(deriveName('\\\\srv\\materials\\EPE\\96kg.xlsx'), '96kg.xlsx');
  assert.equal(deriveName('C:/Data/Bromake.xlsx'), 'Bromake.xlsx');
  assert.equal(deriveName(''), '');
});

test('normalising trims, drops empty rows, derives names/kinds and keeps ids', () => {
  const out = normalizeSourceFiles([
    { id: 'keep', kind: 'pdf', name: '  Report  ', url: ' https://h/x.pdf ' },
    { kind: 'other', name: '', url: '' },
    { kind: 'bogus', name: '', url: 'https://h/files/data.xlsx' },
    { name: 'No link but named' },
  ]);
  assert.deepEqual(out.map(({ id, ...rest }) => (id ? rest : null)), [
    { kind: 'pdf', name: 'Report', url: 'https://h/x.pdf' },
    { kind: 'excel', name: 'data.xlsx', url: 'https://h/files/data.xlsx' },
    { kind: 'other', name: 'No link but named', url: '' },
  ]);
  assert.equal(out[0].id, 'keep');
  assert.ok(out[1].id && out[2].id && out[1].id !== out[2].id);
});

test('lengths and the number of entries are capped', () => {
  const many = Array.from({ length: MAX_SOURCE_FILES + 5 }, (_, i) => ({ kind: 'other', name: `f${i}`, url: '' }));
  assert.equal(normalizeSourceFiles(many).length, MAX_SOURCE_FILES);
  const [long] = normalizeSourceFiles([{ name: 'n'.repeat(500), url: 'u'.repeat(5000) }]);
  assert.equal(long.name.length, 200);
  assert.equal(long.url.length, 2048);
});

test('CSV cell round-trips without ids and rejects malformed content', () => {
  const list = normalizeSourceFiles([{ kind: 'excel', name: 'A,"quoted".xlsx', url: '\\\\srv\\a.xlsx' }, { kind: 'pdf', name: 'B', url: 'https://h/b.pdf' }]);
  const cell = sourceFilesToJson(list);
  assert.ok(!cell.includes('"id"'));
  const back = parseSourceFilesJson(cell);
  assert.equal(sourceFilesSignature(back), sourceFilesSignature(list));
  assert.equal(sourceFilesToJson(undefined), '');
  assert.equal(sourceFilesToJson([]), '');
  for (const bad of ['not json', '{}', '[1]', '[{"kind":"zip","name":"x","url":""}]', '[{"kind":"pdf","name":1,"url":""}]', '[{"kind":"pdf","name":"x"}]', JSON.stringify(Array(MAX_SOURCE_FILES + 1).fill({ kind: 'pdf', name: 'x', url: '' }))]) {
    assert.equal(parseSourceFilesJson(bad), null, bad);
  }
});

test('signature ignores ids and treats missing as empty', () => {
  const a = [{ id: '1', kind: 'pdf', name: 'x', url: 'u' }];
  const b = [{ id: '2', kind: 'pdf', name: 'x', url: 'u' }];
  assert.equal(sourceFilesSignature(a), sourceFilesSignature(b));
  assert.equal(sourceFilesSignature(undefined), sourceFilesSignature([]));
  assert.notEqual(sourceFilesSignature(a), sourceFilesSignature([]));
});
