# Tasks: Reestruturação de Dados - Separação de Ingestão e Transformação

**Input**: Design documents from `/specs/003-data-restructure/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Somente gere tarefas de teste se solicitado explicitamente (não requisitado nesta feature). Validação será manual via quickstart.

**Organization**: Tasks são agrupadas por fase para permitir implementação e validação incremental. Cada história de usuário possui seu próprio conjunto de tarefas independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode ser executada em paralelo (arquivos distintos, sem dependências bloqueadoras)
- **[Story]**: História de usuário responsável (US1, US2, ...). Fases de Setup/Foundational/Polish não usam etiqueta de história.
- Inclua caminhos de arquivos exatos na descrição de cada tarefa

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o monorepo para o novo pacote de transformação e scripts compartilhados.

- [x] T001 Atualizar `package.json` na raiz para registrar o workspace `@darwincore/transform` e adicionar scripts `transform:taxa`, `transform:occurrences` e `transform:check-lock`
- [x] T002 Atualizar `tsconfig.json` na raiz adicionando referência de projeto para `packages/transform/tsconfig.json`
- [x] T003 Criar `packages/transform/package.json` com dependências (mongodb, cli-progress, etc.) reutilizando catálogos e referenciando `@darwincore/ingest`
- [x] T004 Criar `packages/transform/tsconfig.json` estendendo `../../tsconfig.base.json` e expondo `src` como rootDir/outDir
- [x] T005 [P] Criar `packages/transform/src/index.ts` exportando funções públicas e inicializando registradores de CLI

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura essencial compartilhada entre ingestão e transformação; deve estar concluída antes de qualquer história.

- [x] T006 Criar `packages/transform/src/lib/database.ts` com fábrica de conexão MongoDB compartilhada (pool + carregamento de `MONGO_URI`)
- [x] T007 [P] Criar `packages/transform/src/lib/concurrency.ts` implementando controle de locks na coleção `transform_status`
- [x] T008 [P] Criar `packages/transform/src/lib/metrics.ts` registrando métricas na coleção `process_metrics`
- [x] T009 Configurar `packages/transform/src/cli/runTransform.ts` para orquestrar locks, métricas e execução de pipelines
- [x] T010 [P] Criar `packages/transform/src/cli/checkLock.ts` expondo utilitário CLI para validar/forçar liberação de locks
- [x] T011 Criar `packages/ingest/src/config/collections.ts` centralizando nomes de coleções raw (`taxa_ipt`, `occurrences_ipt`) e transformadas
- [x] T012 [P] Criar `packages/ingest/src/utils/deterministic-id.ts` com helpers para gerar `_id` determinístico de taxa e ocorrência

---

## Phase 3: User Story 1 - Ingestão Automática de Dados Brutos de Taxa (Priority: P1) 🎯 MVP

**Goal**: Baixar e armazenar dados taxonômicos brutos (Flora e Fauna) em `taxa_ipt`, preservando campos DwC e `_id` baseado em `taxonID`.

**Independent Test**: Executar `bun run ingest:flora` e `bun run ingest:fauna`, confirmar inserções em `taxa_ipt`, verificar `_id` = `taxonID` e upsert sem duplicidade.

- [x] T013 [US1] Refatorar `packages/ingest/src/flora.ts` para gravar documentos brutos em `taxa_ipt` usando `_id` determinístico e registrar métricas via helper
- [x] T014 [P] [US1] Refatorar `packages/ingest/src/fauna.ts` espelhando fluxo raw-only (`taxa_ipt`, `_id` determinístico, métricas e upsert)

---

## Phase 4: User Story 2 - Ingestão Automática de Dados Brutos de Ocorrências (Priority: P1)

**Goal**: Processar 507 recursos DwC-A e armazenar registros brutos em `occurrences_ipt` com `_id` determinístico baseado em `occurrenceID` + `iptId`.

**Independent Test**: Executar `bun run ingest:occurrences`, confirmar todos os IPTs processados, `_id` preservado, upsert funcionando e métricas registradas.

- [x] T015 [US2] Refatorar `packages/ingest/src/ocorrencia.ts` para pipeline raw (`occurrences_ipt`), incluindo geração de `_id` composta, fallback para ausência de `occurrenceID` e métricas

---

## Phase 5: User Story 3 - Transformação de Dados Taxonômicos (Priority: P2)

**Goal**: Transformar registros de `taxa_ipt` em `taxa`, aplicando filtros de `taxonRank`, normalizações e agregações (ameaça, invasoras, UCs) preservando `_id`.

**Independent Test**: Executar `bun run transform:taxa`, verificar `_id` idêntico entre `taxa` e `taxa_ipt`, campos normalizados (`canonicalName`, `distribution`, etc.) e métricas registradas.

- [x] T016 [US3] Migrar normalizações de táxons para `packages/transform/src/taxa/normalizeTaxon.ts` (canonicalName, flatScientificName, vernacularname, distribution)
- [x] T017 [P] [US3] Implementar enriquecimentos em `packages/transform/src/taxa/enrichTaxon.ts` (ameaça, invasoras, unidades de conservação, kingdom fauna)
- [x] T018 [US3] Construir pipeline principal em `packages/transform/src/taxa/transformTaxa.ts` (lock, batch read, normalização, agregação, upsert em `taxa`, validação de rastreabilidade, métricas)
- [x] T019 [P] [US3] Criar `packages/transform/src/cli/transformTaxa.ts` conectando pipeline ao runner e exportando via `packages/transform/src/index.ts`

---

## Phase 6: User Story 4 - Transformação de Dados de Ocorrências (Priority: P2)

**Goal**: Transformar `occurrences_ipt` em `occurrences` aplicando validações geográficas, temporais, taxonômicas e enriquecimentos (collector parsing, filtro Brasil) preservando `_id`.

**Independent Test**: Executar `bun run transform:occurrences`, confirmar `geoPoint` válido, normalização de datas e estados, vinculação com `taxa`, filtro de país e métricas.

- [x] T020 [US4] Implementar normalizações em `packages/transform/src/occurrences/normalizeOccurrence.ts` (geoPoint, datas, país/estado, iptKingdoms, canonicalName)
- [x] T021 [P] [US4] Implementar enriquecimentos em `packages/transform/src/occurrences/enrichOccurrence.ts` (taxon lookup, collector parsing com fallback, filtro Brasil, reproductiveCondition)
- [x] T022 [US4] Construir pipeline em `packages/transform/src/occurrences/transformOccurrences.ts` (leitura por lotes, validações, upsert em `occurrences`, verificação `_id`, métricas)
- [x] T023 [P] [US4] Criar `packages/transform/src/cli/transformOccurrences.ts` integrando pipeline ao runner e exportando via `packages/transform/src/index.ts`

---

## Phase 7: User Story 5 - Exposição de APIs RESTful (Priority: P3)

**Goal**: Expor endpoints REST documentados (Swagger) para consultar `taxa` e `occurrences`, incluindo listagem, busca por ID, contagem e GeoJSON.

**Independent Test**: Acessar `/api/docs`, executar chamadas para `/api/taxa`, `/api/taxa/{id}`, `/api/occurrences`, `/api/occurrences/count`, `/api/occurrences/geojson` e validar respostas contra contratos.

- [x] T024 [US5] Atualizar `packages/web/src/pages/api/taxa.ts` para novos filtros, paginação e consulta à coleção `taxa`
- [x] T025 [P] [US5] Criar `packages/web/src/pages/api/taxa/[taxonID].ts` retornando táxon por `_id`
- [x] T026 [P] [US5] Criar `packages/web/src/pages/api/taxa/count.ts` fornecendo contagem filtrada
- [x] T027 [US5] Atualizar `packages/web/src/pages/api/occurrences.ts` para filtros combinados, bbox e consulta à coleção `occurrences`
- [x] T028 [P] [US5] Criar `packages/web/src/pages/api/occurrences/[occurrenceID].ts` retornando ocorrência por `_id`
- [x] T029 [P] [US5] Criar `packages/web/src/pages/api/occurrences/count.ts` alinhado ao contrato de contagem
- [x] T030 [P] [US5] Criar `packages/web/src/pages/api/occurrences/geojson.ts` gerando FeatureCollection limitada
- [x] T031 [US5] Atualizar `packages/web/public/api-spec.json` refletindo novos endpoints, parâmetros e esquemas

---

## Phase 8: User Story 6 - Adaptação da Interface Web (Priority: P3)

**Goal**: Atualizar páginas web (taxa, mapa, dashboard, tree, chat) para consumir APIs novas mantendo UX e performance atuais.

**Independent Test**: Navegar em `/taxa`, `/mapa`, `/dashboard`, `/tree`, `/chat`, validar carregamento correto dos dados e respostas em tempo aceitável.

- [x] T032 [US6] Ajustar `packages/web/src/pages/taxa.astro` para consumir `/api/taxa` com filtros e paginação renovados
- [x] T033 [P] [US6] Ajustar `packages/web/src/pages/mapa.astro` para usar `/api/occurrences/geojson` e filtros atualizados
- [x] T034 [P] [US6] Atualizar `packages/web/cron-dashboard.js` para construir cache a partir de `taxa` e `occurrences`
- [x] T035 [P] [US6] Adaptar `packages/web/src/pages/tree.astro` para hierarquia baseada na nova coleção `taxa`
- [x] T036 [US6] Atualizar `packages/web/src/pages/chat.astro` para chamar APIs transformadas e ajustar respostas do assistente
- [x] T037 [P] [US6] Revisar `packages/web/src/prompts/prompt.md` alinhando descrições às coleções `taxa`/`occurrences` e novo fluxo de dados
- [x] T038 [P] [US6] Atualizar `packages/web/src/pages/dashboard.astro` para consumir cache/API dos datasets transformados

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentação, automação e validações finais após concluir as histórias principais.

- [x] T039 Atualizar `README.md` com visão geral do pipeline raw → transform e novos comandos CLI
- [x] T040 [P] Atualizar `docs/atualizacao.md` descrevendo execução automatizada (ingestão → transformação) e métricas
- [x] T041 [P] Criar `.github/workflows/transform-taxa.yml` executando `bun run transform:taxa` com suporte a `workflow_dispatch`
- [x] T042 [P] Criar `.github/workflows/transform-occurrences.yml` executando `bun run transform:occurrences` com suporte a `workflow_dispatch`
- [x] T043 Atualizar `.github/workflows/update-mongodb-flora.yml`, `.github/workflows/update-mongodb-fauna.yml` e `.github/workflows/update-mongodb-occurrences.yml` para disparar workflows de transformação após ingestão
- [x] T044 [P] Atualizar `packages/web/README.md` com orientações de uso das novas APIs e fluxo de dados
- [x] T045 Registrar checklist de validação final em `specs/003-data-restructure/quickstart.md` (execução real dos cenários de teste)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup prepara o monorepo; Foundational depende da conclusão do Setup.
- **Phase 2 → User Stories**: Todas as histórias (US1–US6) dependem da infraestrutura compartilhada concluída na Phase 2.
- **User Stories Priority**: Execute em ordem P1 → P2 → P3 (US1 & US2 → US3 & US4 → US5 & US6). US3 depende de US1; US4 depende de US1, US2 e US3; US5 depende de US3 & US4; US6 depende de US5.
- **Polish**: Phase 9 somente após todas as histórias prioritárias estarem concluídas.

## Parallel Opportunities per Story

- **US1**: T013 e T014 podem acontecer em paralelo (flora vs fauna) após helpers prontos.
- **US2**: T015 não paraleliza, mas pode rodar simultaneamente a validações de US1 após Phase 2.
- **US3**: T016 e T017 podem ser desenvolvidos em paralelo, convergindo em T018; T019 pode iniciar após T018 esboçar a API do pipeline.
- **US4**: T020 e T021 podem avançar em paralelo, permitindo iniciar T022 assim que ambos disponibilizem utilitários; T023 pode acompanhar ajustes finais do pipeline.
- **US5**: T024/T027 (listas) e tasks de rotas individuais (T025–T030) podem ser distribuídas entre devs; T031 aguarda os demais.
- **US6**: T032–T038 podem ser divididas por página, garantindo apenas que T034 finalize após APIs estáveis.

## Implementation Strategy

1. **MVP**: Completar Phases 1–4 para garantir dados brutos persistidos com rastreabilidade (`taxa_ipt`, `occurrences_ipt`).
2. **Transformações**: Entregar Phases 5–6 para restaurar paridade funcional (coleções `taxa` e `occurrences`), validando idempotência e métricas.
3. **Interfaces**: Atualizar APIs (Phase 7) antes das páginas (Phase 8) para manter consumidores estáveis.
4. **Automação & Docs**: Concluir Phase 9 reforçando workflows CI e documentação; executar quickstart completo ao final.
5. **Entrega incremental**: Após cada história, executar verificações descritas em "Independent Test" e registrar progresso em `quickstart.md`.
