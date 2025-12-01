# Implementation Plan: Reestruturação de Dados - Separação de Ingestão e Transformação

**Date**: 2025-12-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: Phases 2+ are executed by other commands or manual implementation.

## Summary

Esta feature implementa a separação arquitetural entre ingestão de dados brutos e transformação/processamento, criando coleções MongoDB distintas (`taxa_ipt`/`occurrences_ipt` para dados brutos, `taxa`/`occurrences` para dados transformados). O objetivo é garantir rastreabilidade completa, permitir reprodutibilidade de transformações e facilitar auditoria através da preservação de dados raw. A abordagem técnica envolve:

1. Criação de novo pacote `packages/transform` com scripts de transformação
2. Refatoração de `packages/ingest` para focar apenas em download e armazenamento raw
3. Implementação de rastreabilidade via `_id` idêntico entre coleções raw e transformed
4. Automação via GitHub Actions workflows para execução sequencial (ingest → transform)

## Technical Context

**Language/Version**: TypeScript (via Bun runtime, latest), Node.js v20.19.4+  
**Primary Dependencies**: Bun (package manager), MongoDB driver, papaparse (CSV parsing), @zip.js/zip.js (DwC-A extraction), cli-progress (progress bars), xml2js (EML parsing)  
**Storage**: MongoDB (primary database), collections: `taxa_ipt`, `occurrences_ipt`, `taxa`, `occurrences`, `transform_status`, `process_metrics`  
**Testing**: Manual validation scenarios (no automated test suite), TypeScript compilation check (`bunx tsc --noEmit`), Prettier formatting check  
**Target Platform**: Linux server (GitHub Actions self-hosted runners), Docker containers  
**Project Type**: Monorepo (Bun workspaces) - data processing (`packages/ingest`, new `packages/transform`) + web application (`packages/web`)  
**Performance Goals**: Ingest 507 IPT resources in <2 hours, transform all taxa/occurrences with >95% success rate, API responses <500ms for 1000 results  
**Constraints**: BSON 16MB document limit (requires chunking), MongoDB connection required, IPT availability >95%, preserve existing code in `packages/ingest/src/lib/`  
**Scale/Scope**: Millions of biodiversity records, 507 IPT resources, 4 main collections (2 raw + 2 transformed)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Princípio I: Documentação em Português Brasileiro

- [x] Todas as especificações estão em português brasileiro (spec.md completamente em PT-BR)
- [x] Comentários de código e documentação técnica em português (mantendo consistência com codebase existente)
- [x] Termos científicos preservados conforme nomenclatura internacional (Darwin Core, taxonID, occurrenceID)

### Princípio II: Qualidade de Código Automatizada

- [x] Prettier configurado e funcionando (`bunx prettier --check src/` - já configurado no projeto)
- [x] TypeScript compilation passa (`bunx tsc --noEmit` - verificação obrigatória antes de commits)
- [x] Build completo executa em <60 segundos (build atual em ~16 segundos, esperado manter)

### Princípio III: Simplicidade na UX

- [x] Interface possui propósito claro e único por tela (não afetado - mudanças apenas em backend/data processing)
- [x] Informações acessíveis em máximo 3 cliques (mantido - apenas mudança de fonte de dados nas APIs)
- [x] Performance e acessibilidade consideradas (APIs mantêm <500ms response time)

### Princípio IV: Estrutura Monorepo Clara

- [x] Separação correta entre packages/ingest/ e packages/web/ (novo packages/transform/ adiciona clareza)
- [x] Uso de Bun workspaces e catalog dependencies (novo pacote seguirá padrão existente)
- [x] Comandos executados nos diretórios corretos (bun run transform:_ no root, seguindo padrão de ingest:_)

### Princípio V: Integração Contínua

- [x] GitHub Actions configurado para dados de biodiversidade (workflows atuais serão expandidos)
- [x] MongoDB dependency bem documentada (MONGO_URI já documentado, novas collections serão documentadas)
- [x] Validação manual em localhost:4321 planejada (cenários de teste definidos em spec.md)

## Project Structure

### Documentation (this feature)

```
specs/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── tasks.md             # Implementation tasks
└── README.md            # Structure documentation
```

### Source Code (repository root)

