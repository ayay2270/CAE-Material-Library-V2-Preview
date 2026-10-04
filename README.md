# CAE Material Library — V2 Preview

## Preview Website

[Open the V2 preview](https://ayay2270.github.io/CAE-Material-Library-V2-Preview/)

This repository deploys the V2 concept for evaluation. It is **not yet the production version**.
Production remains on the original repository's `main` branch:
[CAE Material Library production](https://ayay2270.github.io/CAE-Material-Library/).

**Table View is the default Material Library view. Card View is secondary.**

## Source

Original repository: [ayay2270/CAE-Material-Library](https://github.com/ayay2270/CAE-Material-Library)

Source branch: [`concepts/table-workspace-v2`](https://github.com/ayay2270/CAE-Material-Library/tree/concepts/table-workspace-v2)

Copied source commit: `e3685eb3087c3daddda76880b9a422265b6bf324`.
Only this preview's README, Vite base path, and Pages workflow differ from that snapshot.
No application code, engineering values, or calculations were changed for deployment.

## Functions

- Dense sortable engineering table with sticky Material Name / Actions and missing values shown as `—`.
- Secondary category-grouped cards, dark workspace sidebar, and live category/source counts.
- Shared category/source/time filters, search, and selection across Table/Card views.
- Column visibility, drag/arrow reordering, default restoration, and Density / Stress display units.
- Add, edit, delete, detail drawer, source/notes/history, and localStorage persistence.
- Material comparison, Density × Young's Modulus Material Map, and CSV import/export.
- The existing 11 sample materials and the existing ETAN calculation placeholder.
- Sidebar **編輯** controls to add or rename Material Category / Source index items,
  including unused items with a count of 0. Source renaming updates every referenced
  material and its history; category renaming keeps category IDs stable.
- **Detail → 材料曲線 → 加入完整曲線**: paste Strain / Stress points or import CSV/TSV,
  select units and definitions, preview, save, edit and export complete curves.
  Every point and its original order are preserved. Invalid rows block saving.
  This does not change material properties, engineering/true definitions or ETAN logic.

## Run locally

```bash
git clone https://github.com/ayay2270/CAE-Material-Library-V2-Preview.git
cd CAE-Material-Library-V2-Preview
npm ci
npm run dev
npm run build
```

The preview uses `/CAE-Material-Library-V2-Preview/` as its Vite base path.
Open the local URL printed by Vite, including that path. Production output is in `dist/`.

## Deployment

GitHub Actions (`.github/workflows/pages.yml`) checks out `main`, sets up Node 22,
runs `npm ci` and `npm run build`, uploads `dist/`, and deploys it to GitHub Pages.
It runs on pushes to this repository's `main` and supports `workflow_dispatch`.
This repository's default branch is `main`; its Pages source is GitHub Actions.
The original repository's branches, workflow, and production deployment remain separate.

## Engineering and storage notes

- Values remain stored in the mm–t–N–s system: Density t/mm³, Stress MPa, Elongation %.
- CSV exports use those stored base units regardless of the display units.
- Full curves use mm/mm and MPa internally. Material CSV backups include the curve
  and metadata in **Stress-Strain Curve JSON**; older CSV imports preserve saved curves.
  The separate curve CSV contains all numerical points in base units.
- Source, Notes, and history entries retain their existing text and engineering meaning.
- The Lenovo logo is `src/assets/lenovo-logo.png`.
- No ETAN formula was introduced. `src/lib/etan.ts` retains the existing placeholder.
- Material data is stored in `cae-material-library:v1`; column preferences use
  `cae-material-library:columns:v1`; category/source indexes use
  `cae-material-library:indexes:v1`. There is no backend. Export CSV before clearing browser site data.
  Material CSV does not include index display names or unused index items.
- GitHub Pages projects under the same origin share browser storage. This preview deliberately
  preserves the existing storage keys and persistence behavior of V2.
