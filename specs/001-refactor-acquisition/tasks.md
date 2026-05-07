---
description: 'Task list for Refatoração para Contexto de Aquisição Apenas'
---

# Tasks: Refatoração para Contexto de Aquisição Apenas

**Input**: Design documents from `/specs/001-refactor-acquisition/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Suite mínima de testes com stdlib `testing` para o parser DwC-A e os conversores de tipo (decisão de [research.md §14](./research.md)). Sem teste de integração com MongoDB real (validação manual via `mongosh`/scripts dedicados).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: User story a que pertence (US1, US2, US3, US4)
- Caminhos de arquivo absolutos relativos à raiz do repo

## Path Conventions

- Layout Go padrão: `cmd/<binary>/main.go` para entries; `internal/<package>/` para código compartilhado
- Specs: `specs/001-refactor-acquisition/`
- Pasta `bin/` (gitignorada) hospeda os binários após `go build` — `.exe` em Windows, sem extensão em Linux

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar módulo Go, criar layout de diretórios, gitignore e .env.example.

⚠️ **Atenção**: Este projeto está atualmente repleto de código TS/Astro/Bun do V6. **Não remover nada ainda** — a limpeza completa é US4 (Phase 6). Por enquanto, apenas adicionamos a nova estrutura Go ao lado.

- [x] T001 Inicializar módulo Go em `D:\git\Biodiversidade-Online\go.mod` com `go mod init biodiversidade-online` e diretiva `go 1.22`
- [x] T002 [P] Criar `D:\git\Biodiversidade-Online\.gitignore` (ou anexar) com: `.env`, `*.exe`, `bin/`, `cache/`, `*.test`, `coverage.out` — `bin/` cobre tanto os `.exe` (Windows) quanto binários sem extensão (Linux)
- [x] T003 [P] Criar `D:\git\Biodiversidade-Online\.env.example` com placeholders genéricos para `MONGO_URI`, `MONGO_DATABASE=dwc2json`, `IPT_FAUNA_URL`, `IPT_FLORA_URL`, `IPT_OCCURRENCES_URL`, `OCCURRENCES_SOURCE_ID`, `BULK_BATCH_SIZE=5000`, `LOG_LEVEL=info`, `LOG_FORMAT=text`, `HTTP_TIMEOUT_MIN=30`
- [x] T004 [P] Criar estrutura de diretórios vazios: `cmd/update-fauna/`, `cmd/update-flora/`, `cmd/update-occurrences/`, `internal/config/`, `internal/dwca/`, `internal/dwca/testdata/`, `internal/ingest/`, `internal/mongostore/`, `internal/verbose/`, `internal/version/`
- [x] T005 Adicionar dependências em `go.mod`: `go get go.mongodb.org/mongo-driver/v2@latest` e `go get github.com/joho/godotenv@latest`; rodar `go mod tidy`
- [x] T006 [P] Criar `D:\git\Biodiversidade-Online\.editorconfig` com convenções Go (tab indent, LF line endings, UTF-8) — NÃO remover .editorconfig existente; sobrescrever apenas se incompatível

**Checkpoint**: `go build ./...` deve rodar sem erro (mesmo com pacotes vazios), `.env.example` versionado, `.env` ignorado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar todos os pacotes em `internal/` que os três binários compartilham. Esta é a **fase mais densa** — depois dela, US1/US2/US3 são wrappers triviais.

**⚠️ CRITICAL**: Nenhum trabalho de user story (cmd/) pode começar antes desta fase concluir.

### Configuração e logging

- [x] T007 [P] Implementar `D:\git\Biodiversidade-Online\internal\verbose\logger.go`: wrapper de `log/slog` com `New(level, format)` retornando `*slog.Logger`; suporta `text` (colorido) e `json`; lê `LOG_LEVEL` e `LOG_FORMAT` se não passados
- [x] T008 [P] Implementar `D:\git\Biodiversidade-Online\internal\version\version.go`: variáveis exportadas `Commit`, `BuildDate`, `Version` populáveis via `-ldflags="-X 'biodiversidade-online/internal/version.Commit=...'"`; função `String()`
- [x] T009 Implementar `D:\git\Biodiversidade-Online\internal\config\config.go`: struct `Config` com campos para todas as env vars do `contracts/cli.md`; função `Load(path string, source string)` que carrega `.env` via `godotenv`, lê env, valida campos obrigatórios por `source`, retorna erro tipado com exit code `2` para vars faltando

### Parser DwC-A (núcleo, sem deps externas)

- [x] T010 [P] Implementar `D:\git\Biodiversidade-Online\internal\dwca\types.go`: structs Go que mapeiam `meta.xml` (`Archive`, `Core`, `Extension`, `Field` com atributos `index`, `term`, `default`); struct `EmlMetadata` com `PubDate`, `Version`, `Title`
- [x] T011 Implementar `D:\git\Biodiversidade-Online\internal\dwca\archive.go`: função `Open(zipPath)` retornando `*Archive` que abre o ZIP, parseia `meta.xml` e `eml.xml` via `encoding/xml`; método `CoreReader()`, `ExtensionReader(rowType)` retornam `Reader` (próxima task)
- [x] T012 Implementar `D:\git\Biodiversidade-Online\internal\dwca\reader.go`: tipo `Reader` com `Read() (Record, error)` em streaming via `csv.Reader`; respeita `fieldsTerminatedBy`, `linesTerminatedBy`, `encoding` de `meta.xml`; converte índice→termo DwC; retorna `io.EOF` ao final
- [x] T013 Implementar `D:\git\Biodiversidade-Online\internal\dwca\download.go`: função `Download(ctx, url, cacheDir)` que faz HTTP GET com timeout configurável, retry exponencial (3 tentativas, 1s/4s/16s) em 5xx/timeout, salva em `<cacheDir>/<sourceFromURL>.zip`, retorna path local; valida `url` via `url.Parse` antes
- [x] T014 [P] Criar fixture mínima de DwC-A em `D:\git\Biodiversidade-Online\internal\dwca\testdata\sample.zip` (ZIP com `meta.xml`, `eml.xml`, `taxa.txt` de 5 linhas) e helper `mkfixture.go` (build-tag `ignore`) que regenera o fixture
- [x] T015 Escrever `D:\git\Biodiversidade-Online\internal\dwca\archive_test.go`: testa `Open` com fixture, valida campos parseados de `meta.xml` e `eml.xml`
- [x] T016 Escrever `D:\git\Biodiversidade-Online\internal\dwca\reader_test.go`: testa `Reader.Read` lê linhas corretamente, mapeia coluna→termo, retorna EOF ao final, lida com encoding alternativo

### MongoDB store

- [x] T017 [P] Implementar `D:\git\Biodiversidade-Online\internal\mongostore\client.go`: função `Connect(ctx, uri, dbName)` que usa `mongo.Connect(options.Client().ApplyURI(uri))` e retorna `*Store` com handles para `taxa`, `occurrences`, `ingest_runs`; método `Close(ctx)`
- [x] T018 [P] Implementar `D:\git\Biodiversidade-Online\internal\mongostore\uuidv7.go`: função `NewRunID()` que gera UUID v7 (timestamp-prefixed) usando `crypto/rand`; sem deps externas
- [x] T019 Implementar `D:\git\Biodiversidade-Online\internal\mongostore\upsert.go`: função `BulkUpsert(ctx, coll, docs []bson.M, runID, source)` que monta `[]mongo.WriteModel` com `mongo.NewReplaceOneModel().SetFilter(bson.D{{"_id", id}}).SetReplacement(doc).SetUpsert(true)`; cada doc recebe `_runId`, `source`, `ingestedAt` injetados; chama `BulkWrite` com `SetOrdered(false)`; retorna contadores
- [x] T020 Implementar `D:\git\Biodiversidade-Online\internal\mongostore\delete_not_seen.go`: função `DeleteNotSeen(ctx, coll, source, runID)` que executa `DeleteMany({source: source, _runId: {$ne: runID}})`; retorna contagem deletada
- [x] T021 Implementar `D:\git\Biodiversidade-Online\internal\mongostore\audit.go`: tipo `RunRecord` espelhando schema de `ingest_runs` ([data-model.md §3](./data-model.md#3-coleção-ingest_runs)); função `WriteRun(ctx, run RunRecord)` faz `InsertOne` em `ingest_runs`; função `LastSuccessfulRun(ctx, source)` retorna o último doc com `status:"success"` para o aviso de versão idêntica (FR-019)

### Ingest pipeline (compartilhado)

- [x] T022 Implementar `D:\git\Biodiversidade-Online\internal\ingest\transform.go`: funções puras de coerção — `parseDate(string) (time.Time, bool)` (aceita `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, e ranges `YYYY-MM-DD/YYYY-MM-DD`); `parseFloat(string) (float64, bool)`; `parseInt(string) (int, bool)`; `coerceRecord(record map[string]string, schema CollectionSchema) bson.M` aplica conversões e omite valores vazios
- [x] T023 [P] Escrever `D:\git\Biodiversidade-Online\internal\ingest\transform_test.go`: cobre todos os formatos de data DwC, números válidos/inválidos, range de coordenadas suspeitas, omissão de strings vazias
- [x] T024 Implementar `D:\git\Biodiversidade-Online\internal\ingest\pipeline.go`: função `Run(ctx, cfg Config, source string, dryRun bool, log *slog.Logger) (RunRecord, error)` orquestrando: download → open archive → ler eml → checar versão idêntica → iniciar runID → loop de leitura+upsert em lotes de `cfg.BulkBatchSize` → delete-not-seen → preencher RunRecord. Retorna RunRecord mesmo em erro (para auditoria)
- [x] T025 Implementar `D:\git\Biodiversidade-Online\internal\ingest\schema.go`: enum `Source` (Fauna, Flora, Occurrences) com método `Collection() string` (`taxa` para fauna/flora; `occurrences` para occurrences) e `IDField() string` (`taxonID` ou `occurrenceID`); função `RowTypeForSource(source)` retorna o `rowType` DwC esperado no `meta.xml` core

