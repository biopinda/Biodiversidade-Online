# Biodiversidade.Online — Base DuckDB de Espécies e Ocorrências

Script Go único que baixa DwC-A de fontes IPT (taxa + ocorrências) e grava um arquivo DuckDB local, harmonizado em Darwin Core. Sem frontend, sem Bun, sem TypeScript, sem MongoDB, sem Docker/CI.

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:
- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

## Stack

- **Go 1.25+** — único runtime necessário
- **DuckDB** — arquivo local único (`biodiversidade.duckdb`, gitignored), via `github.com/marcboeker/go-duckdb` (CGO — exige compilador C no PATH)
- **Dependências diretas**: `go-duckdb` e `godotenv` apenas

## Layout

```
/
├── main.go                # Único ponto de entrada (fauna+flora, depois ocorrências, sequencial)
├── ipt_sources.csv        # Registro único de fontes IPT (coluna tipo: taxa | ocorrencias)
├── internal/
│   ├── config/             # .env loading + validação
│   ├── dwca/                # Parser DwC-A streaming (sem deps externas)
│   ├── ingest/               # Harmonização: filtro rank, PT→EN, coerção, merge de extensões
│   ├── duckstore/             # Upsert idempotente, delete-not-seen, auditoria (ingest_runs)
│   ├── verbose/                # slog wrapper + signal handling
│   └── version/                 # versão via ldflags
├── docs/adr/               # Decisões de arquitetura
├── openwiki/                # Documentação interna navegável
├── CONTEXT.md                 # Glossário de domínio
└── go.mod / go.sum
```

## Comandos principais

```bash
# CGO é obrigatório (driver DuckDB) — defina CC se necessário no Windows
export CGO_ENABLED=1

# Compilar
go build -trimpath -ldflags="-s -w" -o bin/ .

# Testes e análise estática
go test ./...
go vet ./...

# Dry run (sem gravação no DuckDB)
go run . --dry-run
```

## Regras obrigatórias

- **Nunca criar branch** — todos os commits vão para `main` diretamente
- **Nunca commitar credenciais** — usar `.env` local (gitignored); `.env.example` apenas com placeholders/defaults
- **Nunca adicionar dependências externas** sem justificativa forte — stdlib Go resolve a maior parte
- **Sem Docker, sem workflows GitHub** — execução manual/agendada pelo operador
- **Nunca versionar `biodiversidade.duckdb`** — gerado pela execução, gitignored
- **NEVER CANCEL** builds ou testes — todos completam em segundos

## Configuração

Todas as variáveis têm defaults sensatos (ver `.env.example`):

```dotenv
DB_PATH=./biodiversidade.duckdb
IPT_SOURCES_CSV=./ipt_sources.csv
# demais variáveis têm defaults em internal/config/config.go
```

## Convenções de código

- Pacotes em `internal/` são compartilhados por todo o pipeline (um único binário agora, não mais três)
- `main.go`: parse flags → config.Load → duckstore.Connect → LoadIPTSources → ingest.Run por fonte → exit code
- Logging via `log/slog` com handler configurável (text/json); usar `log.Info/Warn/Error` com campos estruturados
- Erros tipados: `*config.ConfigError` → exit 2; download → exit 3; archive → exit 4; duckdb → exit 5
- Testes unitários em `internal/dwca/` e `internal/ingest/` usando stdlib `testing`; sem mocks de banco

## Arquitetura — Posição atual

Este repositório é de propósito único: baixar, harmonizar e gravar dados de espécies e ocorrências num único arquivo DuckDB. Não há mais suite multi-contexto (Curadoria/Enriquecimento/Apresentação foram removidos do escopo).

Ver `README.md` para os diagramas C4. Ver `docs/adr/` para as decisões de arquitetura (DuckDB, script único, esquema fixo, tabelas de extensão).

## Regras de transformação de `taxon` (fauna/flora)

- **Filtro de rank**: aceitar somente `ESPECIE`, `SUB_ESPECIE`, `VARIEDADE`, `FORMA` (PT) ou `SPECIES`, `SUBSPECIES`, `VARIETY`, `FORM` (EN), case-insensitive. Grupos supra-específicos rejeitados (`internal/ingest/taxa_transform.go:shouldKeepTaxon`).
- **Extensões normalizadas**: `distribution.txt`, `vernacularname.txt`, `speciesprofile.txt`, `resourcerelationship.txt`, `reference.txt`, `typesandspecimen.txt` viram tabelas próprias (`taxon_*`), FK `taxonID`, com a mesma lógica de merge/dedup de antes.
- **Campos computados**: `canonicalName` (`genus + specificEpithet [+ infraspecificEpithet]`), `flatScientificName` (`scientificName` lowercase + strip non-alphanum).
- **Schema-alvo**: colunas fixas Darwin Core em `internal/duckstore/schema.go` (ver [ADR 0003](docs/adr/0003-esquema-fixo-darwin-core.md)).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Agent skills

### Issue tracker

Issues live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.
