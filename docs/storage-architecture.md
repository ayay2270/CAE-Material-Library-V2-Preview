# Storage audit

Baseline inspected before modifications: `43b07ac8d4a282254e9f7dad9fc2a36032915106`.

| Capability | Previous storage flow | New storage flow |
| --- | --- | --- |
| Built-in materials | `src/data/seed.ts`; 11 records; seedMaterials attaches IDs, notes, timestamps, initial history | `src/data/materials.json`; exact complete migrated records |
| Startup / CRUD | storage hook reads localStorage or seed fallback; state changes write material key | Committed master, dev API reads disk; memory draft followed by explicit Save Database |
| Category / Source catalogs | indexes.tsx defaults, browser catalog and derived counts | Indexes in the same Git JSON document; zero-count items retained |
| Rename | Category label changes with stable ID; source updates references/history | Same behavior, saved atomically with material records |
| Notes / History | Fields inside browser material records | Fields inside master records |
| Full curves | Optional stressStrainCurve inside each material; all points, definitions, source, notes | Same object in master, no point sorting/truncation |
| CSV import | csvToMaterials → name matching in hook → browser storage | Same name matching → local draft → Save Database |
| CSV export | csv.ts → properties/source/notes/date/curve JSON | Same CSV; complete JSON backup also available for ID/history/index fidelity |
| ETAN | Stored material property; etan.ts placeholder | Same property and formula placeholder |
| Columns | columns.ts → localStorage column order/hidden fields | Same local preference |
| Units / View / Filters / Sort / Selection | React state; no storage key | Unchanged React state |

The original source contained exactly three localStorage keys: materials, columns and indexes. No sessionStorage/IndexedDB database or dedicated LS-DYNA/OptiStruct fields were present. Original seed code now exists only as a regression fixture in `tests/original-seed.ts`; the post-migration fixture is `tests/migrated-database.json`.

## Boundaries

- Master: `src/data/materials.json` — versioned envelope, complete materials and indexes.
- Draft: React state only; explicit Save or discard/recovery.
- UI preferences: columns key; new legacy-notice acknowledgement signature.
- Legacy: original materials/index keys are read only and never removed.
- Writer: Node helper mounted only by Vite dev, fixed file path, validation, prior backup, atomic replacement, revision conflict and file lock.
- Production: static committed database snapshot; no deployed helper/client write endpoint; import/edit controls hidden.

Shared `database-schema.mjs` validation runs before build/recovery/save and validates actual temporary-file bytes before replacement. Unknown JSON fields are preserved. Backup failure prevents master replacement. Save never runs Git commands.

Legacy detection compares complete data including indexes. Acknowledgement stores only a signature; full JSON export bridges the Pages/localhost origin boundary. Corrupt data remains available verbatim for recovery. Import explicitly replaces a local draft, followed by Save Database; never automatically promotes old browser content.

`format.ts`, `props.ts`, `etan.ts`, curve parsing/conversion/CSV calculations, comparison and Material Map math were not changed. Layout/navigation/artwork are preserved. UI additions are limited to local Save/status, recovery/import messages and read-only editing guards. See README for daily workflow, limitations, backups and verification.
