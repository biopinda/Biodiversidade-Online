# Business Domains and Data Flow

The repository is centered on a single business domain: **harmonized acquisition of Brazilian biodiversity data into one local DuckDB file**. There is no other context downstream to serve; the DuckDB file is the deliverable.

## Unified source registry

Every source — taxonomic and occurrence alike — is listed in a single file: `ipt_sources.csv` at the repo root.

Columns:

- `tipo` — `taxa` or `ocorrencias`
- `nome` — human-readable source name
- `repositorio` — institution/repository short code
- `kingdom` — one or more kingdoms, semicolon-separated when a source spans more than one (e.g. `Plantae;Fungi`)
- `tag` — stable IPT resource identifier
- `url` — IPT base URL; the DwC-A download URL is derived as `{url}archive.do?r={tag}`

Row count verified directly against the checked-in CSV on 2026-09-14: **514 data rows** — **2** rows with `tipo=taxa` (Flora e Funga do Brasil; Catálogo Taxonômico da Fauna do Brasil, both published via `ipt.jbrj.gov.br/jbrj/`) and **512** rows with `tipo=ocorrencias` (INPA, MPEG, SIBBR, speciesLink, and other institutional IPTs).

## Why the domains still differ operationally

Even though both live in the same registry and the same DuckDB file, the two source types keep different ingest shapes:

- **Taxa (fauna/flora)**: only 2 sources, but each row expands into rich taxon data plus six extension tables (vernacular names, distribution, species profile, references, types and specimens, resource relationships).
- **Occurrences**: 512 sources, each processed independently, with its own download/parse/harmonize/upsert/delete-not-seen/audit cycle, writing only to the flat `occurrence` table.

`main.go` processes all `taxa` rows first, then all `ocorrencias` rows, in that fixed order, within one DuckDB write connection (see [ADR 0002](/docs/adr/0002-script-unico-sequencial.md)).

## DwC-A as the exchange format

Every source, regardless of `tipo`, is published as a Darwin Core Archive ZIP. A typical archive includes:

- `meta.xml` for schema mapping
- `eml.xml` for dataset metadata (used for version identity and skip logic)
- a core file (`taxon.txt` or `occurrence.txt`)
- for taxa: optional extension files — `distribution.txt`, `vernacularname.txt`, `speciesprofile.txt`, `reference.txt`, `typesandspecimen.txt`, `resourcerelationship.txt`

## Data flow summary

### Taxa flow

1. Download the fauna or flora DwC-A.
2. Parse `meta.xml` and `eml.xml`; skip if the package version matches the last successful run.
3. Stream taxon core rows and extension rows.
4. Filter to leaf ranks only (species/subspecies/variety/form, PT or EN).
5. Normalize PT→EN values, coerce types, and deduplicate/merge extension rows.
6. Upsert into `taxon` plus the six extension tables.
7. Delete-not-seen for that source.
8. Write an `ingest_runs` audit row.

### Occurrences flow

1. Read the next `ocorrencias` row from `ipt_sources.csv`.
2. Download that source's DwC-A.
3. Parse and stream occurrence records.
4. Coerce field types (dates, numeric coordinates) and flag suspect coordinates.
5. Upsert into `occurrence` in batches (`BULK_BATCH_SIZE`).
6. Delete-not-seen for that source.
7. Write an `ingest_runs` audit row; repeat for the next source.

## Business rules worth knowing

- **Only leaf taxa are retained.** Higher taxonomic ranks (family, order, etc.) never reach `taxon`.
- **Harmonization, not passthrough, is the default strategy** — the pipeline maps to a fixed Darwin Core schema rather than preserving whatever fields a source happens to send (see [ADR 0003](/docs/adr/0003-esquema-fixo-darwin-core.md)).
- **Idempotency is deliberate.** Stable IDs plus delete-not-seen semantics keep tables aligned with current source state across reruns.
- **Run history matters.** `ingest_runs` is both an audit trail and the mechanism for skipping unchanged sources.
- **Suspect coordinates are flagged, never silently dropped.**
- **Provenance is preserved** via `datasetID`, `datasetName`, `ingestRunId`, and `ingestedAt` columns rather than the old MongoDB `source`/`_runId` fields.

## Good starting points for future changes

- Adding or changing a source: edit `ipt_sources.csv` directly; no code change is needed for a new IPT source of an existing `tipo`.
- Changing taxon normalization or extension merge rules: inspect `internal/ingest`.
- Changing dataset version-skip logic: inspect `internal/ingest` (identity comparison) and `internal/duckstore` (audit read/write).
- Changing the source loader itself: inspect the CSV-reading code in `internal/ingest`.

## Source references

- `/README.md`
- `/CONTEXT.md`
- `/ipt_sources.csv`
- `/docs/adr/0002-script-unico-sequencial.md`
- `/docs/adr/0003-esquema-fixo-darwin-core.md`
- `/internal/ingest/`
- `/internal/duckstore/`