### Tratamento de sinais

- [x] T026 Implementar `D:\git\Biodiversidade-Online\internal\verbose\signals.go`: função `WithCancellation(ctx)` retorna `(ctx, cancel)` onde SIGINT/SIGTERM chama `cancel()` e loga "interrupcao recebida"; usado pelos `main.go`

**Checkpoint**: Toda a infraestrutura compartilhada está implementada e testada. `go test ./internal/...` passa. Os pacotes `internal/dwca` e `internal/ingest` têm cobertura de teste para conversores e parser.

---

## Phase 3: User Story 1 - Atualizar coleção `taxa` com Fauna (Priority: P1) 🎯 MVP

**Goal**: Operador executa `update-fauna.exe` em Windows; `taxa` é populada com registros de fauna do IPT, marca `source:"fauna"`, com logs verbosos.

**Independent Test**: Rodar `update-fauna.exe`; validar `db.taxa.countDocuments({source: "fauna"}) > 0` e `db.ingest_runs.find({source:"fauna", status:"success"}).count() === 1`.

### Implementation for User Story 1

- [x] T027 [US1] Implementar `D:\git\Biodiversidade-Online\cmd\update-fauna\main.go`: parse flags (`--dry-run`, `--config`, `--log-level`, `--version`, `--help`); inicializar logger; carregar config para `source="fauna"`; conectar ao Mongo; chamar `ingest.Run(ctx, cfg, "fauna", dryRun, log)`; usar `defer` para gravar `RunRecord` em `ingest_runs` independente do resultado; mapear erros para exit codes do contrato CLI (`contracts/cli.md`)
- [ ] T028 [US1] Validar manualmente em **Windows** (`GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-fauna`) e/ou **Linux** (`GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-fauna`); rodar com `.env` configurado e MongoDB acessível; checar logs verbosos em cada etapa; validar contagens em `mongosh` (`db.taxa.countDocuments({source: "fauna"})` > 0 e bate com `recordsRead` em `ingest_runs`)
- [ ] T029 [US1] Validar idempotência: rodar `update-fauna.exe` duas vezes seguidas; confirmar mesmo `countDocuments` final, `recordsRemoved=0` na segunda run, e aviso "versão idêntica" no log

