# Research: Reestruturação de Dados - Separação de Ingestão e Transformação

**Date**: 2025-10-29  
**Feature**: 003-data-restructure  
**Status**: Complete

## Research Tasks

Esta pesquisa resolve todas as incertezas técnicas identificadas na especificação, incluindo políticas de retenção de dados, mecanismos de controle de concorrência, tratamento de dependências externas, métricas de monitoramento e estratégias de automação.

---

## 1. Data Retention Policy for Raw Collections

### Decision

Reter dados brutos em `taxa_ipt` e `occurrences_ipt` indefinidamente até que deleção manual seja explicitamente acionada.

### Rationale

- **Auditoria**: Permite rastreamento completo da origem de qualquer dado transformado
- **Reprodutibilidade**: Possibilita reexecução de transformações com exatamente os mesmos dados raw
- **Debugging**: Facilita investigação de problemas em dados transformados comparando com versão original
- **Compliance científico**: Alinhado com princípios de ciência aberta e rastreabilidade de dados
- **Disk space**: Com compressão MongoDB e storage moderno, custo é aceitável vs benefícios

### Alternatives Considered

- **Retention de 30 dias**: Rejeitado - período muito curto para auditoria de longo prazo
- **Retention baseada em versão IPT**: Rejeitado - complexidade adicional sem benefício claro
- **Sem retenção (apenas transformed)**: Rejeitado - viola princípio de rastreabilidade do PRD

### Implementation Notes

- Implementar via política de lifecycle do MongoDB se necessário no futuro
- Documentar comando manual de cleanup: `db.taxa_ipt.deleteMany({})` (somente para casos excepcionais)
- Adicionar warning nos scripts de transformação sobre não deletar raw collections

---

## 2. Concurrency Control Mechanism

### Decision

Usar coleção MongoDB `transform_status` com flags atômicas de processo e timestamps para controle de concorrência.

### Rationale

- **Simplicidade**: Solução nativa MongoDB sem dependências externas (Redis, file locks)
- **Atomicidade**: `findOneAndUpdate` com `upsert:true` garante operações atômicas
- **Visibilidade**: Permite consultar estado atual de transformações via queries simples
- **Timeout detection**: Timestamps permitem identificar locks obsoletos (processo crashed)
- **Monorepo friendly**: Funciona tanto em workflows GitHub Actions quanto execuções locais

### Alternatives Considered

- **File-based locks**: Rejeitado - problemático em ambientes distribuídos (GitHub Actions runners)
- **Redis distributed lock**: Rejeitado - adiciona dependência externa desnecessária
- **Process ID tracking**: Rejeitado - PIDs não são únicos entre diferentes runners

### Implementation Schema

```typescript
interface TransformStatus {
  process_type: 'taxa' | 'occurrences'
  status: 'running' | 'completed' | 'failed'
  started_at: Date
  updated_at: Date
  process_id: string // UUID gerado por cada execução
  runner_id?: string // GitHub runner ID se aplicável
}
```

### Implementation Notes

- Lock acquisition: `findOneAndUpdate({process_type: 'taxa', status: {$ne: 'running'}}, {$set: {status: 'running', started_at: new Date(), process_id: uuid()}}, {upsert: true})`
- Lock release: `updateOne({process_id: uuid}, {$set: {status: 'completed', updated_at: new Date()}})`
- Timeout check: Considerar lock obsoleto se `updated_at < Date.now() - 2 hours`
- Heartbeat opcional: Atualizar `updated_at` a cada 5 minutos durante transformação longa

---

## 3. External Collector Parsing Dependency Handling

### Decision

Parsing falha graciosamente preservando `recordedBy` original sem modificação, registrando warning em log para rastreabilidade.

### Rationale

- **Resiliência**: Transformação não deve falhar completamente por dependência externa
- **Data integrity**: Melhor ter dado original que dado corrompido ou ausente
- **Debugging**: Warnings em log permitem identificar quais registros não foram parseados
- **Retry capability**: Preservar original permite reprocessamento futuro quando dependência recuperar
- **Graceful degradation**: Sistema funciona com funcionalidade reduzida mas não quebra

