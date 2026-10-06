# Storage migration verification — 2026-10-06

## Architecture and integrity

Previous: 11 built-in records in `src/data/seed.ts`; browser-local material and index
keys were the editable master. Column preferences used a separate browser key.

Current: `src/data/materials.json` is the master database source for build/dev,
containing complete material records plus category/source catalogs in one document.
Local React drafts become file changes only after Save Database. Production is a
read-only static deployment snapshot. Existing engineering values/calculations and
layout are preserved; no design skill was used for this storage task.

Original 11 records, including IDs, numeric/null values, source, notes, timestamps and
histories, were compared with the original seed function using deep equality. The
current master still exactly matches that migrated baseline after all UI tests.

## Created files

- `src/data/materials.json`
- `src/lib/database-schema.mjs`, `src/lib/database-schema.d.mts`
- `src/lib/masterDatabase.ts`, `src/lib/legacy.ts`
- `server/database-api.mjs`, `server/database-store.mjs`
- `src/components/LegacyRecovery.tsx`, `src/database-status.css`
- `tests/database.test.ts`, `tests/production.check.ts`
- `tests/original-seed.ts`, `tests/migrated-database.json` (test-only original/migration fixtures)
- `docs/storage-architecture.md`, `docs/storage-verification.md`

## Modified / relocated files

- `.github/workflows/pages.yml`, `.gitignore`, `README.md`
- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`
- `src/App.tsx`, `src/main.tsx`
- `src/lib/storage.ts`, `src/lib/indexes.tsx`
- `src/components/Header.tsx`, `Sidebar.tsx`, `MaterialTable.tsx`, `MaterialDrawer.tsx`
- `src/components/StressStrainSection.tsx`, `src/components/Dialogs.tsx`
- Runtime `src/data/seed.ts` removed; original seed retained as test fixture above.

The original formatting/unit, curve parser/CSV, ETAN, Material Map and comparison
modules and existing stylesheet/layout files have no changes.

## Browser storage keys

| Key | Current use |
| --- | --- |
| `cae-material-library:columns:v1` | Local column order/visibility |
| `cae-material-library:legacy-recovery:v1` | Acknowledged legacy notice signature |
| `cae-material-library:v1` | Legacy recovery input only; never written/deleted |
| `cae-material-library:indexes:v1` | Legacy index recovery input only; never written/deleted |

Unit/view/filter preferences remain in memory as before. No authoritative material
or index data is written to browser storage.

## Save, recovery and production

Save Database submits the complete validated draft to a loopback-only Vite dev API.
It checks the loaded file revision, obtains an exclusive lock, writes one ignored
previous-version backup, validates flushed temporary JSON and atomically replaces
the master. Validation, conflict or backup failures preserve the master/draft.
The helper has no Git commands or GitHub credentials.

Legacy notices offer valid CSV and complete JSON export; corrupt data remains
downloadable as raw strings. Local recovery explicitly replaces a draft after
confirmation and still requires Save Database. Ignore records acknowledgement
only; the notice can be reopened. Pages recovery uses JSON download followed by
local import because browser origins differ.

Production hides Add/Edit/Delete, index/curve editing and CSV/JSON import. Details,
full curve viewing/export, browsing, comparison and Material Map remain available.
The production bundle has no local API client or filesystem writer. Vite preview
has no write middleware, and an HTTP POST cannot modify the repository master.

## Automated results

- `npm ci`: PASS (75 packages audited, 0 reported vulnerabilities).
- `npm test`: **14/14 PASS**. Includes current load, exact initial migration,
  local save/backup, duplicate/empty/corrupt/missing-field rejection, revisions,
  concurrent servers, failed backup, complete curves and additional solver metadata,
  categories/sources/history/zero-count indexes, legacy recovery, CSV→save and HTTP API.
- `npm run build`: **PASS**, TypeScript + Vite 6.4.3, 65 modules.
- `npm run test:production`: **1/1 PASS**, actual static preview + no write endpoint/code.
- `git diff --check`: PASS. There were no pre-existing test scripts/suites to omit.
- GitHub Pages base remains `/CAE-Material-Library-V2-Preview/`.
- Pages workflow now runs all tests and build before uploading only `dist/`.

## Exact clone / UI save scenario

An isolated implementation snapshot was created outside the requested repository,
then freshly cloned for verification. At the end of the original storage task,
the requested repository was left uncommitted/unpushed for the user's manual workflow.
The subsequent temporary-preview request publishes these changes only on
`preview/git-master-database`; main remains unchanged.

1. Fresh clone and `npm ci`: PASS.
2. `npm run dev`: PASS (QA localhost port 5441).
3. Add disposable material through the actual UI: Unsaved changes; disk still 11 records.
4. Click Save Database: Database saved; disk has 12 records.
5. `git status --short`: **` M src/data/materials.json`**.
6. Build + all 15 tests with the added material: PASS. Future edits are not blocked
   by the fixed migration baseline test.
7. Add a four-point curve through UI, including negative/unloading points and
   True/Plastic definitions. Save Database, reload browser, inspect detail: PASS.
   On-disk points/order/source/notes/definitions match exactly.
8. Delete disposable material through UI and Save Database: PASS; original complete
   11-record master restored. Disposable prior backups were cleared.
9. Build + all 15 tests after removal: PASS. Static POST remains unable to write files.

Commit/push to main would deploy via the existing Pages workflow; no Pages deployment
was performed during the storage task. The temporary branch uses raw.githack instead.
UI smoke checks
also confirmed production comparison, Material Map, detail/curve access and hidden
mutation controls. No Git commands are performed by the application.

## Daily workflow

In this repository:

```bash
git pull
npm ci
npm run dev
```

Edit material/curve/index data or import CSV through UI, then click **Save Database**.
Confirm **Database saved**, stop the dev server when needed, then:

```bash
npm test
npm run build
npm run test:production
git status
git add .
git commit -m "Update material database"
git push
```

Wait for GitHub Pages deployment to finish; open/reload the website on Computer B.
First commit must include the new master JSON, helper, schema, UI guards and tests.
See README for backup/conflict recovery and the initial clone command.