**Checkpoint**: US1 funciona ponta-a-ponta. **MVP entregue.** Operador pode usar update-fauna em produção mesmo sem US2/US3.

---

## Phase 4: User Story 2 - Atualizar coleção `taxa` com Flora (Priority: P1)

**Goal**: Operador executa `update-flora.exe`; `taxa` recebe registros de flora com `source:"flora"`, sem afetar registros de fauna.

**Independent Test**: Rodar `update-flora.exe` em ambiente que já tem fauna carregada; validar `db.taxa.countDocuments({source:"flora"}) > 0` E `db.taxa.countDocuments({source:"fauna"})` permanece igual ao snapshot anterior.

### Implementation for User Story 2

- [x] T030 [US2] Implementar `D:\git\Biodiversidade-Online\cmd\update-flora\main.go`: idêntico em estrutura ao update-fauna, mas chama `ingest.Run(ctx, cfg, "flora", dryRun, log)` e exige `IPT_FLORA_URL`. Recomendado: extrair função comum para `internal/cliboot/Boot()` se ficar duplicação visível entre os 3 mains
- [ ] T031 [US2] Validar manualmente: build, rodar com fauna já presente, confirmar isolamento entre `source:"fauna"` e `source:"flora"` (queries `db.taxa.aggregate([{$group:{_id:"$source", n:{$sum:1}}}])` retorna duas linhas com contagens corretas)
- [ ] T032 [US2] Validar delete-not-seen escopado: simular registro removido do IPT (modificando fixture local em ambiente de teste); rodar update-flora; confirmar que apenas registros `source:"flora"` ausentes do DwC-A foram removidos, fauna intacta

