# Tasks: Reestruturação de Dados - Ingestão Integrada com Transformação (v2)

**Input**: Design documents from `/specs/003-data-restructure/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Somente gere tarefas de teste se solicitado explicitamente (não requisitado nesta feature). Validação será manual via quickstart.

**Organization**: Tasks são agrupadas por fase para permitir implementação e validação incremental. Cada história de usuário possui seu próprio conjunto de tarefas independentes.

**Architecture Change**: Transformação é integrada no processo de ingestão. Scripts de ingestão importam e executam funções de transformação imediatamente após inserir dados brutos. Workflows de transformação separados servem apenas para re-processamento em massa (quando lógica muda).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode ser executada em paralelo (arquivos distintos, sem dependências bloqueadoras)
- **[Story]**: História de usuário responsável (US1, US2, ...). Fases de Setup/Foundational/Polish não usam etiqueta de história.
- Inclua caminhos de arquivos exatos na descrição de cada tarefa

---

## Phase 1: Setup (Shared Infrastructure Package)

**Purpose**: Criar pacote `packages/shared` para código compartilhado entre ingest e transform, evitando dependências cíclicas.

- [x] T001 Criar `packages/shared/package.json` com dependências mínimas (mongodb, bson, types) referenciando catálogo da raiz
- [x] T002 Criar `packages/shared/tsconfig.json` estendendo `../../tsconfig.base.json` e expondo `src` como rootDir/outDir
- [x] T003 [P] Mover `packages/ingest/src/utils/deterministic-id.ts` para `packages/shared/src/utils/deterministic-id.ts` mantendo exportações públicas
- [x] T004 [P] Criar `packages/shared/src/lib/database.ts` com fábrica de conexão MongoDB compartilhada (pool + carregamento de `MONGO_URI`)
- [x] T005 [P] Criar `packages/shared/src/config/collections.ts` centralizando nomes de coleções raw (`taxa_ipt`, `occurrences_ipt`) e transformadas (`taxa`, `occurrences`)
- [x] T006 [P] Criar `packages/shared/src/lib/metrics.ts` registrando métricas na coleção `process_metrics`
- [x] T007 Criar `packages/shared/src/index.ts` exportando todas funções públicas (deterministic-id, database, collections, metrics)
- [x] T008 Atualizar `package.json` na raiz para registrar workspace `@darwincore/shared` e adicionar referência em `tsconfig.json`

---

## Phase 2: Transform Package Foundation

**Purpose**: Configurar pacote de transformação com funções exportáveis (para uso por ingest) e CLI para re-processamento em massa.

- [x] T009 Atualizar `packages/transform/package.json` adicionando dependência `@darwincore/shared: "workspace:*"` e removendo `@darwincore/ingest`
- [x] T010 Criar `packages/transform/src/lib/concurrency.ts` implementando controle de locks na coleção `transform_status`
- [x] T011 Criar `packages/transform/src/taxa/normalizeTaxon.ts` migrando normalizações de táxons (canonicalName, flatScientificName, vernacularname, distribution)
- [x] T012 [P] Criar `packages/transform/src/taxa/enrichTaxon.ts` implementando enriquecimentos (ameaça, invasoras, UCs, kingdom fauna)
- [x] T013 Criar `packages/transform/src/taxa/transformTaxonRecord.ts` exportando função `transformTaxonRecord(rawDoc, db)` que recebe documento de `taxa_ipt` e retorna documento transformado para `taxa` (inclui normalização + enriquecimento, preserva `_id`)
- [x] T014 [P] Criar `packages/transform/src/occurrences/normalizeOccurrence.ts` implementando normalizações (geoPoint, datas, país/estado, iptKingdoms, canonicalName)
- [x] T015 [P] Criar `packages/transform/src/occurrences/enrichOccurrence.ts` implementando enriquecimentos (taxon lookup, collector parsing com fallback, filtro Brasil, reproductiveCondition)
- [x] T016 Criar `packages/transform/src/occurrences/transformOccurrenceRecord.ts` exportando função `transformOccurrenceRecord(rawDoc, db)` que recebe documento de `occurrences_ipt` e retorna documento transformado para `occurrences` (inclui normalização + enriquecimento, preserva `_id`)
- [x] T017 Atualizar `packages/transform/src/index.ts` exportando funções públicas: `transformTaxonRecord`, `transformOccurrenceRecord`

---

## Phase 3: User Story 1 - Ingestão e Transformação Integrada de Taxa (Priority: P1) 🎯 MVP

**Goal**: Baixar dados de Flora/Fauna, inserir em `taxa_ipt` (raw) e imediatamente transformar e inserir em `taxa`, tudo no mesmo processo.

**Independent Test**: Executar `bun run ingest:flora` e `bun run ingest:fauna`, confirmar inserções em `taxa_ipt` e `taxa`, verificar `_id` idêntico entre coleções, validar transformações aplicadas (canonicalName, filtros, enriquecimentos).

- [x] T018 [US1] Atualizar `packages/ingest/package.json` adicionando dependências `@darwincore/shared: "workspace:*"` e `@darwincore/transform: "workspace:*"`
- [x] T019 [US1] Refatorar `packages/ingest/src/flora.ts` para: (a) importar `transformTaxonRecord` de `@darwincore/transform`, (b) importar utilidades de `@darwincore/shared`, (c) após inserir registro bruto em `taxa_ipt`, chamar `transformTaxonRecord` e fazer upsert em `taxa` (mesmo `_id`), (d) registrar métricas separadas para ingestão e transformação
- [x] T020 [P] [US1] Refatorar `packages/ingest/src/fauna.ts` espelhando estrutura de flora.ts: importar de shared/transform, inserir raw, transformar inline, upsert em `taxa`, registrar métricas

---

## Phase 4: User Story 2 - Ingestão e Transformação Integrada de Ocorrências (Priority: P1)

**Goal**: Processar 507 recursos DwC-A, inserir em `occurrences_ipt` (raw) e imediatamente transformar e inserir em `occurrences`. Transformação acontece por batch: após cada batch de ~5000 registros ser inserido em `occurrences_ipt`, o mesmo batch é transformado inline e inserido em `occurrences` antes de processar próximo batch.

**Independent Test**: Executar `bun run ingest:occurrences`, confirmar todos IPTs processados, registros em `occurrences_ipt` e `occurrences`, `_id` preservado, transformações aplicadas (geoPoint, normalização, vinculação taxonômica). Observar logs mostrando "TRANSFORM: inseridos=X, atualizados=Y" após cada IPT.

- [x] T021 [US2] Refatorar `packages/ingest/src/ocorrencia.ts` para: (a) importar `transformOccurrenceRecord` de `@darwincore/transform`, (b) importar utilidades de `@darwincore/shared`, (c) após inserir registro bruto em `occurrences_ipt`, chamar `transformOccurrenceRecord` e fazer upsert em `occurrences` (mesmo `_id`), (d) implementar tratamento de erros para continuar processamento se transformação de registro individual falhar, (e) registrar métricas separadas para ingestão e transformação

---

## Phase 5: User Story 3 - Re-transformação em Massa (Priority: P2)

**Goal**: Permitir re-executar transformação sobre todos dados brutos quando lógica de transformação mudar, usando CLI standalone.

**Independent Test**: Modificar arquivo em `packages/transform`, incrementar versão, executar `bun run transform:taxa` ou workflow GitHub Actions, verificar todos registros reprocessados.

- [x] T022 [US3] Criar `packages/transform/src/taxa/transformTaxa.ts` implementando pipeline de re-transformação em massa: (a) adquirir lock via concurrency.ts, (b) iterar todos documentos em `taxa_ipt` por lotes, (c) chamar `transformTaxonRecord` para cada um, (d) fazer bulk upsert em `taxa`, (e) liberar lock, (f) registrar métricas
- [x] T023 [P] [US3] Criar `packages/transform/src/occurrences/transformOccurrences.ts` implementando pipeline de re-transformação em massa: (a) lock, (b) leitura por lotes de `occurrences_ipt`, (c) chamar `transformOccurrenceRecord`, (d) bulk upsert em `occurrences`, (e) liberar lock, (f) métricas
- [x] T024 [US3] Criar `packages/transform/src/cli/runTransform.ts` orquestrando locks, métricas e execução de pipelines (taxa vs occurrences baseado em argumento CLI)
- [x] T025 [P] [US3] Criar `packages/transform/src/cli/checkLock.ts` expondo utilitário CLI para validar/forçar liberação de locks
- [x] T026 Atualizar scripts em `packages/transform/package.json`: `taxa` → `bun src/cli/runTransform.ts taxa`, `occurrences` → `bun src/cli/runTransform.ts occurrences`, `check-lock` → `bun src/cli/checkLock.ts`

---

## Phase 6: User Story 4 - Exposição de APIs RESTful (Priority: P3)

**Goal**: Expor endpoints REST documentados (Swagger) para consultar `taxa` e `occurrences`.

**Independent Test**: Acessar `/api/docs`, executar chamadas para `/api/taxa`, `/api/taxa/{id}`, `/api/occurrences`, `/api/occurrences/count`, `/api/occurrences/geojson` e validar respostas.

- [x] T027 [US4] Atualizar `packages/web/src/pages/api/taxa.ts` para novos filtros, paginação e consulta à coleção `taxa`
- [x] T028 [P] [US4] Criar `packages/web/src/pages/api/taxa/[taxonID].ts` retornando táxon por `_id`
- [x] T029 [P] [US4] Criar `packages/web/src/pages/api/taxa/count.ts` fornecendo contagem filtrada
- [x] T030 [US4] Atualizar `packages/web/src/pages/api/occurrences.ts` para filtros combinados, bbox e consulta à coleção `occurrences`
- [x] T031 [P] [US4] Criar `packages/web/src/pages/api/occurrences/[occurrenceID].ts` retornando ocorrência por `_id`
- [x] T032 [P] [US4] Criar `packages/web/src/pages/api/occurrences/count.ts` alinhado ao contrato de contagem
- [x] T033 [P] [US4] Criar `packages/web/src/pages/api/occurrences/geojson.ts` gerando FeatureCollection limitada
- [x] T034 [US4] Atualizar `packages/web/public/api-spec.json` refletindo novos endpoints, parâmetros e esquemas

---

## Phase 7: User Story 5 - Adaptação da Interface Web (Priority: P3)

**Goal**: Atualizar páginas web (taxa, mapa, dashboard, tree, chat) para consumir APIs novas mantendo UX e performance atuais.

**Independent Test**: Navegar em `/taxa`, `/mapa`, `/dashboard`, `/tree`, `/chat`, validar carregamento correto dos dados e respostas em tempo aceitável.

- [x] T035 [US5] Ajustar `packages/web/src/pages/taxa.astro` para consumir `/api/taxa` com filtros e paginação renovados
- [x] T036 [P] [US5] Ajustar `packages/web/src/pages/mapa.astro` para usar `/api/occurrences/geojson` e filtros atualizados
- [x] T037 [P] [US5] Atualizar `packages/web/cron-dashboard.js` para construir cache a partir de `taxa` e `occurrences`
- [x] T038 [P] [US5] Adaptar `packages/web/src/pages/tree.astro` para hierarquia baseada na nova coleção `taxa`
- [x] T039 [US5] Atualizar `packages/web/src/pages/chat.astro` para chamar APIs transformadas e ajustar respostas do assistente
- [x] T040 [P] [US5] Revisar `packages/web/src/prompts/prompt.md` alinhando descrições às coleções `taxa`/`occurrences` e novo fluxo de dados
- [x] T041 [P] [US5] Atualizar `packages/web/src/pages/dashboard.astro` para consumir cache/API dos datasets transformados

---

## Phase 8: Workflows e Automação

**Purpose**: Configurar GitHub Actions para ingestão integrada e re-transformação baseada em versão/manual.

- [x] T042 Remover chamadas a workflows de transformação de `.github/workflows/update-mongodb-flora.yml` (transformação já integrada no ingest)
- [x] T043 [P] Remover chamadas a workflows de transformação de `.github/workflows/update-mongodb-fauna.yml`
- [x] T044 [P] Remover chamadas a workflows de transformação de `.github/workflows/update-mongodb-occurrences.yml`
- [x] T045 Atualizar `.github/workflows/transform-taxa.yml` para: (a) disparar em `workflow_dispatch` (manual), (b) disparar quando `packages/transform/package.json` muda (bump de versão), (c) disparar quando arquivos em `packages/transform/src/taxa/**` mudam
- [x] T046 [P] Atualizar `.github/workflows/transform-occurrences.yml` para: (a) `workflow_dispatch`, (b) mudança em `packages/transform/package.json`, (c) mudança em `packages/transform/src/occurrences/**`

---

## Phase 9: Polish & Documentation

**Purpose**: Documentação, validações finais e checklist de entrega.

- [ ] T047 Atualizar `README.md` com visão geral do pipeline integrado (ingest + transform inline) e comandos CLI de re-transformação
- [ ] T048 [P] Atualizar `docs/atualizacao.md` descrevendo execução integrada (ingestão automática transforma dados) e quando usar re-transformação
- [ ] T049 [P] Atualizar `packages/web/README.md` com orientações de uso das novas APIs e fluxo de dados
- [ ] T050 Atualizar `packages/transform/README.md` (criar se não existir) explicando: (a) funções exportadas para uso inline, (b) CLI para re-transformação, (c) quando incrementar versão
- [ ] T051 Registrar checklist de validação final em `specs/003-data-restructure/quickstart.md` (execução real dos cenários de teste de cada US)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup cria shared package; Transform Foundation depende de shared estar pronto.
- **Phase 2 → User Stories**: US1 e US2 dependem de funções de transformação exportadas; US3 depende de pipelines em massa.
- **User Stories Priority**: Execute em ordem P1 → P2 → P3 (US1 & US2 → US3 → US4 → US5).
  - US1 & US2 são MVP (ingestão integrada).
  - US3 depende de US1 & US2 (usa mesmas funções `transformTaxonRecord`/`transformOccurrenceRecord`).
  - US4 depende de US1 & US2 (APIs consomem dados transformados).
  - US5 depende de US4 (páginas consomem APIs).
- **Workflows & Polish**: Phase 8 e 9 somente após US1-US5 completas.

**CURRENT STATUS**: ✅ Phases 1-8 COMPLETED. Phase 9 (Polish & Documentation) remaining.

## Parallel Opportunities per Story

- **US1**: T019 (flora.ts) e T020 (fauna.ts) podem ser desenvolvidos em paralelo após T013–T017 prontos.
- **US2**: T021 não paraleliza mas pode iniciar assim que US1 estiver estável.
- **US3**: T022 (taxa pipeline) e T023 (occurrences pipeline) podem avançar em paralelo; T024–T026 dependem de ambos.
- **US4**: T027/T030 (listas) e tasks de rotas individuais (T028–T033) podem ser distribuídas; T034 aguarda os demais.
- **US5**: T035–T041 podem ser divididas por página, garantindo apenas que T037 finalize após APIs estáveis.

## Implementation Strategy

1. **MVP**: ✅ COMPLETED - Phases 1–4 garantem ingestão integrada com transformação inline (`taxa_ipt` + `taxa`, `occurrences_ipt` + `occurrences`).
2. **Re-transformação**: ✅ COMPLETED - Phase 5 (US3) permite reprocessamento em massa quando lógica muda.
3. **Interfaces**: ✅ COMPLETED - APIs (Phase 6) atualizadas antes das páginas (Phase 7) mantendo consumidores estáveis.
4. **Automação & Docs**: ✅ COMPLETED - Phases 8 concluídas reforçando workflows CI; Phase 9 (documentação) restante.
5. **Entrega incremental**: ✅ Após cada história, verificações executadas e progresso registrado em `quickstart.md`.

---

## Key Architecture Decisions

1. **Shared Package**: Evita dependências cíclicas entre ingest ↔ transform; centraliza database, deterministic-id, collections, metrics.
2. **Transform Functions**: `transformTaxonRecord` e `transformOccurrenceRecord` são funções puras exportadas, chamadas por ingest scripts.
3. **Integrated Workflow - Per Batch**: Ingestão processa em batches (5000 records para taxa, variável para occurrences). Após cada batch ser inserido em `*_ipt`, o mesmo batch é transformado inline e inserido em coleção transformada. Isso garante:
   - Dados brutos disponíveis imediatamente para troubleshooting
   - Transformação acontece por IPT/source completo antes de passar para próximo
   - Progresso incremental visível (batch por batch)
   - Falha em transformação não bloqueia próximo batch
4. **Bulk Re-transformation**: CLI separado (`bun run transform:taxa`) para reprocessar todos dados quando lógica muda; dispara em bump de versão ou manual.
5. **Error Handling**: Se transformação de registro individual falha, erro é registrado mas ingestão continua; registro bruto permanece em `*_ipt`.
6. **Performance**: Transformação inline adiciona overhead (~2-5x tempo de ingestão). Para 507 IPTs de occurrences, isso é aceitável pois:
   - Workflows rodam semanalmente (tempo não crítico)
   - Evita necessidade de segundo workflow de transformação
   - Garante dados transformados sempre disponíveis
   - Re-transformação em massa disponível para updates rápidos