### Alternatives Considered

- **Fail entire transformation**: Rejeitado - muito disruptivo, milhões de registros perderiam processamento
- **Skip record entirely**: Rejeitado - perda de dados valiosos apenas por falha em um campo
- **Use cached parser**: Considerado mas complexo - requer versionamento e storage de parser

### Implementation Notes

```typescript
try {
  const parsedCollectors = await parseCollectors(recordedBy)
  record.collectors = parsedCollectors
} catch (error) {
  console.warn(
    `Collector parsing failed for record ${record._id}: ${error.message}`
  )
  record.recordedBy = originalRecordedBy // Preserve original
  record.parsingStatus = 'failed'
}
```

- Adicionar campo opcional `parsingStatus` para facilitar queries de registros com parsing pendente
- Criar métrica em `process_metrics` para tracking de taxa de sucesso de parsing
- Documentar no README que parsing de coletores depende de `https://github.com/biopinda/coletores-BO`

---

## 4. Metrics and Monitoring Targets

### Decision

Implementar métricas operacionais básicas: duração de processos, contagem de registros (inseridos/atualizados/falhas), taxa de erro por tipo.

### Rationale

- **Operational visibility**: Essencial para identificar degradação de performance ou aumento de erros
- **Capacity planning**: Duração de processos ajuda a prever tempo de execução e planejar recursos
- **Quality assurance**: Taxa de erro permite identificar problemas em fontes de dados ou parsing
- **Simple first**: Começar com métricas básicas, expandir se necessário (YAGNI principle)
- **Self-contained**: Usar MongoDB para storage evita dependências externas (Prometheus, Grafana)

### Alternatives Considered

- **Full observability stack (Prometheus + Grafana)**: Rejeitado - over-engineering para projeto atual
- **Only logs (no metrics)**: Rejeitado - logs são difíceis de agregar e analisar tendências
- **External SaaS (DataDog, NewRelic)**: Rejeitado - custo adicional e dados sensíveis externos

### Metrics Schema

```typescript
interface ProcessMetrics {
  process_type:
    | 'ingest_taxa'
    | 'ingest_occurrences'
    | 'transform_taxa'
    | 'transform_occurrences'
  resource_identifier?: string // IPT URL ou 'all' para transformações
  started_at: Date
  completed_at: Date
  duration_seconds: number
  records_processed: number
  records_inserted: number
  records_updated: number
  records_failed: number
  error_summary: { [errorType: string]: number } // e.g., {network: 5, validation: 12}
  runner_id?: string // GitHub runner para correlação
}
```

### Implementation Notes

- Coleção MongoDB: `process_metrics` com índice em `started_at` para queries temporais
- Inserir ao final de cada processo (ingest por IPT, transform uma vez)
- Dashboard endpoint `/api/metrics/summary` para visualização agregada
- Retention: Manter últimos 90 dias de métricas, arquivar mais antigos

### Key Performance Indicators (KPIs)

- **Duração de ingestão completa**: <2 horas target (alerta se >3 horas)
- **Taxa de sucesso de IPTs**: >95% target (alerta se <90%)
- **Duração de transformação taxa**: <30 minutos target
- **Duração de transformação occurrences**: <1 hora target
- **Taxa de erro de validação**: <5% aceitável (alerta se >10%)

---

## 5. Transformation Trigger Strategy

### Decision

Transformação automática via GitHub Actions workflows disparados imediatamente após conclusão bem-sucedida de workflows de ingestão, com opção `workflow_dispatch` para execução manual.

### Rationale

- **Automation**: Reduz work manual e garante dados transformados sempre sincronizados com raw
- **CI/CD best practices**: Pipelines sequenciais são padrão em workflows modernos
- **Flexibility**: `workflow_dispatch` permite reprocessamento manual quando necessário (debugging, schema changes)
- **Consistency**: Garante que transformações sempre usam versão mais recente dos scripts
- **Auditability**: GitHub Actions registra todas as execuções com logs completos