**Checkpoint**: Coleção `taxa` opera com fauna+flora harmonizadas; cada binário só toca em seus próprios registros.

---

## Phase 5: User Story 3 - Atualizar coleção `occurrences` (Priority: P1)

**Goal**: Operador executa `update-occurrences.exe`; `occurrences` é populada via streaming + bulk writes; uso de memória estável; tempo dentro de SC-009 (≤ 30 min para 5M registros).

**Independent Test**: Rodar com DwC-A grande (idealmente 1M+ registros); validar contagem final, observar uso de RAM via Task Manager (deve permanecer ~estável), tempo total dentro do alvo.

### Implementation for User Story 3

- [x] T033 [US3] Implementar `D:\git\Biodiversidade-Online\cmd\update-occurrences\main.go`: idêntico aos anteriores, mas com `source` derivado de `OCCURRENCES_SOURCE_ID` (default `"occurrences"`) lido do `.env`; exige `IPT_OCCURRENCES_URL`
- [x] T034 [US3] Adicionar log de progresso periódico em `internal/ingest/pipeline.go`: a cada N (ex.: 50000) registros lidos, emite `INFO` com `records_processed`, `elapsed_sec`, `rate_per_sec` — específico para volumes altos. Verificar que NÃO duplica logs em fauna/flora (talvez emitir só se `total > threshold`)
- [ ] T035 [US3] Validar performance contra SC-009: rodar com DwC-A real (>1M registros); medir tempo total e pico de RSS via PowerShell `(Get-Process update-occurrences).WorkingSet64`; confirmar streaming (RSS estável, não crescendo linearmente)
- [ ] T036 [US3] Validar tratamento de coordenadas suspeitas: confirmar que registros com `decimalLatitude` fora de `[-90,90]` são gravados mas contabilizados em `recordsWithSuspectCoordinates` no `ingest_runs`; logs WARN aparecem (no nível DEBUG, não poluindo INFO)

**Checkpoint**: Os três binários funcionam. Banco `dwc2json` está completamente populado por execução manual dos 3 scripts.

---

## Phase 6: User Story 4 - Limpeza completa do repositório (Priority: P2)

**Goal**: Repositório reduzido ao mínimo essencial; tudo de Enriquecimento/Apresentação removido; documentação reescrita.

**Independent Test**: `git status` após a limpeza não mostra rastros de Astro/React/Bun/Docker/Actions; `ls D:\git\Biodiversidade-Online` mostra apenas estrutura Go + specs + docs essenciais; README e CLAUDE.md descrevem apenas o novo escopo.

⚠️ **CRITICAL**: Esta fase só começa após US1, US2, US3 validados em ambiente real. Apagar antes pode quebrar referências.

### Remoções (ordem indiferente, todas paralelizáveis)

