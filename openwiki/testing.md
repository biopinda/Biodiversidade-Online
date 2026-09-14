# Testing and Verification

The repository favors targeted unit tests around the ingestion core over a broad integration test suite. There is no CI/CD pipeline in this repository; tests are run locally by whoever is changing the code.

## Existing test coverage

### `internal/dwca` (unchanged by the DuckDB rescope)

- `archive_test.go`
- `reader_test.go`
- `fixture_test.go`

These cover DwC-A archive opening, `meta.xml`/`eml.xml` parsing, and streaming reads of core/extension files — none of this changed when the persistence layer moved from MongoDB to DuckDB.

### `internal/ingest`

Covers the harmonization rules that turn a raw DwC-A row into a Darwin-Core-shaped record: leaf-rank filtering, PT→EN normalization, type coercion, and extension deduplication/merging. Because harmonization is stricter under the new fixed-schema model (see [ADR 0003](/docs/adr/0003-esquema-fixo-darwin-core.md)) than it was under the old MongoDB passthrough model, expect this package's tests to be the ones most actively evolving alongside the schema.

### `internal/duckstore`

New package (replaces `internal/mongostore`). Its tests should cover the same operational guarantees the old MongoDB layer needed — idempotent upsert by stable ID, delete-not-seen scoped to one source per run, and `ingest_runs` audit writes including version-identity comparison — now expressed as DuckDB `INSERT ... ON CONFLICT` / transaction semantics instead of MongoDB bulk writes.

## What the tests tell you about the code

The design emphasizes:

- parsing archives safely and predictably
- harmonizing into a fixed Darwin Core schema rather than preserving arbitrary source fields
- keeping taxon-specific business rules (rank filtering, extension merge) isolated from generic transform/coercion logic
- keeping persistence (`internal/duckstore`) reruns idempotent and side-effect-free on unchanged sources

## Practical verification steps

When changing code in this repo:

- `go test ./...` — full unit test suite
- `go test ./internal/...` — package-scoped run
- `go vet ./...` — static analysis, especially after touching parsing, configuration, or DuckDB writes

Because the DuckDB driver requires CGO, a C compiler must be on `PATH` for any of the above to build — see `operations/cli.md` for platform-specific setup.

For end-to-end changes, also verify:

- `go run .` completes against a small/local `ipt_sources.csv` subset without error
- the resulting `biodiversidade.duckdb` file has the expected row counts for `taxon`/`occurrence`/`ingest_runs`
- rerunning against an unchanged source is skipped (version-skip logic) rather than re-downloading and rewriting

## Change-focused guidance

### If you change DwC-A parsing
Watch for archive format assumptions, header handling, and `eml.xml` metadata extraction in `internal/dwca`.

### If you change taxon normalization
Watch for rank filtering, PT→EN normalization, and extension merge behavior in `internal/ingest`.

### If you change occurrence harmonization
Watch for type coercion (dates, coordinates) and suspect-coordinate flagging, since occurrences run across 512 sources per execution.

### If you change DuckDB persistence
Watch for upsert idempotency, delete-not-seen scoping (must stay per-source, not global), and `ingest_runs` version-identity comparisons in `internal/duckstore`.

## Source references

- `/internal/dwca/archive_test.go`
- `/internal/dwca/reader_test.go`
- `/internal/dwca/fixture_test.go`
- `/internal/ingest/`
- `/internal/duckstore/`
- `/docs/adr/0003-esquema-fixo-darwin-core.md`
