# Tasks: Manter Dados Originais

**Input**: Design documents from `/specs/003-manter-dados-or### Fase 3.4 → 3.5

- T033-T037 devem completar antes de T038-T041 (workflows dependem dos scripts)

### Fase 3.5 → 3.6

- T038-T041 devem completar antes de T042-T048 (validação da integração)erequisites\*\*: plan.md, research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Analisar scripts existentes em packages/ingest/src/
   → fauna.ts, flora.ts, ocorrencia.ts
   → Identificar pontos de integração para preservação
2. Refatorar scripts de ingestão existentes para preservar dados originais
   → Adicionar coleções taxaOriginal e ocorrenciasOriginal
   → Manter compatibilidade total com workflows GitHub Actions
3. Criar novos scripts de transformação offline (separados da ingestão)
   → Scripts dedicados para transformação de dados preservados
   → Sistema de fallback para dados originais
4. Criar novos workflows GitHub Actions para transformação
   → Manter workflows de ingestão existentes inalterados
   → Adicionar workflows dedicados apenas para transformação
5. Implementar controle de concorrência e versionamento
   → Locks de processamento, verificação de versão IPT
6. Validar integração completa e performance
   → Testes manuais conforme quickstart.md
```

## Formato: `[ID] [P?] Descrição`

- **[P]**: Pode executar em paralelo (arquivos diferentes, sem dependências)
- Caminhos exatos incluídos nas descrições

## Estrutura do Monorepo

