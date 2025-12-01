# Feature Specification: Pipeline Integrado Biodiversidade.Online V5.0

**Created**: 2025-12-01
**Status**: Draft

## Overview

O Biodiversidade.Online V5.0 consolida a arquitetura de processamento de dados de biodiversidade brasileira em um pipeline integrado onde ingestão e transformação ocorrem no mesmo processo.

## User Scenarios & Testing

### User Story 1 - Pesquisador consulta dados (Priority: P1)

Um pesquisador acessa a plataforma para consultar informações sobre espécies brasileiras.

**Why this priority**: Pesquisadores são stakeholders críticos.

**Independent Test**: Buscar espécie "Vriesea" via interface, receber dados em < 2 segundos.

**Acceptance Scenarios**:

1. **Given** pesquisador na página de busca, **When** busca por nome científico, **Then** recebe resultado com informações taxonômicas
2. **Given** espécie tem registros, **When** visualiza distribuição, **Then** vê mapa georreferenciado
3. **Given** espécie em lista de ameaçadas, **When** consulta, **Then** vê informações de ameaça

---

### User Story 2 - Sistema atualiza automaticamente (Priority: P1)

Sistema baixa novos dados toda semana e torna disponível sem intervenção manual.

**Why this priority**: Essencial para manter dados frescos.

**Independent Test**: Workflow executa, insere dados em taxa_ipt/occurrences_ipt, transforma para taxa/occurrences.

**Acceptance Scenarios**:

1. **Given** domingo 02:00 UTC, **When** workflow Flora dispara, **Then** dados disponíveis < 30 min
2. **Given** Flora sucesso, **When** Fauna 02:30, **Then** processa independentemente
3. **Given** Flora/Fauna, **When** Ocorrências 03:00, **Then** ~490 IPTs processados

---

### User Story 3 - Developer corrige transformação (Priority: P2)

Developer modifica lógica, sistema re-transforma sem re-ingerir.

**Why this priority**: Permite iteração rápida.

**Acceptance Scenarios**:

1. **Given** developer modifica `@darwincore/transform/src/taxa/`, **When** push, **Then** workflow dispara
2. **Given** workflow, **When** re-transforma, **Then** taxa_ipt → taxa sem duplicação

---

### User Story 4 - API para integradores (Priority: P2)

APIs REST com Swagger retornam dados em JSON.

**Why this priority**: Ponte para integradores e análises.

**Acceptance Scenarios**:

1. **Given** GET /api/taxa?search=Vriesea retorna ≤1000 registros, **When** processa, **Then** JSON retornado em < 1 segundo
2. **Given** filtro por estado, **When** busca registros de São Paulo, **Then** apenas taxa com distribuição em SP retornam
3. **Given** query para /api/occurrences com bbox, **When** retorna ≤1000 ocorrências, **Then** resposta em < 1 segundo
4. **Given** endpoint /api/occurrences/geojson, **When** gera FeatureCollection, **Then** JSON válido com até 1000 features em < 2 segundos

---

### User Story 5 - Curador valida dados (Priority: P3)

Curador compara bruto vs. transformado para auditoria.

**Why this priority**: Controle de qualidade importante.

**Acceptance Scenarios**:

1. **Given** curador em página auditoria, **When** busca ID, **Then** vê par lado a lado

---

### User Story 6 - Interface web adaptada (Priority: P3)

Interface web atualizada para consumir novas coleções transformadas.

**Why this priority**: Mantém usabilidade após mudanças arquiteturais.

**Independent Test**: Acessar páginas `/taxa`, `/mapa`, `/dashboard`, `/tree`, `/chat` e confirmar carregamento correto com dados das novas coleções em < 2 segundos.

**Acceptance Scenarios**:

1. **Given** página `/taxa`, **When** busca espécie, **Then** dados vêm de collection `taxa`
2. **Given** página `/mapa`, **When** carrega, **Then** ocorrências vêm de collection `occurrences` com geoPoint válido
3. **Given** página `/dashboard`, **When** renderiza, **Then** cache construído a partir de `taxa` e `occurrences`
4. **Given** página `/tree`, **When** expande nó, **Then** hierarquia segue nova structure de `taxa`
5. **Given** página `/chat`, **When** consulta assistente, **Then** prompts mencionam collections transformadas

---

### Edge Cases

