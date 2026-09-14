# DuckDB Data Model

The pipeline writes a single embedded DuckDB file (default path `./biodiversidade.duckdb`, overridable via `DB_PATH`), opened with exactly one write connection for the whole run — DuckDB does not support multiple concurrent writers against the same file (see [ADR 0001](/docs/adr/0001-duckdb-sobre-sqlite.md) and [ADR 0002](/docs/adr/0002-script-unico-sequencial.md)).

Unlike the former MongoDB collections, every table has a **fixed set of Darwin-Core-named columns** — fields outside that set are dropped during harmonization and reported as warnings in `ingest_runs`, not written as sparse extra columns (see [ADR 0003](/docs/adr/0003-esquema-fixo-darwin-core.md)).

## Core tables

### `taxon`

Holds leaf-rank taxa from the fauna and flora sources.

- Primary key: `taxonID`.
- Standard Darwin Core Taxon-core term columns (fixed set, not passthrough).
- Computed columns: `canonicalName`, `flatScientificName`.
- Provenance columns: `datasetID`, `datasetName`, `ingestRunId`, `ingestedAt`.

### `occurrence`

Holds records from the 512 occurrence sources.

- Primary key: `occurrenceID`.
- Standard Darwin Core Occurrence-core term columns (fixed set, not passthrough).
- Provenance columns: `datasetID`, `datasetName`, `ingestRunId`, `ingestedAt`.
- Suspect coordinates (latitude outside `-90..90`, longitude outside `-180..180`) are retained and flagged rather than dropped.

## Extension tables

Six tables, one per DwC-A taxon extension, each foreign-keyed on `taxon.taxonID` and populated with already-deduplicated/merged data rather than a raw copy of the extension file (see [ADR 0004](/docs/adr/0004-tabelas-normalizadas-para-extensoes.md)):

- `taxon_vernacular_name`
- `taxon_distribution`
- `taxon_species_profile`
- `taxon_reference`
- `taxon_types_and_specimen`
- `taxon_resource_relationship`

Because these are normal relational tables, querying them is a plain SQL join on `taxonID` — no engine-specific nested/array types are required.

## Audit table

### `ingest_runs`

One row per source per execution. Serves the same purpose the MongoDB `ingest_runs` collection used to serve, now as a DuckDB table:

- run identity and the source it ran against
- DwC-A package identity (used to decide whether to skip a rerun)
- counters (records read, rejected, upserted, updated, removed, suspect-coordinate flags)
- status and warnings
- start/finish timestamps

## Update semantics

### Idempotent upsert

Every write is an upsert keyed by the table's stable ID (`taxonID` or `occurrenceID`), so re-running the pipeline against an unchanged source converges to the same table state instead of growing duplicates.

### Delete-not-seen

After a source finishes successfully, rows belonging to that source but not seen in the current run are deleted — keeping `taxon`/`occurrence` aligned with the current state of the upstream IPT archive.

### Version-skip

Before doing the expensive parse/harmonize/write work for a source, the pipeline compares the current DwC-A package identity (from `eml.xml`) against the latest successful `ingest_runs` entry for that source. An unchanged identity marks the run as skipped.

## Source references

- `/CONTEXT.md`
- `/docs/adr/0001-duckdb-sobre-sqlite.md`
- `/docs/adr/0002-script-unico-sequencial.md`
- `/docs/adr/0003-esquema-fixo-darwin-core.md`
- `/docs/adr/0004-tabelas-normalizadas-para-extensoes.md`
- `/internal/duckstore/`
- `/internal/ingest/`