- **packages/ingest/**: Scripts de processamento de dados Bun
- **packages/web/**: Aplicação web Astro.js
- **GitHub Actions**: `.github/workflows/`
- **Testes**: bun:test como framework padrão para todas as suítes de teste

### Arquitetura de Transformação por Pipeline

Cada tipo de dados (fauna, flora, ocorrências) terá:

1. **Script de ingestão refatorado**: Preserva dados originais + aplica transformações básicas
2. **Script de transformação offline**: Processa dados preservados usando pipeline específico
3. **Pipeline de transformação**: Conjunto de funções transformadoras executadas em série para cada documento
   - `fauna`: processamento de distribuição → relacionamentos → classificação hierárquica
   - `flora`: processamento de vegetação → domínios fitogeográficos → classificação
   - `ocorrências`: normalização geoespacial → validação de datas → padronização de coletores

### Concorrência de Workflows

- **Ingestão**: Workflows originais mantêm cronograma sequencial (fauna 02:00, flora 02:30, ocorrências 03:00)
- **Transformação**: Workflows novos podem executar em paralelo por tipo com chaves específicas:
  - `transformacao-fauna`: Máximo 1 execução simultânea para fauna
  - `transformacao-flora`: Máximo 1 execução simultânea para flora
  - `transformacao-ocorrencias`: Máximo 1 execução simultânea para ocorrências

## Fase 3.1: Preparação e Análise

- [ ] T001 Analisar estrutura atual dos scripts em `packages/ingest/src/fauna.ts`
- [ ] T002 [P] Analisar estrutura atual dos scripts em `packages/ingest/src/flora.ts`
- [ ] T003 [P] Analisar estrutura atual dos scripts em `packages/ingest/src/ocorrencia.ts`
- [ ] T004 [P] Analisar função `processaZip()` em `packages/ingest/src/lib/dwca.ts`
- [ ] T005 Criar documentação de pontos de integração baseada na análise
- [ ] T006 [P] Configurar índices MongoDB para novas coleções `taxaOriginal` e `ocorrenciasOriginal`

## Fase 3.2: Testes Primeiro (TDD) ⚠️ DEVE COMPLETAR ANTES DA 3.3

**CRÍTICO: Estes testes DEVEM ser escritos e DEVEM FALHAR antes de QUALQUER implementação**

- [ ] T007 [P] Teste de contrato para `ingerir-fauna.ts` usando bun:test em `packages/ingest/tests/contracts/ingerir-fauna.test.ts`
- [ ] T008 [P] Teste de contrato para `ingerir-flora.ts` usando bun:test em `packages/ingest/tests/contracts/ingerir-flora.test.ts`
- [ ] T009 [P] Teste de contrato para `ingerir-ocorrencias.ts` usando bun:test em `packages/ingest/tests/contracts/ingerir-ocorrencias.test.ts`
- [ ] T010 [P] Teste de contrato para `transformar-fauna.ts` usando bun:test em `packages/ingest/tests/contracts/transformar-fauna.test.ts`
- [ ] T011 [P] Teste de contrato para `transformar-flora.ts` usando bun:test em `packages/ingest/tests/contracts/transformar-flora.test.ts`
- [ ] T012 [P] Teste de contrato para `transformar-ocorrencias.ts` usando bun:test em `packages/ingest/tests/contracts/transformar-ocorrencias.test.ts`
- [ ] T013 [P] Teste de integração de preservação de dados originais usando bun:test em `packages/ingest/tests/integration/preservacao-dados-originais.test.ts`
- [ ] T014 [P] Teste de integração de rastreabilidade bidirecional usando bun:test em `packages/ingest/tests/integration/rastreabilidade-bidirecional.test.ts`
- [ ] T015 [P] Teste de integração de controle de concorrência usando bun:test em `packages/ingest/tests/integration/controle-concorrencia.test.ts`

## Fase 3.3: Implementação Core (SOMENTE após testes falhando)

### Estruturas de Dados e Utilitários

- [ ] T016 [P] Interface `DocumentoOriginal` em `packages/ingest/src/types/documento-original.ts`
- [ ] T017 [P] Interface `BloqueioDProcessamento` em `packages/ingest/src/types/bloqueio-processamento.ts`
- [ ] T018 [P] Funções de controle de bloqueio em `packages/ingest/src/lib/gerenciador-bloqueios.ts`
- [ ] T019 [P] Funções de verificação de versão IPT em `packages/ingest/src/lib/verificador-versao.ts`
- [ ] T020 [P] Funções de preservação de dados originais em `packages/ingest/src/lib/preservador-dados-originais.ts`

### Refatoração de Scripts de Ingestão

- [ ] T021 Refatorar `packages/ingest/src/fauna.ts` para preservar dados originais
- [ ] T022 Refatorar `packages/ingest/src/flora.ts` para preservar dados originais
- [ ] T023 Refatorar `packages/ingest/src/ocorrencia.ts` para preservar dados originais

### Criação de Scripts de Transformação Offline (Novos)

- [ ] T024 [P] Implementar `packages/ingest/src/scripts/transformar-fauna.ts`
- [ ] T025 [P] Implementar `packages/ingest/src/scripts/transformar-flora.ts`
- [ ] T026 [P] Implementar `packages/ingest/src/scripts/transformar-ocorrencias.ts`

### Transformadores Específicos (Pipelines de Múltiplas Funções)

- [ ] T027 [P] Pipeline de transformação fauna em `packages/ingest/src/transformers/fauna/pipeline.ts`
- [ ] T028 [P] Pipeline de transformação flora em `packages/ingest/src/transformers/flora/pipeline.ts`
- [ ] T029 [P] Pipeline de transformação ocorrências em `packages/ingest/src/transformers/ocorrencias/pipeline.ts`

### Scripts Utilitários

- [ ] T030 [P] Implementar `packages/ingest/src/scripts/verificar-bloqueios.ts`
- [ ] T031 [P] Implementar `packages/ingest/src/scripts/limpar-bloqueios.ts`
- [ ] T032 [P] Implementar `packages/ingest/src/scripts/status-ipt.ts`

## Fase 3.4: Workflows GitHub Actions

- [ ] T033 [P] Criar workflow de transformação em `.github/workflows/transformar-fauna.yml`
- [ ] T034 [P] Criar workflow de transformação em `.github/workflows/transformar-flora.yml`
- [ ] T035 [P] Criar workflow de transformação em `.github/workflows/transformar-ocorrencias.yml`
- [ ] T036 Configurar chaves de concorrência específicas por tipo: `transformacao-fauna`, `transformacao-flora`, `transformacao-ocorrencias` (máximo 1 execução por tipo, permitindo paralelismo entre tipos)
- [ ] T037 [P] Atualizar documentação dos workflows existentes em `docs/workflows.md`

## Fase 3.5: Integração e Compatibilidade

- [ ] T038 Adicionar campos de rastreabilidade às coleções existentes (migração de esquema)
- [ ] T039 Implementar sistema de fallback em `packages/ingest/src/lib/manipulador-fallback.ts`
- [ ] T040 Criar índices otimizados para consultas de rastreabilidade
- [ ] T041 Validar compatibilidade com aplicação web em `packages/web/`

## Fase 3.6: Testes e Validação

- [ ] T042 [P] Testes unitários para preservação de dados usando bun:test em `packages/ingest/tests/unit/dados-originais.test.ts`
- [ ] T043 [P] Testes unitários para transformação usando bun:test em `packages/ingest/tests/unit/transformacao.test.ts`
- [ ] T044 [P] Testes unitários para controle de versão usando bun:test em `packages/ingest/tests/unit/controle-versao.test.ts`
- [ ] T045 Executar cenários de validação do `quickstart.md`
- [ ] T046 Teste de performance (<125% do tempo original)
- [ ] T047 [P] Atualizar documentação em `docs/processamento-dados.md`
- [ ] T048 [P] Atualizar instruções do agente em `.github/copilot-instructions.md`

## Dependências

### Fase 3.1 → 3.2

- T001-T005 devem completar antes de T007-T015 (análise informa testes)

### Fase 3.2 → 3.3

- T007-T015 devem completar (e falhar) antes de T016-T032 (TDD)

### Dentro da Fase 3.3

- T016-T020 (tipos e utilitários) antes de T021-T026 (scripts principais)
- T021-T023 (ingestão) antes de T024-T026 (transformação)
- T024-T026 (scripts) antes de T027-T029 (pipelines específicos)

### Fase 3.3 → 3.4

- T021-T032 devem completar antes de T033-T036 (workflows dependem dos scripts)

### Fase 3.4 → 3.5

- T033-T036 devem completar antes de T037-T040 (integração com workflows)

### Fase 3.5 → 3.6

- T037-T040 devem completar antes de T041-T047 (validação da integração)

## Exemplos de Execução Paralela

### Análise inicial (Fase 3.1):

```
Task: "Analisar estrutura atual dos scripts em packages/ingest/src/flora.ts"
Task: "Analisar estrutura atual dos scripts em packages/ingest/src/ocorrencia.ts"
Task: "Analisar função processaZip() em packages/ingest/src/lib/dwca.ts"
```

### Testes de contrato (Fase 3.2):

```
Task: "Teste de contrato para ingerir-fauna.ts usando bun:test em packages/ingest/tests/contracts/ingerir-fauna.test.ts"
Task: "Teste de contrato para ingerir-flora.ts usando bun:test em packages/ingest/tests/contracts/ingerir-flora.test.ts"
Task: "Teste de contrato para ingerir-ocorrencias.ts usando bun:test em packages/ingest/tests/contracts/ingerir-ocorrencias.test.ts"
```

### Tipos e utilitários base (Fase 3.3):

```
Task: "Interface DocumentoOriginal em packages/ingest/src/types/documento-original.ts"
Task: "Interface BloqueioProcessamento em packages/ingest/src/types/bloqueio-processamento.ts"
Task: "Funções de controle de bloqueio em packages/ingest/src/lib/gerenciador-bloqueios.ts"
```

### Scripts de transformação (Fase 3.3):

```
Task: "Implementar packages/ingest/src/scripts/transformar-fauna.ts"
Task: "Implementar packages/ingest/src/scripts/transformar-flora.ts"
Task: "Implementar packages/ingest/src/scripts/transformar-ocorrencias.ts"
```

### Workflows (Fase 3.4):

```
Task: "Criar workflow de transformação em .github/workflows/transformar-fauna.yml"
Task: "Criar workflow de transformação em .github/workflows/transformar-flora.yml"
Task: "Criar workflow de transformação em .github/workflows/transformar-ocorrencias.yml"
Task: "Configurar chaves específicas: transformacao-fauna, transformacao-flora, transformacao-ocorrencias"
```

## Notas Importantes

### Compatibilidade

- Scripts de ingestão mantêm interface externa inalterada
- Workflows GitHub Actions existentes não são modificados
- Aplicação web continua funcionando normalmente

### Performance

- Meta: <125% do tempo de ingestão original
- Preservação de dados originais é best-effort (não quebra fluxo principal)
- Transformação offline é separada da ingestão
- Transformações por tipo podem executar em paralelo

### Concorrência

- **Ingestão**: Mantém sequenciamento temporal existente
- **Transformação**: Paralelismo controlado por tipo via chaves específicas
- **Testes**: bun:test para padronização e performance

### Estrutura Monorepo

- packages/ingest/: Scripts Bun de processamento de dados
- packages/web/: Aplicação web Astro.js (não modificada nesta feature)
- Bun workspaces para gerenciamento de dependências
- bun:test para execução de todas as suítes de teste

## Validação de Checklist

_GATE: Checado pelo main() antes de retornar_

- [x] Todos os contratos têm testes correspondentes usando bun:test (T007-T012)
- [x] Todas as entidades do data model têm tarefas (T016-T017, T038)
- [x] Todos os testes vêm antes da implementação (Fase 3.2 → 3.3)
- [x] Tarefas paralelas são verdadeiramente independentes (arquivos diferentes)
- [x] Cada tarefa especifica caminho exato do arquivo
- [x] Nenhuma tarefa [P] modifica o mesmo arquivo que outra tarefa [P]
- [x] Sistema de testes padronizado em bun:test para todo o projeto

## Regras de Geração de Tarefas

_Aplicadas durante execução do main()_

1. **Dos Contratos**:
   - script-interfaces.md → 6 testes de contrato (T007-T012)
   - workflow-contracts.md → 3 workflows (T033-T035)

2. **Do Data Model**:
   - OriginalDocument → interface e funções (T016, T020)
   - ProcessingLock → interface e manager (T017, T018)
   - Coleções existentes → migração de esquema (T037)

3. **Das User Stories (quickstart.md)**:
   - 7 cenários → testes de integração (T013-T015, T044)
   - Validações → testes unitários (T041-T043)

4. **Ordenação**:
   - Análise → Testes → Tipos → Scripts → Workflows → Integração → Validação
   - Dependências bloqueiam execução paralela

## Critérios de Aceitação Finais

- [ ] Scripts de ingestão mantêm mesma interface externa
- [ ] Workflows GitHub Actions funcionam sem modificação
- [ ] Performance <125% do tempo original
- [ ] Falhas na preservação não quebram fluxo principal
- [ ] Rastreabilidade bidirecional entre dados originais e transformados
- [ ] Sistema de fallback funcional para transformações com falha
- [ ] Controle de concorrência impede processamento simultâneo
- [ ] Todos os cenários do quickstart.md funcionam corretamente