- E1: IPT indisponível - continua com outros, falha logada
- E2: Dados malformados - salvos em bruta, não transformados, erro logado
- E3: Re-transformação demora - libera lock se > 2h
- E4: Duplicação entre IPTs - detectada antes de inserir
- E5: País ≠ Brasil - filtrado, retido em bruta

## Requirements

### Functional Requirements

- **FR-101**: MUST baixar Flora de ipt.jbrj.gov.br
- **FR-102**: MUST baixar Fauna de ipt.jbrj.gov.br
- **FR-103**: MUST processar ~490 repositórios de occurrences.csv
- **FR-104**: MUST armazenar brutos em taxa_ipt e occurrences_ipt
- **FR-109**: MUST validar estrutura DwC-A e tratar arquivos malformados com mensagens de erro descritivas
- **FR-105**: MUST transformar taxa inline após insert
- **FR-106**: MUST transformar occurrences por batch
- **FR-107**: MUST preservar \_id idêntico entre raw e transformado
- **FR-201**: MUST extrair canonicalName de scientificName
- **FR-202**: MUST validar taxonRank
- **FR-203**: MUST normalizar campos categóricos
- **FR-204**: MUST enriquecer ameaça
- **FR-205**: MUST enriquecer invasoras
- **FR-206**: MUST enriquecer UCs
- **FR-301**: MUST validar georreferência
- **FR-302**: MUST normalizar eventDate
- **FR-303**: MUST harmonizar continent
- **FR-304**: MUST filtrar país Brasil
- **FR-305**: MUST normalizar stateProvince
- **FR-306**: MUST validar county IBGE
- **FR-307**: MUST atualizar sinônimos
- **FR-308**: MUST associar TaxonID
- **FR-401**: MUST expor REST taxa
- **FR-402**: MUST expor REST ocorrências
- **FR-403**: MUST documentar Swagger
- **FR-404**: MUST retornar JSON
- **FR-405**: MUST suportar paginação
- **FR-501**: MUST manter web funcionando
- **FR-502**: MUST adaptar web para coleções
- **FR-601**: MUST flora domingo 02:00 UTC
- **FR-602**: MUST fauna domingo 02:30 UTC
- **FR-603**: MUST ocorrências domingo 03:00 UTC
- **FR-604**: MUST re-transform taxa ao modificar
- **FR-605**: MUST re-transform occurrences ao modificar
- **FR-606**: MUST permitir disparo manual
- **FR-701**: MUST loggar métricas
- **FR-702**: MUST usar locks
- **FR-703**: MUST verificar locks manualmente
- **FR-704**: MUST rastrear transformações

### Key Entities

- **Taxa**: Entidade taxonômica com metadados
- **Ocorrência**: Registro observacional com georreferência
- **TaxonID**: ID único para taxa
- **IPT**: Repositório DwC-A (~490)
- **DwC-A**: Darwin Core Archive

## Success Criteria

- **SC-001**: Busca espécie < 1 segundo
- **SC-002**: Mapa 1000+ ocorrências < 3 segundos
- **SC-003**: Ingestão total < 2 horas
- **SC-004**: Re-transformação taxa < 30 minutos
- **SC-005**: Re-transformação occurrences < 2 horas
- **SC-006**: 99% sucesso, < 1% erro logado
- **SC-007**: APIs 100% consistentes
- **SC-008**: \_id idêntico 100%
- **SC-009**: Dashboard atualiza < 5 minutos
- **SC-010**: Recuperação automática sem perda

### Non-Functional

- **NFR-001**: TypeScript, Bun, MongoDB 4.4+, Docker, GitHub Actions
- **NFR-002**: Sem credenciais expostas, usar env vars
- **NFR-003**: ~12M occurrências, latência < 3s
- **NFR-004**: Reexecutável, sem duplicação
- **NFR-005**: Logs com timestamps, registros, erros

## Assumptions

1. MongoDB acessível via MONGO_URI
2. GitHub Actions com segredos configurados
3. DwC-A válidos ou gracefully handled
4. Código existente aproveitado
5. Meilisearch opcional
6. TypeScript/Bun/Astro mantido
7. Brutos são retenção histórica
8. Coletores canonicalização em projeto separado

## Dependencies

- PRD.md
- docs/atualizacao.md
- Pacotes `@darwincore/ingest`, `@darwincore/transform` (via Bun workspaces)
- Repositórios IPT, Flora, Fauna

## Out of Scope

- Mudança de stack
- Web além de adaptar
- Canonicalização coletores completa
- Sistemas externos além IPT
