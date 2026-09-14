# CLI and Operations Guide

The repository ships a single Go command-line entrypoint (`main.go` at the repo root) rather than multiple binaries or a web application. There is no Docker image, no CI/CD deployment pipeline, and no hosting instructions — this is a local tool an operator builds and runs manually (or schedules with whatever mechanism they already use).

## Building and running

```bash
# Build a binary
go build -trimpath -ldflags="-s -w" -o bin/ .
./bin/biodiversidade-online

# Or run without a separate build step
go run .
```

Building requires **Go 1.25+** and **a C compiler on `PATH`**, because the DuckDB driver (`github.com/marcboeker/go-duckdb`) requires CGO:

- Windows: install a MinGW-w64 distribution, e.g. `winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT`.
- Linux/macOS: the system's standard gcc/clang is normally already present.

For the authoritative, current list of command-line flags, run `go run . --help` or read `main.go` directly — flag names are still being finalized alongside the DuckDB migration and are intentionally not enumerated here to avoid documenting something that could drift from the source.

## Environment variables

Loaded via `internal/config`, all with sensible defaults:

- `DB_PATH` — DuckDB file path, defaults to `./biodiversidade.duckdb`
- `IPT_SOURCES_CSV` — unified source registry path, defaults to `./ipt_sources.csv`
- `BULK_BATCH_SIZE` — batch size for bulk writes, defaults to `5000`
- `HTTP_TIMEOUT_MIN` — per-download HTTP timeout in minutes, defaults to `30`
- `LOG_LEVEL` — `debug` | `info` | `warn` | `error`
- `LOG_FORMAT` — `text` | `json`
- `CACHE_DIR` — optional; leave unset to skip download caching

The MongoDB-era variables (`MONGO_URI`, `MONGO_DATABASE`, `IPT_FAUNA_URL`, `IPT_FLORA_URL`, `IPT_OCCURRENCES_CSV`) no longer exist. Fauna, flora, and every occurrence source are configured through the single `ipt_sources.csv` file instead of environment variables.

## Execution order

`main.go` runs sequentially against one DuckDB write connection for the entire process:

1. All sources with `tipo=taxa` in `ipt_sources.csv` (fauna, then flora, in file order).
2. All sources with `tipo=ocorrencias` in `ipt_sources.csv` (512 sources, one at a time).

This replaces the previous model of three independently schedulable binaries — DuckDB only allows one writer per file at a time, so concurrent execution against the same database file is not supported (see [ADR 0002](/docs/adr/0002-script-unico-sequencial.md)).

## Operational flow per source

1. Resolve the source's DwC-A URL from `ipt_sources.csv`.
2. Download (with caching if `CACHE_DIR` is set).
3. Parse `meta.xml`/`eml.xml`; skip the source if its package version matches the last successful run.
4. Harmonize and upsert records.
5. Delete-not-seen for that source.
6. Write an `ingest_runs` audit row.

## Things to watch when changing CLI behavior

- Any new flag or environment variable needs a default and validation in `internal/config`.
- Because the whole run shares one DuckDB write connection, changing execution order or introducing concurrency for occurrence sources requires re-validating the single-writer assumption end to end.
- There is no external scheduler bundled with this repository; operators are expected to bring their own (cron, Task Scheduler, systemd timer, etc.).

## Source references

- `/main.go`
- `/internal/config/`
- `/ipt_sources.csv`
- `/docs/adr/0002-script-unico-sequencial.md`