- [ ] T037 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\packages\web\` (Astro/React/Tailwind/ChatBB/Dashboard/API)
- [ ] T038 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\packages\transform\` (loaders e enrichers)
- [ ] T039 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\packages\ingest\` (TS — substituído por `cmd/` e `internal/`)
- [ ] T040 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\packages\shared\` (utilitários TS)
- [ ] T041 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\packages\` se ficar vazio
- [ ] T042 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\.github\workflows\` (todos os workflows; manter `.github/` apenas se houver outros recursos relevantes)
- [ ] T043 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\patches\` (patches de pacotes Bun)
- [ ] T044 [P] [US4] Remover diretório `D:\git\Biodiversidade-Online\scripts\` (scripts Python utilitários)
- [ ] T045 [P] [US4] Remover arquivos raiz: `D:\git\Biodiversidade-Online\bun.lock`, `D:\git\Biodiversidade-Online\package.json`, `D:\git\Biodiversidade-Online\tsconfig.json`, `D:\git\Biodiversidade-Online\tsconfig.base.json`
- [ ] T046 [P] [US4] Avaliar `D:\git\Biodiversidade-Online\docs\`: mover histórico relevante para `specs/001-refactor-acquisition/historical/` se útil; senão remover. Histórico completo permanece em `git log`

### Reescrita de documentação

- [ ] T047 [US4] Reescrever `D:\git\Biodiversidade-Online\README.md`: descrever a nova plataforma minimalista; instruções de bootstrap apontando para `specs/001-refactor-acquisition/quickstart.md`; lista dos 3 scripts; estrutura do repo; licença
- [ ] T048 [US4] Reescrever `D:\git\Biodiversidade-Online\CLAUDE.md`: substituir conteúdo V6 (Bun/Astro/monorepo) pelo V7 (Go/CLI/aquisição apenas); incluir comandos `go build`, `go test`, layout de pacotes, regra de só-`main`, regra de credenciais em `.env` local
- [ ] T049 [US4] Verificar `.gitignore` final cobre: `.env`, `*.exe`, `bin/`, `cache/`, `*.test`, `coverage.out`, e qualquer artefato Go que possa surgir (`vendor/` se aparecer)

### Validação da limpeza

- [ ] T050 [US4] Rodar `git status` e `Get-ChildItem -Recurse | Measure-Object Length -Sum` antes/depois; documentar redução de tamanho em commit message (SC-008)
- [ ] T051 [US4] Verificar `go build ./cmd/...` segue funcionando após a limpeza (regressão técnica)
- [ ] T052 [US4] Inspeção final: nenhum arquivo `.tsx`, `.astro`, `Dockerfile`, `package.json`, `bun.lock` permanece (`Get-ChildItem -Recurse -Include *.tsx,*.astro,Dockerfile,package.json,bun.lock` retorna vazio)

**Checkpoint**: Repositório espelha a simplicidade do novo escopo. SC-004 e SC-008 atendidos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, validação contra critérios mensuráveis, e preparação para uso recorrente.

- [x] T053 [P] Auditoria de segurança: rodar `go vet ./...` e `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`; resolver achados de severidade ≥ MEDIUM
- [x] T054 [P] Auditoria de dependências: `go list -json -m all` revisado manualmente; confirmar que `mongo-driver/v2` e `godotenv` são as únicas deps externas diretas; sem CVEs ativos via `govulncheck ./...`
- [ ] T055 [P] Verificar SC-009 (alvos de tempo) com mensuração formal: rodar 3× cada binário em hardware típico em ambas as plataformas (Windows 11 e Linux x86), registrar tempos, anexar resultados a `specs/001-refactor-acquisition/perf-validation.md`
- [x] T056 [P] Verificar SC-007 (sem credenciais no histórico): rodar `git log -p --all | Select-String -Pattern "mongodb://"` e `gh secret-scanning` se disponível; resultado esperado: zero matches reais (apenas placeholders de `.env.example`)
- [ ] T057 Executar quickstart.md ponta-a-ponta em ambiente limpo, idealmente em **ambas as plataformas** (VM Windows 11 e VM/container Linux x86): clone → build com flag de plataforma correta → `.env` → primeira execução; cronometrar para validar SC-005 (≤ 15 min por plataforma)
- [ ] T058 [P] Adicionar arquivo `D:\git\Biodiversidade-Online\LICENSE` se ainda não existir (manter licença original do projeto se houver)
- [ ] T059 Commit final em `main` agregando documentação refletindo o release V7; tag opcional `v7.0.0`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende de Setup completo — **BLOQUEIA** todas as user stories
- **User Stories Phase 3-5 (US1, US2, US3)**: Todas dependem de Foundational completo
  - Podem ser implementadas em **paralelo** se houver mais de uma pessoa, ou em sequência P1→P1→P1
  - **Recomendação prática**: implementar US1 primeiro (prova ponta-a-ponta), depois US2 (clone trivial), depois US3 (caso especial de volume)
- **User Story 4 (Phase 6)**: Depende de US1, US2, US3 **validadas em ambiente real**
- **Polish (Phase 7)**: Depende de Phase 6 completa

### User Story Dependencies

- **US1 (Fauna)**: Depende apenas de Foundational. Independente das outras.
- **US2 (Flora)**: Depende apenas de Foundational. Compartilha código (`internal/ingest`) com US1, mas é binário separado com env var diferente.
- **US3 (Ocorrências)**: Depende apenas de Foundational. Difere por volume (logs de progresso, validação de coordenadas).
- **US4 (Limpeza)**: Depende de US1+US2+US3 funcionando. Não há dependência técnica circular — apenas validação operacional.

### Within Each User Story

- Modelos de dados: gravados em `internal/` durante Foundational (compartilhados)
- Entry point `cmd/<binary>/main.go`: pequeno, depende de TODO o `internal/`
- Validação manual: depende do binário compilado e MongoDB acessível

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T006 podem rodar em paralelo após T001
- **Phase 2** (Foundational):
  - T007 (logger), T008 (version), T010 (dwca/types), T017 (mongostore/client), T018 (uuidv7), T023 (transform_test), T014 (testdata) são todos paralelizáveis (arquivos diferentes, sem deps cruzadas)
  - T009 (config) depende de T007 (usa logger); T011 (archive.go) depende de T010
  - T015, T016 dependem de T011, T012, T014
  - T019, T020, T021 dependem de T017
  - T022 é independente; T023 depende de T022
  - T024 (pipeline.go) depende de quase tudo do internal/
- **Phases 3-5**: Se houver várias pessoas, US1, US2, US3 podem ser paralelas após Foundational. Em projeto solo: sequencial.
- **Phase 6**: T037-T046 (deleções) são todas paralelas — diretórios independentes
- **Phase 7**: T053, T054, T055, T056, T058 podem rodar em paralelo

---

## Parallel Example: Foundational (Phase 2)

```bash
# Após T001-T006 (Setup), lançar em paralelo:
Task: "Implementar internal/verbose/logger.go (T007)"
Task: "Implementar internal/version/version.go (T008)"
Task: "Implementar internal/dwca/types.go (T010)"
Task: "Implementar internal/mongostore/client.go (T017)"
Task: "Implementar internal/mongostore/uuidv7.go (T018)"

