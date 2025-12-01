# Implementation Plan: Split up mongo.ts

**Branch**: `002-split-up-mongo` | **Date**: 27 de setembro de 2025 | **Spec**: /specs/002-split-up-mongo/spec.md
**Input**: Feature specification from `/specs/002-split-up-mongo/spec.m## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/tasks command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documentedow (/plan command scope)

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

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: TypeScript (Node.js v20.19.4+)  
**Primary Dependencies**: MongoDB, Bun, Astro.js  
**Storage**: MongoDB (dwc2json database with multiple collections)  
**Testing**: Manual testing (no automated test suite available)  
**Target Platform**: Web application (Astro.js)  
**Project Type**: Web application  
**Performance Goals**: Build in <60 seconds, app loads in <2 seconds  
**Constraints**: MongoDB connection required, maintain all existing functionality, follow DRY methodology  
**Scale/Scope**: Large mongo.ts file (1000+ lines) with multiple concerns (connection, taxa, occurrences, threatened species, invasive species, phenological data, utilities)

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

- [x] Interface possui propósito claro e único por tela
- [x] Informações acessíveis em máximo 3 cliques
- [x] Performance e acessibilidade consideradas (refactoring não afeta UX diretamente)

### Princípio IV: Estrutura Monorepo Clara

- [x] Separação correta entre packages/ingest/ e packages/web/
- [x] Uso de Bun workspaces e catalog dependencies
- [x] Comandos executados nos diretórios corretos

### Princípio V: Integração Contínua

- [x] GitHub Actions configurado para dados de biodiversidade
- [x] MongoDB dependency bem documentada
- [x] Validação manual em localhost:4321 planejada

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

## Project Structure

### Documentation (this feature)

```
specs/002-split-up-mongo/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
packages/web/src/lib/
├── mongo/               # NEW: Split mongo modules
│   ├── connection.ts    # MongoDB connection utilities
│   ├── taxa.ts          # Taxa-related functions
│   ├── occurrences.ts   # Occurrence data functions
│   ├── threatened.ts    # Threatened species functions
│   ├── invasive.ts      # Invasive species functions
│   ├── phenological.ts  # Phenological calendar functions
│   ├── cache.ts         # Cache management utilities
│   └── index.ts         # Main exports
├── mongo.ts             # EXISTING: To be removed after migration
└── [other existing files...]
```

**Structure Decision**: Web application structure (Option 2) - refactoring existing web application codebase

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
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each module creation → implementation task [P] (connection.ts, taxa.ts, occurrences.ts, etc.)
- Each API contract → integration test task
- Import updates → migration task [P]
- Original file removal → cleanup task
- Quickstart validation → verification task

**Ordering Strategy**:

- TDD order: Create modules first, then update imports
- Dependency order: Connection module first, then business modules
- Parallel execution: Module creation tasks can run in parallel [P]
- Sequential validation: Import updates must be done carefully

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

### Validation Commands (to be run after implementation)

```bash
# Build and linting validation
cd packages/web/
bunx prettier --check src/
bunx tsc --noEmit
bun astro check  # Additional Astro validation
bun run build

# Docker production testing with MongoDB environment
docker build -t chatbb-refactored .
docker run -d --name chatbb-test \
  -p 4321:4321 \
  -e MONGO_URI="mongodb://dwc2json:VLWQ8Bke65L52hfBM635@192.168.1.10:27017/?authSource=admin&authMechanism=DEFAULT" \
  -e MONGODB_URI_READONLY="mongodb://dwc2json:VLWQ8Bke65L52hfBM635@192.168.1.10:27017/?authSource=admin&authMechanism=DEFAULT" \
  chatbb-refactored

# Wait for container to start
sleep 5

# API endpoint testing
curl http://localhost:4321/api/health
curl http://localhost:4321/api/taxa?page=0
curl http://localhost:4321/api/occurrenceCountByState

# Cleanup
docker stop chatbb-test
docker rm chatbb-test
```

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