```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

Esta feature será decomposta em tasks seguindo arquitetura de separação entre ingestão raw e transformação:

**Categoria 1: Infrastructure Setup (P)**

- Criar novo pacote `packages/transform` com estrutura monorepo
- Configurar `package.json` e `tsconfig.json` do novo pacote
- Adicionar project references no root `tsconfig.json`
- Criar collections MongoDB auxiliares (`transform_status`, `process_metrics`)

**Categoria 2: Refactoring de Ingestão (P após Categoria 1)**

- Refatorar `packages/ingest/src/flora.ts` para focar apenas em ingestão raw (remover transformações)
- Refatorar `packages/ingest/src/fauna.ts` para focar apenas em ingestão raw
- Refatorar `packages/ingest/src/ocorrencia.ts` para focar apenas em ingestão raw
- Implementar geração de `_id` determinístico em scripts de ingestão
- Criar testes de integração para ingestão raw (validar schema DwC-A preservado)

**Categoria 3: Transformação de Taxa**

- Criar `packages/transform/src/taxa.ts` com lógica de transformação movida de flora.ts/fauna.ts
- Implementar controle de concorrência via `transform_status` collection
- Implementar aggregation de dados de ameaça (cncfloraFungi, cncfloraPlantae, faunaAmeacada)
- Implementar aggregation de espécies invasoras
- Implementar aggregation de UCs
- Implementar validação de integridade de `_id` (raw ↔ transformed)
- Implementar recording de métricas em `process_metrics`
- Criar script CLI `bun run transform:taxa`
- Criar testes de integração para transformação de taxa

**Categoria 4: Transformação de Ocorrências**

- Criar `packages/transform/src/occurrences.ts` com lógica de transformação
- Implementar validação de coordenadas geográficas e criação de `geoPoint`
- Implementar parsing de datas (year/month/day extraction)
- Implementar harmonização geográfica (country, stateProvince, county)
- Implementar vinculação taxonômica (scientificName → taxonID lookup)
- Implementar integração com parser de coletores (graceful degradation)
- Implementar filtro de país (apenas Brasil)
- Implementar validação de integridade de `_id`
- Implementar recording de métricas
- Criar script CLI `bun run transform:occurrences`
- Criar testes de integração para transformação de ocorrências

**Categoria 5: API Implementation**

- Implementar `/api/taxa` endpoint (GET list com filtros)
- Implementar `/api/taxa/{taxonID}` endpoint (GET by ID)
- Implementar `/api/taxa/count` endpoint
- Implementar `/api/occurrences` endpoint (GET list com filtros)
- Implementar `/api/occurrences/{occurrenceID}` endpoint (GET by ID)
- Implementar `/api/occurrences/count` endpoint
- Implementar `/api/occurrences/geojson` endpoint
- Atualizar `public/api-spec.json` com novos endpoints
- Criar testes de contrato para todos os endpoints

**Categoria 6: Web Interface Adaptation**

- Adaptar página `/taxa` para consumir nova collection `taxa`
- Adaptar página `/mapa` para consumir nova collection `occurrences`
- Atualizar `cron-dashboard.js` para usar collections transformadas
- Adaptar página `/tree` para nova collection `taxa`
- Atualizar prompts do ChatBB (`/chat`) para mencionar novas collections
- Criar testes de integração para cada página

**Categoria 7: Automation & CI/CD**

- Criar workflow GitHub Actions `.github/workflows/transform-taxa.yml`
- Criar workflow GitHub Actions `.github/workflows/transform-occurrences.yml`
- Atualizar workflows de ingestão para trigger de transformação automática
- Implementar script `transform:check-lock` para verificação de concorrência
- Criar documentação de workflows em português
- Criar testes de integração para workflows (pode ser manual)

**Ordering Strategy**:

1. **Infrastructure first**: Categoria 1 deve ser completada antes de qualquer implementação
2. **Ingestão antes de transformação**: Categoria 2 deve preceder Categorias 3 e 4
3. **Transformação em paralelo**: Categorias 3 e 4 podem ser desenvolvidas em paralelo [P]
4. **APIs dependem de transformação**: Categoria 5 após Categorias 3 e 4
5. **Interface após APIs**: Categoria 6 após Categoria 5
6. **Automation por último**: Categoria 7 após todas as anteriores

**Tagging para Execução Paralela**:

- Tasks marcadas com [P] podem ser executadas em paralelo se independentes
- Tasks de refatoração de ingestão (flora.ts, fauna.ts, ocorrencia.ts) podem ser [P]
- Tasks de transformação (taxa vs occurrences) podem ser [P]
- Tasks de API endpoints individuais podem ser [P]
- Tasks de adaptação de páginas web podem ser [P]

**Estimated Output**: 45-55 numbered, ordered tasks em tasks.md

**Task Template Example**:

```
### Task 1: Criar estrutura do pacote packages/transform [P]

**Category**: Infrastructure Setup
**Dependencies**: None
**Estimated effort**: 30 minutes

**Description**:
Criar novo pacote TypeScript `packages/transform` seguindo estrutura monorepo existente.

**Acceptance criteria**:
- [ ] Diretório `packages/transform/` criado
- [ ] Arquivo `package.json` com name "@darwincore/transform"
- [ ] Arquivo `tsconfig.json` extends "../tsconfig.base.json"
- [ ] Catalog dependencies adicionadas (mongodb, etc)
- [ ] Root `package.json` atualizado com workspace reference
- [ ] Root `tsconfig.json` atualizado com project reference
- [ ] `bunx tsc --noEmit` passa sem erros
```

**IMPORTANT**: Esta fase é executada pelo comando `/tasks`, NÃO pelo `/plan`

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) - research.md created with all clarifications resolved
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, .github/copilot-instructions.md updated
- [x] Phase 2: Task planning complete (/plan command - approach described, ready for /tasks command)
- [ ] Phase 3: Tasks generated (/tasks command) - pending execution
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS - All principles satisfied, no violations
- [x] Post-Design Constitution Check: PASS - Design maintains constitutional compliance
- [x] All NEEDS CLARIFICATION resolved - Research phase completed all 11 research tasks
- [x] Complexity deviations documented - No deviations from constitution (Complexity Tracking section empty as intended)

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
