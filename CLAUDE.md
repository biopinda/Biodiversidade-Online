# Biodiversidade.Online — Contexto de Aquisição (V7)

Repositório Go com três binários CLI que importam dados DwC-A de fontes IPT para MongoDB. Sem frontend, sem Bun, sem TypeScript.

## Stack

- **Go 1.22+** — único runtime necessário
- **MongoDB** — banco `dwc2json` (coleções `taxa`, `occurrences`, `ingest_runs`)
- **Dependências diretas**: `mongo-driver/v2` e `godotenv` apenas (FR-016)

## Layout

```
cmd/update-fauna/          # Entry point fauna
cmd/update-flora/          # Entry point flora
cmd/update-occurrences/    # Entry point 505+ fontes
internal/config/           # .env loading + validação
internal/dwca/             # Parser DwC-A streaming (sem deps externas)
internal/ingest/           # Pipeline: download → parse → upsert → delete-not-seen
internal/mongostore/       # BulkWrite, DeleteNotSeen, RunRecord
internal/verbose/          # slog wrapper + signal handling
internal/version/          # versão via ldflags
data/occurrences.csv       # 505+ fontes IPT para ocorrências
specs/001-refactor-acquisition/  # Spec, plan, tasks, contratos
```

## Comandos principais

```bash
# Compilar todos (Windows)
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-fauna
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-flora
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-occurrences

# Compilar todos (Linux)
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-fauna
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-flora
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-occurrences

# Testes e análise estática
go test ./internal/...
go vet ./...

# Dry run (sem MongoDB necessário para fauna/flora se URLs configuradas)
./bin/update-fauna --dry-run
./bin/update-flora --dry-run
./bin/update-occurrences --dry-run
```

## Regras obrigatórias

- **Nunca criar branch** — todos os commits vão para `main` diretamente
- **Nunca commitar credenciais** — usar `.env` local (gitignored); `.env.example` apenas com placeholders genéricos
- **Nunca adicionar dependências externas** sem justificativa forte — stdlib Go resolve a maior parte
- **Sem Docker** neste contexto — os binários são distribuídos diretamente (`bin/`)
- **Sem workflows GitHub** — execução manual pelos operadores
- **NEVER CANCEL** builds ou testes — todos completam em segundos

## Configuração

Copiar `.env.example` → `.env` e preencher:

```dotenv
MONGO_URI=mongodb://user:pass@host:27017/?authSource=admin
IPT_FAUNA_URL=https://...
IPT_FLORA_URL=https://...
# demais variáveis têm defaults em internal/config/config.go
```

## Convenções de código

- Pacotes em `internal/` são compartilhados pelos 3 binários
- `cmd/<binary>/main.go` apenas: parse flags → config.Load → mongostore.Connect → ingest.Run → exit code
- Logging via `log/slog` com handler configurável (text/json); usar `log.Info/Warn/Error` com campos estruturados
- Erros tipados: `*config.ConfigError` → exit 2; download → exit 3; archive → exit 4; mongo → exit 5
- Testes unitários em `internal/dwca/` e `internal/ingest/` usando stdlib `testing`; sem mocks de MongoDB

## Arquitetura C4 — Posição atual

Este repositório implementa apenas o **Contexto de Aquisição** da suite Biodiversidade.Online. Os outros três contextos (Curadoria, Enriquecimento, Apresentação) serão repositórios ou módulos independentes no futuro.

Ver `README.md` para os diagramas C4 completos. Ver `docs/funcionamento.md` para detalhes do pipeline e schemas das coleções.

## Regras de transformação de `taxa` (fauna/flora)

- **Filtro de rank**: aceitar somente `ESPECIE`, `SUB_ESPECIE`, `VARIEDADE`, `FORMA` (PT) ou `SPECIES`, `SUBSPECIES`, `VARIETY`, `FORM` (EN), case-insensitive. Grupos supra-específicos rejeitados (`internal/ingest/taxa_transform.go:shouldKeepTaxon`).
- **Extensões mescladas**: `distribution.txt`, `vernacularname.txt`, `speciesprofile.txt`, `resourcerelationship.txt` (→ `othernames`), `reference.txt`, `typesandspecimen.txt`. Carregadas em RAM e agrupadas por `taxonID`.
- **Campos computados**: `canonicalName` (`genus + specificEpithet [+ infraspecificEpithet]`), `flatScientificName` (`scientificName` lowercase + strip non-alphanum).
- **Schema-alvo**: `docs/schema-dwc2json-taxa-mongoDBJSON.json` (gold standard V6 preservado).