### Alternatives Considered

- **Manual trigger only**: Rejeitado - propenso a erros humanos e atrasos
- **Cron-based schedule**: Rejeitado - pode executar transformação sem novos dados raw
- **Database trigger (MongoDB change streams)**: Rejeitado - complexidade adicional, dificulta debugging

### Workflow Architecture

```yaml
# .github/workflows/ingest-flora.yml
name: Ingest Flora Data
on:
  schedule:
    - cron: '0 2 * * 0' # Sunday 2:00 AM
  workflow_dispatch:

jobs:
  ingest:
    runs-on: self-hosted
    steps:
      - name: Run flora ingestion
        run: bun run ingest:flora

  trigger-transform:
    needs: ingest
    uses: ./.github/workflows/transform-taxa.yml
```

```yaml
# .github/workflows/transform-taxa.yml
name: Transform Taxa Data
on:
  workflow_call: # Called by ingest workflows
  workflow_dispatch: # Manual execution

jobs:
  transform:
    runs-on: self-hosted
    steps:
      - name: Check transform lock
        run: bun run transform:check-lock taxa

      - name: Run taxa transformation
        run: bun run transform:taxa
```

### Implementation Notes

- Criar scripts CLI: `bun run transform:taxa`, `bun run transform:occurrences`
- Implementar `transform:check-lock` para verificar `transform_status` antes de executar
- Workflows devem falhar com exit code >0 se lock não pode ser adquirido
- Adicionar timeout de 3 horas para workflows de transformação (safety)
- Documentar processo manual de unlock em caso de lock obsoleto

---

## 6. MongoDB Index Strategy

### Decision

Manter índices existentes já implementados (FR-070 a FR-075), criar novos apenas se queries específicas apresentarem performance issues.

### Rationale

- **Already solved**: Código atual já implementa 30+ índices otimizados via `createIndexSafely()`
- **Avoid premature optimization**: Adicionar índices sem workload real pode degradar performance de writes
- **Code preservation**: Requirement explícito de preservar lógica de index creation existente
- **Measure first**: Usar `explain()` e slow query log para identificar necessidades reais

### Alternatives Considered

- **Full text search indexes**: Rejeitado por enquanto - Meilisearch é opcional e pode ser adicionado depois
- **Compound indexes reordering**: Rejeitado - índices atuais foram testados em produção
- **Remove indexes**: Rejeitado - podem estar otimizando queries não documentadas

### Implementation Notes

- Preservar todo código de `createIndexSafely()` e lista de índices
- Usar MongoDB Atlas Performance Advisor (se disponível) para sugestões
- Documentar índices por use case para facilitar manutenção futura

---

## 7. Error Handling Patterns

### Decision

Reutilizar padrões existentes: `isNetworkError()`, `failedIpts Set`, `ordered:false`, `safeInsertMany()` chunking.

### Rationale

- **Battle-tested**: Código atual já trata BSON limit, network errors, 404s conforme documentado
- **Consistency**: Manter mesmos patterns reduz cognitive load e bugs
- **Code preservation**: Requirement explícito de preservar error handling logic

### Key Patterns to Reuse

1. **Network resilience**: `isNetworkError()` detecta timeout/ECONNRESET/etc
2. **Partial failure tolerance**: `ordered:false` permite inserção parcial
3. **BSON chunking**: `safeInsertMany()` divide batches >16MB recursivamente
4. **Resource tracking**: `failedIpts Set` evita retry de servers offline

### Implementation Notes

- Mover patterns compartilhados para `packages/ingest/src/lib/error-handling.ts`
- Documentar cada pattern com comentários explicativos em português
- Adicionar tests unitários para error scenarios (quando test suite for implementada)

---

## 8. ID Preservation and Traceability Strategy

### Decision

Usar `_id` determinístico baseado em chave natural (taxonID para taxa, occurrenceID+iptId para occurrences), copiar exatamente entre raw e transformed collections.

