# Implementation Plan: Manter Dados Originais

**Branch**: `003-manter-dados-originais` | **Date**: 2025-09-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-manter-dados-originais/spec.md`

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

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Refatorar os workflows de ingestão existentes (fauna.ts, flora.ts, ocorrencia.ts) para implementar sistema de preservação de dados originais em coleções separadas (`taxaOriginal`, `ocorrenciasOriginal`), mantendo total compatibilidade com workflows GitHub Actions atuais. A abordagem prioriza modificações internas nos scripts sem alterar interfaces externas, garantindo zero downtime e preservação de cronogramas existentes (cron schedules). Implementação best-effort onde falhas na preservação não quebram o fluxo principal de transformação.

## Technical Context

**Language/Version**: TypeScript 5.x + Bun (package manager and runtime)  
**Primary Dependencies**: MongoDB driver, Darwin Core utilities, GitHub Actions  
**Storage**: MongoDB (coleções existentes: taxa, ocorrencias, ipts; novas: taxaOriginal, ocorrenciasOriginal)  
**Testing**: Manual validation via localhost:4321 + script execution testing  
**Target Platform**: Linux server (GitHub Actions self-hosted runners)  
**Project Type**: monorepo - packages/ingest/ (data processing) + packages/web/ (interface)  
**Performance Goals**: Tempo de ingestão <125% do atual, preservação original best-effort  
**Constraints**: Ver seção "Compatibilidade com Workflows Existentes" no spec.md para detalhes completos  
**Scale/Scope**: Refatoração de 3 scripts existentes, manutenção de cronogramas (fauna: 30 2 \* _ 0, flora: 0 2 _ _ 0, ocorrencias: 0 3 _ \* 0)

**Workflows Existentes a Preservar**:

- **update-mongodb-fauna.yml**: Processa Animalia via DWCA_URL do JBRJ, insere em `taxa`
- **update-mongodb-flora.yml**: Processa Plantae/Fungi via DWCA_URL do JBRJ, insere em `taxa`
- **update-mongodb-occurrences.yml**: Processa múltiplos IPTs via CSV, insere em `ocorrencias`, executa cache clearing

**Scripts Atuais a Refatorar**:

- **fauna.ts**: `processaFauna()` + versioning via `ipts` + limpeza por kingdom + inserção em lotes 5000
- **flora.ts**: `processaFlora()` + similar ao fauna com especificidades Plantae/Fungi
- **ocorrencia.ts**: CSV config + processamento concorrente + timeouts + transformações geospatial

## Análise dos Workflows Existentes

### Funcionamento Atual dos Scripts

#### Padrão Comum fauna.ts/flora.ts

1. Download DwC-A via `processaZip(url)`
2. Aplicação de transformações específicas (`processaFauna`/`processaFlora`)
3. Verificação de versão via coleção `ipts` (campo `version`)
4. Limpeza de dados existentes por `kingdom`
5. Inserção em lotes de 5000 documentos em `taxa`
6. Atualização de metadados IPT na coleção `ipts`
7. Criação de índices

#### Script ocorrencia.ts (Mais Complexo)

1. Carregamento de configuração via CSV (`referencias/occurrences.csv`)
2. Verificação de versão individual por IPT
3. Processamento concorrente com timeouts (10 simultâneos)
4. Transformações específicas (geospatial, normalização de estados/países)
5. Inserção por IPT com tratamento de falhas de rede
6. Gerenciamento de servidores IPT offline
7. Limpeza baseada em `iptId` individual

### Pontos de Integração para Refatoração

#### Coleção `ipts` (DbIpt)

- **Função**: Controla versioning de todos os IPTs
- **Campos**: `{ _id, version, tag, collection, ipt, set, kingdom }`
- **Uso**: Determinar se nova ingestão é necessária (comparação de versões)
- **Integração**: Preservar lógica existente, adicionar metadados de preservação original

#### Função `processaZip()`

- **Localização**: `packages/ingest/src/lib/dwca.ts`
- **Função**: Central para todos os scripts, download e extração DwC-A
- **Retorno**: `{ json, ipt }` onde `json` contém dados originais
- **Integração**: Ponto ideal para interceptar dados antes da transformação

#### Transformações Específicas

- **fauna.ts**: `processaFauna()` - transformações distribution, resourcerelationship, higherClassification
- **flora.ts**: `processaFlora()` - similar fauna + específicas vegetationType, phytogeographicDomains
- **ocorrencia.ts**: Transformações inline - geospatial (geoPoint), normalização, processamento de datas

### Estratégia de Preservação sem Quebra

#### Princípio: Inserção em Paralelo

```typescript
// Preservar original ANTES da transformação
const originalData = Object.entries(json)
await storeOriginalData(originalData, ipt, metadata)

