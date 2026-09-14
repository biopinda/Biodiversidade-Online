# OpenWiki Quickstart

Biodiversidade.Online is now a single-purpose tool: one Go script that downloads Darwin Core Archives (DwC-A) from IPT sources — fauna, flora, and 512 occurrence collections — and harmonizes them into a single local **DuckDB** file.

Start here if you are new to the repo or planning a change.

## What this repository does

- Downloads and harmonizes two taxonomic sources (**Fauna do Brasil**, **Flora e Funga do Brasil**) into the `taxon` table.
- Downloads and harmonizes **512 occurrence sources** into the `occurrence` table.
- Both source lists live in a single registry: `ipt_sources.csv` at the repo root (514 rows total: 2 `taxa` + 512 `ocorrencias`).
- Writes run audits into `ingest_runs`.
- Produces one self-contained file, `biodiversidade.duckdb`, with fixed Darwin-Core-named columns — there is no shared database server and no other consuming context.

The implementation is Go-only, with a single entrypoint (`main.go` at the repo root). The former three-binary layout (`update-fauna`, `update-flora`, `update-occurrences`) and the `ipt-compare` helper were removed; the former MongoDB persistence layer was replaced by an embedded DuckDB file. See [ADR 0002](/docs/adr/0002-script-unico-sequencial.md) for why a single sequential script replaced three concurrent binaries.

## Major sections

- [Architecture and runtime model](architecture/pipeline.md)
- [Business domains and source inventory](domain/data-flow.md)
- [DuckDB schema and run auditing](data-model/duckdb.md)
- [Build, environment variables, and execution](operations/cli.md)
- [Testing and verification guidance](testing.md)

## Repository shape at a glance

- `main.go`: the single executable entrypoint — loads sources, then processes all `taxa` sources followed by all `ocorrencias` sources sequentially
- `ipt_sources.csv`: unified IPT source registry (`tipo,nome,repositorio,kingdom,tag,url`)
- `internal/config`: environment-variable loading and validation
- `internal/dwca`: DwC-A download, archive parsing, and streaming readers (unchanged from the MongoDB-era implementation)
- `internal/ingest`: harmonization — leaf-rank filtering, PT→EN normalization, type coercion, extension dedup/merge
- `internal/duckstore`: DuckDB writer — schema, idempotent upsert, delete-not-seen, `ingest_runs` auditing (replaces the former `internal/mongostore`)
- `internal/verbose`, `internal/version`: logging, cancellation, build metadata
- `docs/adr/`: architecture decision records for this rescope
- `CONTEXT.md`: domain glossary

## Operational summary

Typical execution:

1. Load environment variables (`DB_PATH`, `IPT_SOURCES_CSV`, `BULK_BATCH_SIZE`, `HTTP_TIMEOUT_MIN`, `LOG_LEVEL`, `LOG_FORMAT`, `CACHE_DIR`).
2. Open a single DuckDB write connection for the whole run (DuckDB allows only one writer per file at a time).
3. Read `ipt_sources.csv`; process every `taxa` source, then every `ocorrencias` source.
4. Per source: download the DwC-A, parse `meta.xml`/`eml.xml`, skip if the package version hasn't changed since the last successful run.
5. Harmonize records into Darwin Core shape and upsert into `taxon`/`occurrence` plus extension tables.
6. Delete-not-seen for that source, then write an `ingest_runs` audit row.

## Important behaviors to remember

- Fauna and flora write into the same `taxon` table, differentiated by `datasetID`/`datasetName`.
- Only leaf-rank taxa (species/subspecies/variety/form, PT or EN) are kept; higher ranks are rejected.
- Taxon extensions are deduplicated and merged before being written to their own tables, not copied raw.
- Suspect coordinates (latitude/longitude out of range) are flagged, not dropped.
- Upserts are idempotent by stable ID, with delete-not-seen cleanup per source per run.
- `ingest_runs` doubles as audit history and version-skip bookkeeping.
- The whole run uses one DuckDB write connection — this is why the tool is one sequential script instead of the old three concurrent binaries.

## When changing code

- Change DwC-A download/parsing? Review `architecture/pipeline.md` and `testing.md`.
- Change harmonization rules (rank filtering, normalization, coercion, extension merging)? Review `domain/data-flow.md`.
- Change table layout, upsert semantics, or audit behavior? Review `data-model/duckdb.md`.
- Change environment variables, build steps, or execution order? Review `operations/cli.md`.
- Change source inventory or IPT mappings? Review `ipt_sources.csv` and `domain/data-flow.md`.

## Primary source evidence

- `/README.md`
- `/CONTEXT.md`
- `/docs/adr/0001-duckdb-sobre-sqlite.md`
- `/docs/adr/0002-script-unico-sequencial.md`
- `/docs/adr/0003-esquema-fixo-darwin-core.md`
- `/docs/adr/0004-tabelas-normalizadas-para-extensoes.md`
- `/ipt_sources.csv`
- `/internal/dwca/`
- `/internal/ingest/`
- `/internal/duckstore/`

## Notes for future agents

If you need to implement a change, first determine whether it affects source acquisition (`internal/dwca`), harmonization (`internal/ingest`), or persistence (`internal/duckstore`). Then follow the section links above rather than re-reading the whole tree.

Temporary planning notes are not part of the wiki and should not be committed.
