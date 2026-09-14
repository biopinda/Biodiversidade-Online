# Architecture: Ingestion Pipeline

This repository implements a single production pipeline: one Go module with one command-line entrypoint (`main.go` at the repo root) that downloads, harmonizes, and persists Brazilian biodiversity data into a single local DuckDB file.

The former three-binary layout (`update-fauna`, `update-flora`, `update-occurrences`) and the `ipt-compare` helper are gone. A single script replaces them because a DuckDB file accepts only one write connection at a time — running three writers concurrently against the same file was no longer viable once MongoDB was replaced. See [ADR 0002](/docs/adr/0002-script-unico-sequencial.md).

## Core runtime model

1. Load configuration from environment variables (`internal/config`).
2. Open a single DuckDB write connection for the entire run.
3. Load the unified source registry from `ipt_sources.csv`.
4. Process every source of `tipo=taxa` first, then every source of `tipo=ocorrencias` — sequentially, never concurrently.
5. Per source:
   - Resolve the DwC-A download URL from the source's `tag`/`url`.
   - Download the archive (with retry/backoff and optional caching).
   - Parse `meta.xml` and `eml.xml`.
   - Compare the package identity against the last successful `ingest_runs` entry for that source; skip the heavy work if unchanged.
   - Stream and harmonize core records (and, for taxa, extension records).
   - Upsert into the fixed Darwin Core tables.
   - Delete rows from the same source not seen in the current run.
   - Write an `ingest_runs` audit row.

## Supporting packages

### `internal/config`
Loads environment variables and validates them. Confirmed variables: `DB_PATH`, `IPT_SOURCES_CSV`, `BULK_BATCH_SIZE`, `HTTP_TIMEOUT_MIN`, `LOG_LEVEL`, `LOG_FORMAT`, `CACHE_DIR`. There is no longer a MongoDB connection string or per-source URL variables — every source, including fauna and flora, comes from `ipt_sources.csv`.

### `internal/dwca`
Unchanged from the MongoDB-era implementation. Responsible for:

- archive download with retry/backoff (`download.go`)
- ZIP opening (`archive.go`)
- `meta.xml`/`eml.xml` parsing (`types.go`, `archive.go`)
- streaming readers for core and extension files (`reader.go`)

### `internal/ingest`
Owns harmonization — the step that turns a raw DwC-A row into a Darwin-Core-shaped record ready for a fixed-column table:

- filters taxa to leaf ranks only (species/subspecies/variety/form, PT or EN)
- normalizes PT→EN values for `taxonomicStatus`/`taxonRank`
- coerces field types (dates, floats, ints) instead of leaving them as raw strings
- flags (not drops) suspect coordinates outside valid latitude/longitude ranges
- deduplicates and merges taxon extension rows before they reach `internal/duckstore`
- loads the unified `ipt_sources.csv` registry (`taxa` and `ocorrencias` rows alike)

### `internal/duckstore`
Replaces the former `internal/mongostore`. Owns the DuckDB schema and all writes:

- fixed-column `CREATE TABLE` statements for `taxon`, `occurrence`, the six extension tables, and `ingest_runs`
- idempotent upsert by stable ID (`taxonID`/`occurrenceID`)
- delete-not-seen cleanup scoped to one source per run
- `ingest_runs` audit writes, including the version-identity fields used for skip logic

### `internal/verbose` and `internal/version`
Unchanged in purpose: structured logging plus interrupt handling, and build-time version metadata.

## Key architectural choices

Recorded as ADRs — this document does not restate them, only points to them:

- [ADR 0001](/docs/adr/0001-duckdb-sobre-sqlite.md) — DuckDB over SQLite, given analytical access patterns over tens of millions of occurrence rows.
- [ADR 0002](/docs/adr/0002-script-unico-sequencial.md) — one sequential script instead of three concurrent binaries, because DuckDB allows only one writer per file.
- [ADR 0003](/docs/adr/0003-esquema-fixo-darwin-core.md) — fixed Darwin Core columns instead of passthrough.
- [ADR 0004](/docs/adr/0004-tabelas-normalizadas-para-extensoes.md) — one normalized table per taxon extension instead of nested documents.

## What to watch out for when editing

- Any change that reintroduces concurrent writers against the same DuckDB file breaks the single-writer assumption baked into the whole pipeline.
- Fauna/flora harmonization changes usually touch both the core `taxon` mapping and extension merge logic in `internal/ingest`.
- Occurrence harmonization runs 512 times per full execution — prefer streaming and batched writes (`BULK_BATCH_SIZE`) over anything that buffers a full source in memory.
- Changes to `eml.xml` handling can affect version-skip logic and `ingest_runs` metadata.
- The DuckDB driver (`github.com/marcboeker/go-duckdb`) requires CGO; a C compiler must be on `PATH` to build or test `internal/duckstore`.

## Source references

- `/CONTEXT.md`
- `/docs/adr/0001-duckdb-sobre-sqlite.md`
- `/docs/adr/0002-script-unico-sequencial.md`
- `/ipt_sources.csv`
- `/internal/config/`
- `/internal/dwca/`
- `/internal/ingest/`
- `/internal/duckstore/`
- `/internal/verbose/`
- `/internal/version/`
- `/main.go`