// Aplicar transformações existentes (INALTERADAS)
const transformedData = processaData(json)

// Armazenar transformado com referência
await storeTransformedWithRef(transformedData, ipt)
```

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

- [x] Interface possui propósito claro e único por tela (workflows de ingestão e transformação são separados)
- [x] Informações acessíveis em máximo 3 cliques (dados originais e transformados claramente distinguíveis)
- [x] Performance e acessibilidade consideradas (validação de versão IPT evita reprocessamento)

### Princípio IV: Estrutura Monorepo Clara

- [x] Separação correta entre packages/ingest/ (scripts de ingestão e transformação) e packages/web/ (interface)
- [x] Uso de Bun workspaces e catalog dependencies
- [x] Comandos executados nos diretórios corretos (scripts Bun no root, web commands em packages/web/)

### Princípio V: Integração Contínua

- [x] GitHub Actions configurado para dados de biodiversidade (workflows cron e dispatch)
- [x] MongoDB dependency bem documentada (coleções originais e principais)
- [x] Validação manual em localhost:4321 planejada

### Integridade de Dados e Padrões Científicos

- [x] Nomenclatura taxonômica preservada nas coleções originais
- [x] Rastreabilidade mantida via ID bidirecional entre original e transformado
- [x] Metadados de origem e processamento preservados

### Segurança e Privacidade

- [x] Integridade do sistema mantida com validação de entrada
- [x] Logs de processamento para auditoria de transformações
- [x] Compliance com padrões Darwin Core

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
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: Monorepo existente com packages/ingest/ para processamento de dados e packages/web/ para aplicação web Astro.js

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

2. **Generate script contracts** from functional requirements:
   - Para cada ação de usuário → script interface
   - Use padrões de linha de comando consistentes
   - Output interfaces TypeScript para `/contracts/`

3. **Generate contract tests** from interfaces:
   - One test file per script
   - Assert input/output schemas
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

_Esta seção descreve o que o comando /tasks irá fazer - NÃO executar durante /plan_

**Estratégia de Refatoração (Não Criação Nova)**:

### Análise dos Scripts Existentes

1. **fauna.ts**:
   - Padrão atual: `processaZip()` → `processaFauna()` → versioning → limpeza por kingdom → inserção lotes 5000
   - Refatoração: Adicionar preservação original antes de `processaFauna()`, manter todo resto inalterado

2. **flora.ts**:
   - Padrão similar ao fauna com `processaFlora()` e suporte Plantae/Fungi
   - Refatoração: Aplicar mesmo padrão fauna.ts com especificidades flora

3. **ocorrencia.ts**:
   - Mais complexo: CSV config + concorrência + timeouts + múltiplos IPTs
   - Refatoração: Preservação individual por IPT mantendo concorrência existente

### Estrutura de Preservação

```typescript
// Padrão geral para todos os scripts
async function main() {
  // 1. Download e extração (INALTERADO)
  const { json, ipt } = await processaZip(url)

  // 2. NOVO: Preservação de dados originais
  await storeOriginalData(json, ipt, metadata)

  // 3. Transformação (INALTERADO)
  const transformedData = processData(json)

  // 4. Armazenamento (EXPANDIDO para incluir originalRef)
  await storeTransformedWithRef(transformedData, ipt)
}
```

### Tarefas de Refatoração por Prioridade

1. **Fase 1 - Preparação** (Semana 1-2):
   - Análise detalhada das transformações em fauna.ts
   - Implementação de funções de preservação original
   - Refatoração fauna.ts mantendo interface externa
   - Testes de compatibilidade com workflow GitHub Actions

2. **Fase 2 - Flora e Índices** (Semana 3-4):
   - Refatoração flora.ts seguindo padrão fauna.ts
   - Criação de índices otimizados para `taxaOriginal`
   - Testes de integração fauna + flora
   - Validação de performance (<125% tempo original)

3. **Fase 3 - Ocorrências** (Semana 5-6):
   - Refatoração ocorrencia.ts (mais complexa devido múltiplos IPTs)
   - Preservação individual por IPT mantendo concorrência
   - Criação de índices para `ocorrenciasOriginal`
   - Testes finais de compatibilidade total

### Estrutura de Dados

#### Novas Coleções

- `taxaOriginal`: Dados originais fauna/flora com metadados de ingestão
- `ocorrenciasOriginal`: Dados originais ocorrências com metadados por IPT

#### Modificações nas Coleções Existentes

- Campo `originalRef` opcional para rastreabilidade
- Manter todos os campos e índices existentes

### Critérios de Aceitação

- Scripts mantêm mesma interface externa (parâmetros, códigos saída, logs)
- Workflows GitHub Actions funcionam sem modificação
- Performance <125% do tempo original
- Falhas na preservação não quebram fluxo principal

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
- [x] Complexity deviations documented

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
