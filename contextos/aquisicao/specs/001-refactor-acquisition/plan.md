# Implementation Plan: Refatoração para Contexto de Aquisição Apenas

**Branch**: `main` _(spec reside em `specs/001-refactor-acquisition/`; nenhum branch novo é criado — FR-015)_
**Date**: 2026-05-05
**Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-refactor-acquisition/spec.md`

## Summary

Refatorar o repositório Biodiversidade.Online removendo os contextos de **Enriquecimento** (loaders/enrichers) e **Apresentação** (Astro web app, ChatBB, Dashboard, API REST). Restará apenas o contexto de **Aquisição**, implementado em **Go 1.22+** como três executáveis Windows independentes (`update-fauna.exe`, `update-flora.exe`, `update-occurrences.exe`) que baixam DwC-A dos IPTs, parseiam, e fazem upsert nas coleções `taxa` (passthrough completo + `source` fauna/flora) e `occurrences` (passthrough completo) do banco MongoDB `dwc2json`. Estratégia de atualização: **upsert por chave estável + delete-not-seen via `_runId`**. Auditoria persistida em `ingest_runs`. Sem Docker, sem GitHub Actions, sem UI.

## Technical Context

**Language/Version**: Go 1.22+ (recomendado 1.23+).
**Primary Dependencies**:

- `go.mongodb.org/mongo-driver/v2` — driver MongoDB oficial (v2 GA).
- `github.com/joho/godotenv` v1.5.x — carregamento de `.env`.
- Stdlib: `archive/zip`, `encoding/csv`, `encoding/xml`, `net/http`, `log/slog`, `flag`, `crypto/rand` (UUID v7).

**Storage**: MongoDB (banco `dwc2json`); coleções `taxa`, `occurrences`, `ingest_runs`.
**Testing**: stdlib `testing` apenas; foco em parser DwC-A e conversores de tipo. Sem teste de integração com Mongo (validação manual pelo operador).
**Target Platforms**: Windows 11 (amd64) e Linux x86 (amd64). Binários gerados por cross-compilation nativa do Go — sem alteração de código-fonte. `GOOS=windows GOARCH=amd64` produz `.exe`; `GOOS=linux GOARCH=amd64` produz binário sem extensão. Ambos autocontidos.
**Project Type**: CLI / Desktop tool (3 executáveis). Layout `cmd/` + `internal/`.
**Performance Goals**: Fauna ≤ 2 min, Flora ≤ 2 min, Ocorrências ≤ 30 min para 5M registros (SC-009). Streaming + bulk writes de 5–10k documentos por lote (SC-010). Metas válidas em ambas as plataformas (Windows 11 e Linux x86 amd64).
**Constraints**:

- Sem Docker, sem GitHub Actions, sem UI/HTTP server (FR-010).
- Sem credenciais comitadas (FR-008); `.env` local gitignorado (FR-007, FR-017).
- Binários autocontidos (FR-014); build local apenas (FR-020).
- Memória residente estável durante processamento de ocorrências.
- Todo trabalho comitado em `main` — nenhum branch novo (FR-015).

**Scale/Scope**: Operador único (Eduardo); execução manual sob demanda; 3 fontes IPT; volume máximo esperado ~5M ocorrências por DwC-A; ~milhares de táxons em fauna+flora.

> Todas as decisões acima estão consolidadas em [research.md](./research.md). Nenhuma `NEEDS CLARIFICATION` permanece.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

A constituição formal (`.specify/memory/constitution.md`) está em estado de template. Os gates de fato derivam de:

1. **CLAUDE.md global do usuário** (regras pessoais persistentes).
2. **CLAUDE.md do projeto** (princípios documentados no repo).
3. **Spec atual** (constraints explícitos).

### Gates derivados

| Gate                                      | Origem                    | Status                                                                                                |
| ----------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Apenas branch `main`                      | CLAUDE.md global + FR-015 | ✅ Spec mora em `specs/001-refactor-acquisition/` em `main`; plan e implementação seguirão            |
| Nunca commitar credenciais                | CLAUDE.md global + FR-008 | ✅ `.env` em `.gitignore` (FR-017); apenas `.env.example` com placeholders                            |
| Stack simples e enxuto                    | CLAUDE.md global          | ✅ 2 deps externas (mongo-driver, godotenv); resto é stdlib                                           |
| Sem Docker grande                         | CLAUDE.md global          | ✅ Sem Docker algum (FR-010)                                                                          |
| Tratar vulnerabilidades desde o início    | CLAUDE.md global + FR-016 | ✅ Validação de URL, HTTP timeout, deps mínimas, `gosec` opcional                                     |
| Best practices, eficiência, sem problemas | CLAUDE.md global          | ✅ `go.mongodb.org/mongo-driver/v2` (oficial), `slog` (stdlib), layout `cmd/internal` (idiomático Go) |
| Documentação atualizada                   | FR-012                    | ⏳ Pendente para fase de implementação (README, CLAUDE.md serão reescritos)                           |

**Resultado**: ✅ **PASS** — sem violações que exijam justificativa em `Complexity Tracking`.

## Project Structure

### Documentation (this feature)

```text
specs/001-refactor-acquisition/
├── spec.md              # Feature spec (já existe)
├── plan.md              # Este arquivo
├── research.md          # Phase 0: decisões técnicas
├── data-model.md        # Phase 1: schemas das coleções
├── quickstart.md        # Phase 1: bootstrap do operador
├── contracts/
│   ├── cli.md           # Phase 1: contrato CLI dos 3 binários
│   └── collections.md   # Phase 1: contrato de leitura do MongoDB
├── checklists/
│   └── requirements.md  # Quality checklist (já existe)
└── tasks.md             # Phase 2: gerado por /speckit.tasks (NÃO criado aqui)
```

### Source Code (repository root, **após** a limpeza completa)

```text
biodiversidade-online/
├── cmd/
│   ├── update-fauna/
│   │   └── main.go              # entry point: chama ingest.Run("fauna", ...)
│   ├── update-flora/
│   │   └── main.go
│   └── update-occurrences/
│       └── main.go
├── internal/
│   ├── config/                  # carrega .env, valida vars obrigatórias
│   │   └── config.go
│   ├── dwca/                    # parser nativo de Darwin Core Archive
│   │   ├── archive.go           # zip + meta.xml + eml.xml
│   │   ├── reader.go            # streaming CSV reader por core/extension
│   │   ├── types.go             # structs do meta.xml
│   │   └── testdata/            # fixtures pequenas para testes
│   ├── ingest/                  # pipeline orchestration
│   │   ├── run.go               # Run(source, ctx) — entry function
│   │   ├── pipeline.go          # download → parse → transform → upsert → delete-not-seen
│   │   └── transform.go         # type coercions (datas, coordenadas, ints)
│   ├── mongostore/              # cliente MongoDB e operações de upsert/delete
│   │   ├── client.go            # mongo.Connect com options.Client
│   │   ├── upsert.go            # BulkWrite com ReplaceOneModel + SetUpsert
│   │   ├── delete_not_seen.go   # DeleteMany por _runId != currentRunId
│   │   └── audit.go             # writer de ingest_runs
│   ├── verbose/                 # helpers de log estruturado
│   │   └── logger.go
│   └── version/
│       └── version.go           # injeta git sha via -ldflags
├── specs/                       # spec docs (este folder)
├── .env.example                 # placeholders genéricos
├── .gitignore                   # inclui .env, *.exe, bin/, /cache
├── .editorconfig
├── go.mod
├── go.sum
├── README.md                    # reescrito refletindo o novo escopo
└── CLAUDE.md                    # reescrito refletindo o novo escopo
```

### Estrutura **a ser removida** durante a limpeza (US4)

```text
packages/web/             ❌ remover (Astro/React/Tailwind/ChatBB/API)
packages/transform/       ❌ remover (loaders e enrichers)
packages/ingest/          ❌ remover (será substituído por cmd/ + internal/)
packages/shared/          ❌ remover (utilitários TS — código Go terá os próprios em internal/)
patches/                  ❌ remover (patches de pacotes Bun)
scripts/                  ❌ remover (scripts Python utilitários)
.github/workflows/        ❌ remover (todos os workflows)
docs/                     ❌ remover ou esvaziar (histórico vai para git log)
bun.lock, package.json    ❌ remover (root do monorepo)
tsconfig*.json            ❌ remover
.claude/                  ⚠️ manter apenas se quisermos preservar skills locais; remover settings antigos
.specify/                 ✅ manter (workflow speckit segue ativo para futuras features)
```

**Structure Decision**: Layout Go **standard** com `cmd/` para entries e `internal/` para pacotes coesos compartilhados pelos três binários. Esta organização:

- Maximiza reuso (≥95% do código vive em `internal/`).
- Cada `main.go` tem ~30 linhas: bootstrap (config, logger, signal handling) + chamada para `ingest.Run(source)`.
- `internal/` é privado ao módulo (Go enforça) — impede uso externo acidental.
- Build com `go build ./cmd/...` produz os três `.exe` em uma chamada.

## Phase 0: Outline & Research

✅ **Concluído** — ver [research.md](./research.md). Decisões registradas:

- Go 1.22+, `mongo-driver/v2`, parser DwC-A nativo (stdlib), `godotenv`, `log/slog`, stdlib `flag`.
- Layout `cmd/` + `internal/` com 6 pacotes internos.
- Estratégia download (HTTP retry exponencial), bulk batch 5k default, delete-not-seen via `_runId` (UUID v7), exit codes padronizados.
- Testes mínimos com stdlib `testing` (parser + transformações).
- Build com `-trimpath -ldflags="-s -w"` para ambas as plataformas:
  - Windows: `GOOS=windows GOARCH=amd64 go build ... -o bin\ ./cmd/...`
  - Linux: `GOOS=linux   GOARCH=amd64 go build ... -o bin/ ./cmd/...`

## Phase 1: Design & Contracts

✅ **Concluído**:

- [data-model.md](./data-model.md) — schemas detalhados de `taxa`, `occurrences`, `ingest_runs`; índices recomendados; lifecycle de runs e documentos; políticas de validação.
- [contracts/cli.md](./contracts/cli.md) — flags, env vars, exit codes, formato de log, garantias de idempotência.
- [contracts/collections.md](./contracts/collections.md) — contrato de leitura para consumidores externos.
- [quickstart.md](./quickstart.md) — guia de bootstrap em ≤ 15 min.

### Atualização do agent context

Será executado: `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` para refletir nova stack (Go) no `CLAUDE.md`.

## Re-evaluation: Constitution Check (post-design)

| Gate                      | Status pós-design                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Branch main-only          | ✅ Mantido. Plano não introduz nada que precise de branches.                           |
| Sem credenciais comitadas | ✅ `.env.example` com placeholders; `MONGO_URI` lida em runtime.                       |
| Stack simples             | ✅ 2 deps externas total. Sem libs desnecessárias (sem cobra, viper, zap, testify).    |
| Sem Docker                | ✅ Confirmado.                                                                         |
| Vulnerabilidades          | ✅ Endereçado: HTTP timeout, URL validation, deps fixas em `go.mod`, `gosec` opcional. |
| Best practices Go         | ✅ Layout idiomático (`cmd/` + `internal/`); `slog`; `flag`; `mongo-driver/v2`.        |

**Resultado pós-design**: ✅ **PASS**. Nenhuma violação. `Complexity Tracking` permanece vazio.

## Complexity Tracking

> Vazio — nenhuma violação de gates a justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | —          | —                                    |

---

## Próximos passos

1. **`/speckit.tasks`** — gerar `tasks.md` com a sequência ordenada de implementação (US1 → US4).
2. Após `tasks.md`: começar implementação. Sugestão de ordem (independente das US, baseada em dependências técnicas):
   - **Setup**: `go mod init`, `go.mod`, `.gitignore`, `.env.example`, esqueleto de pacotes.
   - **`internal/dwca`**: parser de DwC-A com testes de unidade.
   - **`internal/mongostore`**: cliente, upsert, delete-not-seen, audit.
   - **`internal/ingest`**: pipeline + transform.
   - **`cmd/update-fauna`**: primeiro binário (US1) — prova ponta-a-ponta.
   - **`cmd/update-flora`** (US2) e **`cmd/update-occurrences`** (US3) — variações triviais sobre US1.
   - **Limpeza completa do repo** (US4) — após validar os 3 binários funcionando.
   - **Reescrita de README.md e CLAUDE.md** (FR-012).
3. Cada passo será comitado direto em `main` com mensagens convencionais (`feat:`, `chore:`, `docs:`).