### Rationale

- **Perfect traceability**: Query `db.taxa.findOne({_id: X})` e `db.taxa_ipt.findOne({_id: X})` retornam documentos relacionados
- **Audit capability**: Qualquer registro transformado pode ser rastreado ao raw em O(1)
- **Idempotency**: Mesma chave natural sempre gera mesmo `_id` em múltiplas execuções
- **No ObjectId**: Evita IDs não-determinísticos que quebrariam rastreabilidade

### Alternatives Considered

- **Separate traceability field**: Rejeitado - usar `_id` é mais simples e performático (indexed by default)
- **MongoDB ObjectId**: Rejeitado - não-determinístico, impossibilita rastreamento perfeito
- **Composite key in separate field**: Rejeitado - queries mais complexas, índices adicionais

### ID Generation Rules

**Taxa**:

```typescript
// Em ingestão (taxa_ipt):
const _id = record.taxonID // Usar taxonID do DwC-A diretamente

// Se taxonID ausente (edge case):
const _id = hashDeterministic(`${scientificName}:${kingdom}`)

// Em transformação (taxa):
transformedRecord._id = rawRecord._id // Copiar exatamente
```

**Occurrences**:

```typescript
// Em ingestão (occurrences_ipt):
const iptId = hashDeterministic(ipt.repositorio) // Identificador do IPT
const _id = `${record.occurrenceID}:${iptId}` // Combinação para unicidade

// Se occurrenceID ausente (edge case):
const fallbackKey = `${catalogNumber}:${recordNumber}:${eventDate}:${locality}:${recordedBy}`
const _id = `${hashDeterministic(fallbackKey)}:${iptId}`

// Em transformação (occurrences):
transformedRecord._id = rawRecord._id // Copiar exatamente
```

### Implementation Notes

- Função utilitária: `generateDeterministicId(type: 'taxa' | 'occurrence', record, iptId?)`
- Usar algoritmo de hash consistente (MD5 ou SHA256 primeiros 24 chars para compatibilidade com ObjectId length)
- Validar em transformação que 100% dos `_id` em transformed existem em raw (integrity check)
- Documentar estratégia de ID em README para futuros mantenedores

### Integrity Validation

```typescript
// Executar ao final de cada transformação:
const rawIds = await db.taxa_ipt.distinct('_id')
const transformedIds = await db.taxa.distinct('_id')
const orphaned = transformedIds.filter((id) => !rawIds.includes(id))
if (orphaned.length > 0) {
  throw new Error(
    `Found ${orphaned.length} transformed records without raw source`
  )
}
```

---

## 9. Package Structure and Code Organization

### Decision

Criar novo pacote `packages/transform` seguindo estrutura de `packages/ingest`, mover lógica de transformação de `flora.ts` e `fauna.ts`, preservar `packages/ingest/src/lib/` intacto.

### Rationale

- **Separation of concerns**: Ingestão e transformação são responsabilidades distintas
- **Reusability**: Funções de lib podem ser importadas por ambos ingest e transform
- **Monorepo consistency**: Seguir padrão já estabelecido de múltiplos packages
- **Code preservation**: Requirement explícito de não alterar código em src/lib/

### Package Structure

```
packages/
├── ingest/
│   ├── package.json (catalog dependencies)
│   ├── tsconfig.json
│   ├── src/
│   │   ├── fauna.ts → REFACTOR: apenas ingestão raw
│   │   ├── flora.ts → REFACTOR: apenas ingestão raw
│   │   ├── ocorrencia.ts → REFACTOR: apenas ingestão raw
│   │   └── lib/ → PRESERVE: não alterar
│   │       ├── dwca.ts
│   │       └── normalization.ts
│
├── transform/ → NEW PACKAGE
│   ├── package.json (catalog deps + reference to @darwincore/ingest)
│   ├── tsconfig.json
│   ├── src/
│   │   ├── taxa.ts → transformação de taxa_ipt → taxa
│   │   ├── occurrences.ts → transformação de occurrences_ipt → occurrences
│   │   ├── lib/
│   │   │   ├── concurrency.ts → transform_status management
│   │   │   ├── metrics.ts → process_metrics recording
│   │   │   ├── validation.ts → coordinate/date validators
│   │   │   └── aggregation.ts → ameaça, invasoras, UCs
│   │   └── cli/
│   │       ├── check-lock.ts → bun run transform:check-lock
│   │       └── index.ts → CLI entrypoint
│
├── web/
│   └── (unchanged)
```

