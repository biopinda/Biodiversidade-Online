# Implementation Plan: Mapa de Ocorrências por Estado

**Branch**: `001-mapa-de-ocorr` | **Date**: 2025-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mapa-de-ocorr/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
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

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Implementar um mapa interativo do Brasil que exibe contagens de ocorrências de espécies por estado brasileiro, com filtros taxonômicos funcionais. A funcionalidade reutilizará a arquitetura existente do mapa de taxa (packages/web/src/pages/mapa.astro) mas utilizando dados da coleção `ocorrencias` com harmonização de nomes de estados.

## Technical Context

**Language/Version**: TypeScript + Astro.js (Node.js v20.19.4+)
**Primary Dependencies**: Astro.js, React, MongoDB, Tailwind CSS, Google Charts, Bun
**Storage**: MongoDB - coleção `ocorrencias` com campo `stateProvince`
**Testing**: Manual validation (https://biodiversidade.online ou localhost:4321), TypeScript compilation (`bunx tsc --noEmit`)
**Target Platform**: Web application (desktop e mobile)
**Project Type**: web - Astro SSG com componentes React
**Performance Goals**: <2 segundos carregamento, <10 segundos queries MongoDB
**Constraints**: Harmonização necessária de nomes de estados, compatibilidade com filtros existentes
**Scale/Scope**: ~1M registros de ocorrências, 27 estados brasileiros, 8 filtros taxonômicos

**Argumentos do usuário**: Existe código em `@packages\web\src\pages\mapaocorrencia.astro` para melhorar. Verificar práticas existentes no codebase.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Princípio I: Documentação em Português Brasileiro

- [x] Todas as especificações estão em português brasileiro
- [x] Comentários de código e documentação técnica em português
- [x] Termos científicos preservados conforme nomenclatura internacional

### Princípio II: Qualidade de Código Automatizada

- [x] Prettier configurado e funcionando (`bunx prettier --check src/`)
- [x] TypeScript compilation passa (`bunx tsc --noEmit`)
- [x] Build completo executa em <60 segundos

### Princípio III: Simplicidade na UX

- [x] Interface possui propósito claro e único por tela (mapa de ocorrências por estado)
- [x] Informações acessíveis em máximo 3 cliques (home → mapa → filtros)
- [x] Performance e acessibilidade consideradas (reutiliza componentes existentes)

### Princípio IV: Estrutura Monorepo Clara

- [x] Separação correta entre packages/ingest/ e packages/web/
- [x] Uso de Bun workspaces e catalog dependencies
- [x] Comandos executados nos diretórios corretos

### Princípio V: Integração Contínua

- [x] GitHub Actions configurado para dados de biodiversidade
- [x] MongoDB dependency bem documentada
- [x] Validação manual em https://biodiversidade.online e localhost:4321 planejada

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
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
└── [platform-specific structure]
```

**Structure Decision**: Option 2 - Web application (packages/web/ com componentes React e API endpoints)

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

- Load `.specify/templates/tasks-template.md` as base
- Priorizar melhorias sobre criação (código já existe)
- Cada contrato API → teste de integração validando endpoints
- Cada entidade → validação de tipos e interfaces
- Cada cenário de quickstart → teste manual documentado

**Tarefas Específicas Planejadas**:

1. **Análise de Código Existente** [P]
   - Revisar MapOccurrencePage.tsx existente
   - Identificar gaps na implementação atual
   - Documentar melhorias necessárias

2. **Melhorias de Interface** [P]
   - Implementar loading states
   - Melhorar tratamento de erro
   - Adicionar validação de dados

3. **Otimização de Performance**
   - Revisar query MongoDB aggregation
   - Implementar debounce em filtros
   - Cache client-side quando apropriado

4. **Testes de Integração**
   - API occurrenceCountByState endpoint
   - Fluxo completo de filtros
   - Harmonização de estados

**Ordering Strategy**:

- Análise primeiro (entender estado atual)
- Melhorias incrementais (não breaking changes)
- Testes por último (validar melhorias)
- Mark [P] para tarefas independentes

**Estimated Output**: 15-20 tarefas focadas em melhorias, não criação

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

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

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
