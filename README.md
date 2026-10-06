## Live Preview

[Open Live Preview](https://ayay2270.github.io/CAE-Material-Library-V2-Preview/)

Branch: `main`

This is the current read-only GitHub Pages preview. Local editing and **Save Database**
are available only through `npm run dev`. `npm run build` uses the Pages base
`/CAE-Material-Library-V2-Preview/`; `dist/` is built and deployed by GitHub Actions.
The storage architecture was merged while retaining the latest main engineering tools.

The earlier [temporary raw.githack snapshot](https://raw.githack.com/ayay2270/CAE-Material-Library-V2-Preview/preview/git-master-database/dist/index.html)
remains on `preview/git-master-database`. Use the Live Preview above for current main.

# CAE Material Library — V2 Preview

[Open V2 preview](https://ayay2270.github.io/CAE-Material-Library-V2-Preview/)

**GitHub Pages = read-only database viewer. Local development = database editor.**
This repository remains separate from [the original production application](https://ayay2270.github.io/CAE-Material-Library/).
The initial UI came from `concepts/table-workspace-v2`, commit `a36ec592c822c3deb977bca9476049e705ffc28b`.
The table/card layout, engineering behavior, comparison and Material Map are unchanged.

## Master database

**`src/data/materials.json` is the authoritative, Git-tracked database.**

```text
Git master JSON → GitHub Pages build → all computers
Local UI draft → Save Database → repository JSON → manual commit/push
```

One JSON document contains `schemaVersion: 1`, `materials` and `indexes` (`categories` and `sources`). Records and indexes save together. All 11 built-in records were migrated without changing IDs, engineering values, notes, timestamps or histories.

Material records retain every existing field: ID, name, category, density, Young's Modulus, Poisson's Ratio, yield stress, ETAN, ultimate stress, elongation, source, notes, updatedAt, history and optional full stress-strain curve. Unknown JSON fields, including future solver/curve metadata, survive saving. There were no dedicated LS-DYNA/OptiStruct fields in the original schema.

Unused categories/sources remain in the database. Category rename keeps the category ID stable; source rename updates referenced materials and adds the existing history entry. The [storage audit](docs/storage-architecture.md) documents the complete pre/post migration flow.

## Local settings and legacy data

| localStorage key | Purpose |
| --- | --- |
| `cae-material-library:columns:v1` | Browser-specific visible columns and column order |
| `cae-material-library:legacy-recovery:v1` | Signature of the old-data notice acknowledged in this browser |
| `cae-material-library:v1` | Legacy material data; read only for recovery, never overwritten/deleted |
| `cae-material-library:indexes:v1` | Legacy category/source catalogs; read only for recovery, never overwritten/deleted |

Material data is no longer written to localStorage. Units, filters, sorting, selection and table/card preference retain their existing in-memory behavior; no extra preference keys were introduced.

## Daily workflow

Use Node.js 22 or newer. First-time setup:

```bash
git clone https://github.com/ayay2270/CAE-Material-Library-V2-Preview.git
cd CAE-Material-Library-V2-Preview
```

Before editing:

```bash
git pull
npm ci
npm run dev
```

Open Vite's local URL including **`/CAE-Material-Library-V2-Preview/`**. Edit materials, category/SOURCE indexes or full curves, or import CSV. These actions update a memory draft; the header shows **Unsaved changes**. Click **Save Database** to write `src/data/materials.json`. **Database saved** appears only after the server confirms the write.

Then explicitly run:

```bash
npm test
npm run build
npm run test:production
git status
git add .
git commit -m "Update material database"
git push
```

The app/helper never runs Git commands or uses GitHub credentials. GitHub Actions tests/builds/deploys this repository's `main`; after deployment, Computer B opens/reloads Pages and sees the committed data. Uncommitted local edits are not visible on other computers.

## Local Save Database

`npm run dev` mounts `server/database-api.mjs` as Vite development middleware. GET `/CAE-Material-Library-V2-Preview/__database` loads the on-disk JSON and SHA-256 revision. POST writes only that fixed repository file, with a loopback connection, same Origin/Host and an ephemeral local anti-CSRF token. No filesystem path comes from browser input. Keep the editor on localhost; non-loopback API clients are rejected even with `--host`.

Shared validation runs during build/recovery/save. It rejects malformed schema/JSON, missing fields, duplicate IDs, invalid curves, non-finite numbers, inconsistent indexes and an empty material database. Negative/unloading curve points remain valid and retain their original order. A revision check prevents overwriting another editor's newer save; an exclusive file lock coordinates different local servers on the same checkout.

Each save retains one previous version in **`data/backups/materials.backup.json`**, then writes a temporary master file, flushes and validates it and atomically replaces the master. Backup failure prevents master replacement. Backups/temp files/locks are Git-ignored; Git provides long-term history. If a server crashes leaving `src/data/materials.json.lock`, stop all local editors before removing the stale lock and retrying.

On failure, the draft remains in memory and an error is shown. Export the complete JSON draft before reloading. For a revision conflict, reload the newer master, reconcile your exported draft and save again. Unsaved local drafts trigger a browser navigation warning. **匯入 / 匯出 → 取消未儲存變更** restores the last loaded/successfully saved database.

## GitHub Pages / production

`npm run build` (or `npm run build:pages`) embeds the Git JSON into static `dist/` assets with Pages base **`/CAE-Material-Library-V2-Preview/`**. `npm run build:preview` is available for relative-path static snapshots. Websites display the deployed snapshot; a new commit becomes visible after deployment and browser reload. `npm run preview` is also read-only.

Production keeps Add Material, Edit, Delete and Import CSV controls visible with a subtle **Local editing only** indication. Clicking them opens instructions to run `npm run dev`, edit, use Save Database, then manually commit/push; it does not open an editor, upload a CSV or change material data. Index/curve editing and JSON recovery remain local-only. Browsing, searching, filtering, comparison, Material Map, details and exports remain available. The production build contains no local API client or filesystem writer; preview has no write middleware. Only `dist/` is deployed. No GitHub token, external backend, Supabase or Firebase is required.

## Legacy localStorage recovery

Startup checks both old keys without changing them. Differing or corrupt old data triggers a recovery notice; it never automatically replaces the Git master.

- **匯出舊資料 CSV** downloads supported material/curve data when valid.
- **下載完整 JSON 備份** preserves IDs, history, curves and all indexes. Corrupt data exports the original raw strings for manual repair.
- In local mode, **匯入舊資料為草稿** requires confirmation to replace the current draft, then explicit **Save Database** to write the master.
- **忽略舊資料** only acknowledges the current legacy content. Changed content triggers a notice again. **匯入 / 匯出 → 檢查舊瀏覽器資料** reopens an acknowledged notice.

Pages and localhost have different origins. Download the complete JSON backup on Pages, then recover locally via **匯入 / 匯出 → 匯入完整 JSON 備份 → 確認回復草稿 → Save Database**. Recovery replaces the draft rather than silently merging conflicting IDs; export an existing draft first when needed. Pages projects on the same origin may share the old keys, which remain untouched so the original application is not disrupted.

## CSV, curves and engineering

Existing CSV name matching, null handling and import history are unchanged. Local CSV import → memory draft → Save Database → Git JSON. Production keeps export; its visible CSV import button opens local-editing guidance without loading a file or changing data.

Material CSV includes **Stress-Strain Curve JSON**, preserving all points/order, definitions, source and notes; old CSV without the curve column preserves saved curves when updating materials. CSV does not retain IDs/full history/index labels/unused items: use complete JSON export for lossless database backup.

**Detail → 材料曲線** still supports paste or CSV/TSV input, units/definitions, preview, save, edit and export locally. Pages supports viewing/export. Curves remain mm/mm and MPa internally; the old application did not store original input-unit selections. Additional curve metadata present in JSON survives saving. Separate curve CSV exports all numerical points in base units; material CSV/JSON also preserves definitions/metadata.

Material values remain in mm–t–N–s (density t/mm³, stress MPa, elongation %). Display conversions, stress/strain definitions, ETAN and solver calculations, Density Tuner, comparison and Material Map behavior from the latest main are retained. The storage merge does not change their formulas. Header artwork and photo credits (`src/assets/CREDITS.md`) are unchanged.

Solver Plasticity always calculates the original bilinear **Calculated H** from E, yield stress, ultimate stress and elongation, including all substituted engineering/true stress and strain steps under **Show calculation details**. When **Stored H** exists, the calculated estimate is reference only: Stored H remains the active OptiStruct MATS1 Work Hardening Slope. Without Stored H, Calculated H becomes active. **H source** identifies which value feeds LS-DYNA MAT_003 `ETAN = E × H / (E + H)`; the reverse reference is `H = ETAN / (1 − ETAN / E)`. For E = 200000 MPa and Stored H = 740.06 MPa, ETAN rounds to 737.33 MPa. Calculations retain full precision; the historical JSON/CSV field `etan` still stores H for compatibility and is never overwritten by the estimate or conversion.

## Checks and deployment

```bash
npm ci
npm test
npm run build
npm run test:production
```

Tests cover current master loading, exact original migration, atomic writes/backups, duplicate/empty/corrupt rejection, concurrent saves, backup failures, curves/extra metadata, unused indexes, legacy recovery, CSV→save and local API validation. Production tests serve the actual build, check local API code is absent and verify POST cannot change the master. Frozen migration fixtures live only in `tests/`, so intentional future library edits do not fail the 11-record regression test.

`.github/workflows/pages.yml` uses Node 22 and these checks before deploying `dist/` on pushes to `main` or manual workflow dispatch. The original production repository remains separate.