### Alternatives Considered

- **Keep transforms in packages/ingest**: Rejeitado - viola single responsibility
- **Separate packages per domain (taxa, occurrences)**: Rejeitado - over-engineering, muito overlap
- **Monolithic src/ at root**: Rejeitado - não segue padrão monorepo estabelecido

### Implementation Notes

- Root `package.json` adicionar: `"transform:taxa": "bun run --filter @darwincore/transform taxa"`
- `packages/transform/package.json`:
  ```json
  {
    "name": "@darwincore/transform",
    "dependencies": {
      "@darwincore/ingest": "workspace:*",
      "mongodb": "catalog:"
      // ... outros catalog deps
    }
  }
  ```
- Importar de ingest: `import { processaEml, normalizeStateName } from '@darwincore/ingest/lib'`
- TypeScript project references: adicionar transform ao root `tsconfig.json`

---

## 10. API Contracts and Documentation Strategy

### Decision

Usar OpenAPI 3.0 (Swagger) para documentação de APIs, manter padrão REST existente, adicionar endpoints incrementalmente conforme necessário.

### Rationale

- **Already used**: Projeto já usa Swagger (`public/api-spec.json`)
- **Industry standard**: OpenAPI é padrão de facto para REST APIs
- **Interactive docs**: Swagger UI permite teste direto de endpoints
- **Contract-first**: Especificar contratos antes de implementação facilita TDD

### Alternatives Considered

- **GraphQL**: Rejeitado - adiciona complexidade, REST é suficiente para use cases atuais
- **gRPC**: Rejeitado - não há necessidade de performance extrema ou streaming
- **No formal spec**: Rejeitado - viola princípio de documentação da constituição

### API Endpoints Design

**Taxa Endpoints**:

```yaml
/api/taxa:
  get:
    summary: List taxa with filters
    parameters:
      - name: scientificName
        in: query
        schema: { type: string }
      - name: kingdom
        in: query
        schema: { type: string, enum: [Animalia, Plantae, Fungi] }
      - name: family
        in: query
      - name: limit
        schema: { type: integer, default: 100, maximum: 1000 }
      - name: offset
        schema: { type: integer, default: 0 }
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  { type: array, items: { $ref: '#/components/schemas/Taxon' } }
                pagination: { $ref: '#/components/schemas/Pagination' }

/api/taxa/{taxonID}:
  get:
    summary: Get single taxon by ID
    parameters:
      - name: taxonID
        in: path
        required: true
    responses:
      200: { $ref: '#/components/schemas/Taxon' }
      404: { description: Taxon not found }
```

**Occurrence Endpoints**:

```yaml
/api/occurrences:
  get:
    summary: List occurrences with filters
    parameters:
      - name: scientificName
      - name: stateProvince
      - name: bbox # format: minLon,minLat,maxLon,maxLat
        schema:
          {
            type: string,
            pattern: '^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$'
          }
      - name: year
      - name: limit / offset
    responses:
      200: # similar structure to taxa

/api/occurrences/count:
  get:
    summary: Count occurrences matching filters
    parameters: # same as /api/occurrences
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                count: { type: integer }
                filters: { type: object }
```

### Implementation Notes

- Atualizar `public/api-spec.json` com novos endpoints
- Implementar endpoints em `packages/web/src/pages/api/`
- Usar Astro API routes: `src/pages/api/taxa.ts`, `src/pages/api/occurrences.ts`
- Validação de parâmetros usando zod (já usado no projeto)
- Pagination padrão: limit=100, max=1000 (evitar queries muito grandes)

