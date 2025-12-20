# Implementation Plan: ChatBB v5.1 - Scope Redefinition and Architecture Refactor

**Date**: 2025-12-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/spec.md` | **Previous Version**: V5.0 (2025-12-01)

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

ChatBB v5.1 refactors the Biodiversidade.Online platform to a simplified, user-focused architecture with three complementary interfaces:

1. **Analytic Dashboard** (Homepage): Visual exploration with real-time filters (species type, geography, conservation status)
2. **ChatBB**: Natural language conversational interface via MCP for complex biodiversity questions
3. **REST API**: Programmatic integration with complete Swagger documentation

Core infrastructure builds on V5.0's data pipeline, adding support for threatened species, invasive species, and conservation unit enrichment. Removes legacy components (phenological calendar, taxonomic search interfaces, distribution maps) to reduce codebase complexity. Three interfaces consume from unified transformed data store, maintaining consistency through synchronized updates.

## Technical Context

**Language/Version**: TypeScript (via Bun runtime, latest), Node.js v20.19.4+
**Frontend Framework**: Astro (existing web application in `packages/web`)
**UI/Styling**: Tailwind CSS
**Primary Dependencies**:
- Backend/Data: MongoDB driver, @darwincore/ingest, @darwincore/transform, papaparse, @zip.js/zip.js, xml2js, cli-progress
- API/MCP: Express.js or Astro API routes, swagger-jsdoc, MCP SDK/protocol handler
- Chat: Claude API (via Anthropic SDK)

**Storage**: MongoDB collections:
- Raw: `taxa_ipt`, `occurrences_ipt`
- Transformed: `taxa`, `occurrences`
- Metadata: `threatened_species`, `invasive_species`, `conservation_units`, `transform_status`, `process_metrics`

**Testing**: TypeScript compilation (`bunx tsc --noEmit`), Prettier formatting check, manual validation
**Target Platform**: Linux server (GitHub Actions runners), Docker containers
**Project Type**: Monorepo (Bun workspaces) - data processing (`packages/ingest`, `packages/transform`) + web application (`packages/web`)
**Performance Goals**:
- Dashboard filter response: <1 second
- API endpoint response: <500ms for up to 10,000 records
- Complete data refresh cycle: <24 hours
- ChatBB natural language accuracy: 95%+ on well-formed questions

**Constraints**:
- BSON 16MB document limit (requires chunking for large records)
- MongoDB connection required for all interfaces
- IPT availability/reliability varies (~95% uptime target)
- MCP protocol compatibility for ChatBB data access
- Must preserve backward compatibility with V5.0 data schemas

**Scale/Scope**:
- ~12 million occurrence records
- ~500 IPT repositories
- 50+ concurrent Dashboard users
- Multiple enrichment data sources (threatened species, invasive species, conservation units)
- Three complementary interfaces sharing transformed data

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Princípio I: Documentação em Português Brasileiro

- [x] Especificação em português brasileiro (spec.md com visão estratégica, termos científicos em inglês quando apropriado)
- [x] Documentação técnica em português (código, comentários, PRs em PT-BR)
- [x] Termos científicos preservados (Darwin Core, MCP, taxa, occurrences, conservation units)

### Princípio II: Qualidade de Código Automatizada

- [x] Prettier e TypeScript checks pré-commit (`bunx prettier --check`, `bunx tsc --noEmit`)
- [x] Build completo < 60 segundos (esperado manter performance)
- [x] Novo código em packages/web/ (Dashboard, ChatBB UI) e packages/transform/ (data enrichment) segue padrões existentes

### Princípio III: Simplicidade na UX

- [x] Dashboard homepage com propósito único: visualização de biodiversidade com filtros claros
- [x] Acesso a dados em máximo 3 cliques (Dashboard → menu → ChatBB, ou Dashboard → direct filters)
- [x] Performance <1s para Dashboard filters, <500ms para API responses, 95%+ ChatBB accuracy
- [x] Acessibilidade web (WCAG 2.1) mantida - mudança de homepage não reduz acessibilidade

### Princípio IV: Estrutura Monorepo Clara

- [x] packages/web/ - Aplicação Astro (Dashboard, ChatBB UI, web routes)
- [x] packages/transform/ - Scripts de transformação (enrichment com ameaçadas, invasoras, UCs)
- [x] packages/ingest/ - Ingestão raw (V5.0 mantido, integrado com transform)
- [x] Bun workspaces com dependencies em catalog (nenhuma duplicação)

### Princípio V: Integração Contínua e Dados Atualizados

- [x] GitHub Actions workflows expandidos: ingest → transform → sync interfaces
- [x] MongoDB com MONGO_URI, novas collections (`threatened_species`, `invasive_species`, `conservation_units`)
- [x] Validação manual em http://localhost:4321 com dados atualizados post-import
- [x] Data consistency garantida: Dashboard, ChatBB, API mostram mesmo dados dentro de 1 hora

### Adicionais (Constitution v1.1.0)

**Integridade de Dados e Padrões Científicos**:
- [x] Nomenclatura taxonômica segue ICBN/ICZN, referências Flora e Funga do Brasil
- [x] Qualidade ocorrências: coordenadas validadas contra Brasil, datas consistentes
- [x] Rastreabilidade: cada registro mantém referência de origem (IPT, herbário, etc.)

**Comunidade e Colaboração**:
- [x] APIs RESTful bem documentadas (Swagger/OpenAPI 3.0)
- [x] Código aberto, documentação pública, processo transparente
- [x] Compatibilidade com GBIF/SiBBr/padrões internacionais mantida

**Segurança e Privacidade**:
- [x] Localização de espécies sensíveis pode ser obscurecida (implementação futura)
- [x] Backups MongoDB, logs de acesso/modificações
- [x] Validação entrada para prevenir injeção, compliance ICMBio/IBAMA

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

## Phase 0: Research & Clarifications

_Executed during /plan command_

**Research Topics** (all clarifications from spec resolved):

1. **MCP Integration for ChatBB**: Best practices for Model Context Protocol integration with MongoDB, data query patterns
2. **Dashboard Real-time Filters**: Astro Islands approach for interactive filters without full page reloads, state management patterns
3. **Claude API Integration**: Conversation context, prompt engineering for biodiversity queries, error handling
4. **Swagger/OpenAPI Documentation**: Auto-generation from Astro API routes or Express, best practices for filtering parameters
5. **Data Enrichment Strategy**: How to associate threatened species/invasive species/conservation units with taxa and occurrences
6. **Database Consistency**: Ensuring three interfaces (Dashboard, ChatBB, API) always show consistent data across concurrent updates
7. **Component Removal Strategy**: Dependency analysis for phenological calendar, taxonomic search, distribution map removal
8. **GeoJSON Handling**: How to efficiently serialize/deserialize geographic features for API responses

**Output**: research.md with all findings consolidated

## Phase 1: Design & Contracts

_Prerequisites: All research complete, no NEEDS CLARIFICATION markers_

### 1.1 Data Model (data-model.md)

Entities derived from spec:
- **Taxa**: scientific name, threat status, invasive status, UC associations
- **Occurrences**: species reference, location, date, collection method
- **Threatened Species**: enrichment data with threat level, recovery status
- **Invasive Species**: enrichment data with origin, impact assessment
- **Conservation Units**: geographic boundaries, designation type, management status

### 1.2 API Contracts (/contracts/)

Dashboard/Web Routes:
- GET `/` → Analytic Dashboard HTML
- GET `/api/dashboard/summary` → Dashboard statistics (threatened count, invasive count, total species)
- GET `/api/taxa` → Filtered taxa list (query: type, region, conservation_status)
- GET `/api/occurrences` → Filtered occurrences with pagination
- GET `/api/docs` → Swagger UI

ChatBB Interface:
- POST `/api/chat/send` → Natural language query → Claude response via MCP
- GET `/api/chat/context` → Conversation history
- WebSocket or Server-Sent Events for streaming responses

### 1.3 Contract Tests

Test files that will fail (no implementation):
- `/contracts/test-api-taxa.test.ts` - Asserts GET /api/taxa schema
- `/contracts/test-api-occurrences.test.ts` - Asserts GET /api/occurrences response
- `/contracts/test-chat.test.ts` - Asserts POST /api/chat/send request/response

### 1.4 Quickstart & Validation

quickstart.md will describe:
- Running local MongoDB
- Building packages/web/ with Dashboard
- Testing ChatBB with sample queries
- Testing API endpoints with curl examples
- Performance validation (filter <1s, API <500ms)

### 1.5 Agent Context Update

Run: `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude`
Updates CLAUDE.md with:
- New dependencies: Claude SDK, MCP protocol, swagger-jsdoc
- Architecture: Three interfaces pattern
- Key files: packages/web (Astro), packages/transform, API contracts

**Outputs**: data-model.md, /contracts/*, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

Feature será decomposta em tasks categoria por categoria, seguindo princípios de modularidade e paralelização:

**Categoria 1: Data Enrichment Infrastructure [P]**

- Criar collections MongoDB: `threatened_species`, `invasive_species`, `conservation_units`
- Implementar data loaders para fontes autorizadas (Flora/Funga do Brasil, IBAMA invasoras, ICMBio UCs)
- Criar schema de enriquecimento (taxa → threat_status, invasive_status, uc_associations)
- Implementar validação de integridade de referências (taxa_id matches)

**Categoria 2: Data Transformation Updates (P após Categoria 1)**

- Expandir `packages/transform/src/taxa.ts` com enriquecimento de ameaçadas/invasoras
- Expandir transformação com UC associations (geographic intersection)
- Implementar de-duplication de enrichment data
- Criar logs detalhados com data source tracking

**Categoria 3: API REST com Swagger**

- Criar/atualizar rotas Astro `/api/taxa`, `/api/occurrences` em `packages/web/src/pages/api/`
- Implementar filtros: type (native/threatened/invasive), region, conservation_status, threat_level
- Implementar paginação com limit/offset
- Implementar GeoJSON serialization para occurrences
- Gerar Swagger/OpenAPI 3.0 spec via swagger-jsdoc
- Servir Swagger UI em GET `/api/docs`
- Criar testes de contrato para todos endpoints

**Categoria 4: Dashboard Homepage (Astro Component)**

- Refatorar home page (`packages/web/src/pages/index.astro`) como Analytic Dashboard
- Criar Astro Island para Dashboard filtros interativos (species type, region, conservation status)
- Implementar visualizações: statistics cards, bar/pie charts das espécies
- Conectar filtros para chamar `/api/taxa` e `/api/occurrences`
- Adicionar menu option para ChatBB (modal ou nova página)
- Performance: cache dashboard data, pre-fetch com SWR
- Remover/refatorar /taxa, /mapa, /tree, /fenologia pages (remover calendário fenológico)

**Categoria 5: ChatBB Conversational Interface**

- Criar página `/chat` em Astro (`packages/web/src/pages/chat.astro`)
- Implementar Claude API integration com system prompt sobre biodiversity
- Implementar MCP adapter para Claude → MongoDB queries
- Mapear natural language queries → API calls (/api/taxa, /api/occurrences)
- Implementar conversation context persistence (localStorage ou backend session)
- Implementar streaming responses (Server-Sent Events)
- Error handling: graceful degradation if MCP fails
- Testes: 10 sample queries validating 95%+ accuracy

**Categoria 6: Component Removal**

- Identificar e remover código: fenological calendar components/pages
- Identificar e remover: taxonomic search interface components
- Identificar e remover: distribution map components
- Audit dependencies: verificar não há dead code após remoção
- Atualizar navigation/menu (remover links para componentes deletados)

**Categoria 7: Data Consistency & Synchronization**

- Implementar data version tracking (timestamp de última transformação)
- Dashboard, ChatBB, API sempre consultam collected transformed data
- Implementar cache invalidation strategy (TTL 1 hour)
- Implementar fallback: usar previous good snapshot if transformation in progress

**Categoria 8: Documentation & Testing**

- Criar research.md com findings sobre MCP, Astro Islands, Claude API patterns
- Criar data-model.md descrevendo entities, relationships, validation rules
- Criar quickstart.md com setup instructions e validation scenarios
- Criar CLAUDE.md com architecture notes (se using Claude Code)
- Testes de integração: user stories validação (spec.md acceptance scenarios)
- Performance testes: dashboard filter <1s, API <500ms

**Ordering Strategy**:

1. **Data Infrastructure First**: Categoria 1 (enrichment collections) antes de transformação
2. **Transformação Updates**: Categoria 2 expande existente V5.0 transform
3. **APIs Parallel**: Categoria 3 pode ser desenvolvida em paralelo com Categoria 2 [P]
4. **Dashboard & ChatBB Parallel**: Categorias 4 e 5 podem ser paralelas após APIs [P]
5. **Cleanup/Removal**: Categoria 6 após Dashboard refactoring (não quebrar current pages)
6. **Synchronization & Tests**: Categorias 7 e 8 finais (validation & integration)

**Parallelization Tags**:

- [P] Categoria 1 tarefas podem ser paralelas (diferentes collections)
- [P] Categoria 3 endpoints podem ser desenvolvidos em paralelo
- [P] Categoria 4 (Dashboard) e 5 (ChatBB) independentes após APIs
- [P] Categoria 8 testes podem começar assim que interfaces prontas

**Estimated Output**: 35-45 numbered, ordered tasks em tasks.md

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

**Phase Status** (ChatBB v5.1):

- [x] Phase 0: Research outlined (/plan command scope) - research.md to be created with 8 research topics
- [x] Phase 1: Design approach defined (/plan command scope) - data-model.md, /contracts/, quickstart.md, CLAUDE.md to be created
- [x] Phase 2: Task planning complete (/plan command) - 8 categories described, ready for /tasks command
- [ ] Phase 3: Tasks generated (/tasks command) - pending execution
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS - All 5 core principles + v1.1.0 governance sections satisfied
- [x] Post-Design Constitution Check: PENDING (will re-check after Phase 1 detailed design)
- [x] No NEEDS CLARIFICATION markers in spec - All requirements unambiguous and testable
- [x] Complexity deviations: None - Feature fits cleanly into monorepo structure

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