# Após T010 + T011 + T012 + T014:
Task: "Escrever internal/dwca/archive_test.go (T015)"
Task: "Escrever internal/dwca/reader_test.go (T016)"

# Após T017:
Task: "Implementar internal/mongostore/upsert.go (T019)"
Task: "Implementar internal/mongostore/delete_not_seen.go (T020)"
Task: "Implementar internal/mongostore/audit.go (T021)"

# Após T022:
Task: "Escrever internal/ingest/transform_test.go (T023)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Phase 1 (Setup)** — ~1h. Inicializa Go module, gitignore, env.example.
2. **Phase 2 (Foundational)** — ~6-10h. Toda a infraestrutura compartilhada.
3. **Phase 3 (US1 - Fauna)** — ~1-2h. Wrapper main + validação manual.
4. **STOP e VALIDATE**: Operador roda `update-fauna.exe` em ambiente real. Confere `taxa` populada, `ingest_runs` registrado, idempotência.
5. **MVP entregue.** Operador já pode usar fauna em produção.

### Incremental Delivery

1. Setup + Foundational completos → base pronta
2. US1 → validar → commit em `main` (MVP fauna)
3. US2 → validar → commit em `main` (flora harmonizada com fauna)
4. US3 → validar → commit em `main` (ocorrências em produção)
5. US4 → executar limpeza → commit em `main` (repositório enxuto)
6. Polish → commits incrementais finais

### Parallel Team Strategy

**Não aplicável** neste projeto — operador único, sem time. Estratégia recomendada: **sequencial em sessões focadas**, com `git commit` após cada task ou bloco lógico.

---

## Notes

- **[P]** = arquivos diferentes, sem dependências; pode ser delegado ou pulado entre tasks sem ordem rígida
- **[Story]** = mapeia para user story específica para rastreabilidade
- Cada user story deve ser independentemente testável e completável
- **Nunca criar branch** — todos os commits vão para `main` (regra global do projeto, FR-015)
- **Commitar após cada task ou grupo lógico**; mensagens convencionais (`feat:`, `chore:`, `test:`, `docs:`)
- Parar em qualquer checkpoint para validar a story isoladamente
- **Limpeza (Phase 6) é destrutiva** — confirmar com o operador antes de cada `Remove-Item -Recurse` e contar com `git log` para recuperação se necessário
- **Não introduzir libs externas além de `mongo-driver/v2` e `godotenv`** sem revisar se stdlib resolve (FR-016)
- **Validação manual ≠ ausência de testes**: testes unitários do parser DwC-A e dos conversores são obrigatórios (T015, T016, T023)