---

## 11. Web Interface Adaptation Strategy

### Decision

Adaptar páginas existentes (taxa, mapa, dashboard, tree, chat) para consumir novas collections via APIs sem mudanças visuais significativas - refactor backend, manter UX.

### Rationale

- **User continuity**: Usuários já conhecem interface atual
- **Principle III compliance**: Não adicionar complexidade desnecessária à UX
- **Backend-only change**: Arquitetura permite trocar source de dados sem alterar frontend
- **Incremental migration**: Páginas podem ser adaptadas uma por vez

### Alternatives Considered

- **Full UI redesign**: Rejeitado - out of scope, viola princípio de simplicidade
- **Dual mode (old + new data)**: Rejeitado - complexidade adicional sem benefício claro
- **No adaptation**: Rejeitado - feature seria inútil sem interface funcional

### Page-by-Page Adaptation Plan

**1. Taxa Search (`/taxa`)**:

- **Current**: Busca diretamente em collection `taxa` (sem distinção raw/transformed)
- **New**: Buscar em collection `taxa` (já transformada)
- **Changes**: Nenhuma mudança visual - apenas garantir que queries funcionam com novo schema
- **Risk**: Baixo - schema transformado mantém campos essenciais

**2. Map (`/mapa`)**:

- **Current**: Carrega occurrences com geoPoint para renderizar no mapa
- **New**: Carregar de collection `occurrences` (transformada)
- **Changes**: Verificar que campo `geoPoint` (GeoJSON Point) está presente e válido
- **Risk**: Médio - depende de validação correta de coordenadas na transformação

**3. Dashboard (`/dashboard`)**:

- **Current**: Calcula estatísticas agregadas via cache (`cache/dashboard-data.json`)
- **New**: Atualizar cron job para agregar de `taxa` e `occurrences` (transformadas)
- **Changes**: Modificar `cron-dashboard.js` para usar novas collections
- **Risk**: Baixo - agregações são batch jobs, não afetam tempo real

**4. Tree View (`/tree`)**:

- **Current**: Constrói hierarquia taxonômica de collection `taxa`
- **New**: Usar collection `taxa` (transformada)
- **Changes**: Verificar que `higherClassification` processado corretamente
- **Risk**: Baixo - transformação preserva campos hierárquicos

**5. Chat (`/chat`)**:

- **Current**: ChatBB consulta taxa e occurrences para responder perguntas
- **New**: Configurar prompts para consultar collections transformadas
- **Changes**: Atualizar contexto de AI para mencionar novas collections
- **Risk**: Baixo - AI é agnóstica ao source, queries MongoDB permanecem similares

### Implementation Notes

- Criar branch de testes para cada página adaptada
- Validação manual: testar cada página com dados transformados localmente
- Rollback plan: manter queries antigas comentadas por 1 sprint
- Performance monitoring: comparar response times antes/depois

---

## Research Completion Summary

Todas as incertezas técnicas foram resolvidas:

✅ **Data Retention**: Retenção indefinida com cleanup manual  
✅ **Concurrency**: MongoDB `transform_status` collection com atomic operations  
✅ **External Dependencies**: Graceful degradation preservando dados originais  
✅ **Metrics**: Coleção `process_metrics` com KPIs operacionais básicos  
✅ **Automation**: GitHub Actions workflows com trigger automático e manual  
✅ **Index Strategy**: Preservar índices existentes, medir antes de adicionar novos  
✅ **Error Handling**: Reutilizar patterns battle-tested do código atual  
✅ **ID Strategy**: IDs determinísticos baseados em chave natural, cópia exata entre raw/transformed  
✅ **Package Structure**: Novo `packages/transform` seguindo padrão monorepo  
✅ **API Contracts**: OpenAPI 3.0 via Swagger, REST endpoints incrementais  
✅ **Web Adaptation**: Backend refactor preservando UX atual

**Ready to proceed to Phase 1: Design & Contracts**
