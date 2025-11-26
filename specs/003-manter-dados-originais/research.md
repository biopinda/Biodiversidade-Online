# Research: Manter Dados Originais

**Data**: 2025-09-29  
**Especificação**: [spec.md](./spec.md)  
**Plano**: [plan.md](./plan.md)

## Decisões Técnicas

### 1. Estratégia de Coleções MongoDB

**Decisão**: Usar coleções separadas para dados originais e transformados com mesmo ID

- `taxaOriginal` / `taxa`
- `ocorrenciasOriginal` / `ocorrencias`

**Fundamentação**:

- Preserva integridade dos dados científicos originais
- Permite auditoria e rastreabilidade completa
- Facilita reprocessamento sem re-ingestão
- Mantém separação clara entre dados brutos e processados

**Alternativas Consideradas**:

- Campo `original` no mesmo documento: Rejeitado por complexidade e tamanho dos documentos
- Histórico de versões: Rejeitado por não atender necessidade de acesso direto aos dados originais

### 2. Pipeline de Transformação

**Decisão**: Funções compostas executadas em série para cada documento

```typescript
type TransformFunction<T, U> = (input: T) => U
const pipeline = [transform1, transform2, transform3].reduce(
  (acc, fn) => fn(acc),
  original
)
```

**Fundamentação**:

- Facilita manutenção e teste de transformações individuais
- Permite debugging granular de cada etapa
- Suporta rollback e versionamento de pipelines
- Compatível com estrutura funcional do TypeScript

**Alternativas Consideradas**:

- Transformações em lote: Rejeitado por dificuldade de debug e rollback
- Pipeline assíncrono: Rejeitado por complexidade desnecessária para caso de uso

### 3. Versionamento e Validação IPT

**Decisão**: Verificar hash/timestamp do IPT antes de processar

```typescript
interface IPTMetadata {
  ipt_id: string
  version_hash: string
  last_modified: Date
  last_processed: Date
}
```

**Fundamentação**:

- Evita reprocessamento desnecessário de dados não alterados
- Mantém rastreabilidade de versões de IPT
- Otimiza uso de recursos computacionais
- Permite detecção de mudanças incrementais

**Alternativas Consideradas**:

- Sempre reprocessar: Rejeitado por desperdício de recursos
- Versionamento por data apenas: Rejeitado por não detectar mudanças de conteúdo

### 4. Estratégia de Remoção Eficiente

**Decisão**: Marcar documentos durante ingestão e remover não marcados

```typescript
// 1. Marcar todos como pendentes de remoção
// 2. Durante ingestão, atualizar/criar e desmarcar
// 3. Remover documentos ainda marcados
```

**Fundamentação**:

- Mais eficiente que drop/recreate completo
- Preserva índices e metadados de performance
- Permite rollback em caso de falha
- Reduz tempo de indisponibilidade

**Alternativas Consideradas**:

- Drop/recreate coleção: Rejeitado por perda de índices e metadados
- Comparação full diff: Rejeitado por alto custo computacional

### 5. Workflows GitHub Actions

**Decisão**: Workflows separados para ingestão e transformação

- **Ingestão**: Cron diário/semanal + dispatch manual
- **Transformação**: Dispatch + trigger em mudanças de pipeline

**Fundamentação**:

- Separação de responsabilidades clara
- Permite debugging independente
- Flexibilidade de cronograma por tipo de dados
- Reduz acoplamento entre processos

**Alternativas Consideradas**:

- Workflow único: Rejeitado por complexidade e acoplamento
- Triggers automáticos para transformação: Rejeitado por risco de cascata de execuções

### 6. Controle de Concorrência

**Decisão**: Enfileiramento sequencial por tipo de dados com locks MongoDB

```typescript
// Lock por coleção usando MongoDB operations atômicas
const lock = await db
  .collection('locks')
  .findOneAndUpdate(
    { resource: 'fauna_ingestion' },
    { $set: { locked: true, timestamp: new Date() } },
    { upsert: true, returnDocument: 'after' }
  )
```

**Fundamentação**:

- Evita conflitos de dados durante processamento simultâneo
- Permite processamento paralelo de tipos diferentes (fauna/flora/ocorrências)
- Facilita debugging e monitoramento
- Compatível com arquitetura distribuída

**Alternativas Consideradas**:

- Sem controle de concorrência: Rejeitado por risco de corrupção de dados
- Locks em arquivo: Rejeitado por não funcionar em ambiente distribuído

## Integrações Necessárias

### MongoDB Collections Schema

```typescript
// Coleção Original
interface OriginalDocument {
  _id: ObjectId
  ipt_source_id: string // ID único do IPT de origem
  ipt_version: string // Versão/hash do IPT
  original_data: any // Dados exatos do DwC-A
  ingestion_metadata: {
    timestamp: Date
    source_ipt: string
    processing_version: string
  }
}

// Coleção Transformada
interface TransformedDocument {
  _id: ObjectId // Mesmo ID do documento original
  transformed_data: any // Dados processados
  transformation_metadata: {
    timestamp: Date
    pipeline_version: string
    original_reference: ObjectId
  }
}
```

### Bun Scripts Structure

```
packages/ingest/src/
├── scripts/
│   ├── ingest-fauna.ts       # Script principal de ingestão
│   ├── ingest-flora.ts
│   ├── ingest-ocorrencias.ts
│   ├── transform-fauna.ts    # Scripts de transformação offline
│   ├── transform-flora.ts
│   └── transform-ocorrencias.ts
├── lib/
│   ├── ipt-client.ts         # Cliente para IPT
│   ├── version-checker.ts    # Validação de versões
│   ├── pipeline-runner.ts    # Engine de transformação
│   └── mongo-utils.ts        # Utilitários MongoDB
└── transformers/
    ├── fauna/               # Transformações específicas
    ├── flora/
    └── ocorrencias/
```

### GitHub Workflows Structure

```
.github/workflows/
├── ingest-fauna.yml         # Cron + dispatch para fauna
├── ingest-flora.yml         # Cron + dispatch para flora
├── ingest-ocorrencias.yml   # Cron + dispatch para ocorrencias
├── transform-fauna.yml      # Dispatch para transformação
├── transform-flora.yml      # Dispatch para transformação
└── transform-ocorrencias.yml # Dispatch para transformação
```

## Padrões de Performance

### Otimizações MongoDB

- Índices compostos por `ipt_source_id` + `_id`
- Bulk operations para inserções/atualizações
- Projeções mínimas durante transformações
- Connection pooling otimizado para Bun

### Otimizações de Processamento

- Streaming de dados DwC-A para reduzir uso de memória
- Processamento em lotes configuráveis (default: 1000 documentos)
- Paralelização por worker threads quando aplicável
- Cache de metadados de IPT para evitar chamadas desnecessárias

## Validações e Testes

### Cenários de Teste Manual

1. **Ingestão Nova**: IPT nunca processado → criar documentos originais e transformados
2. **Re-ingestão Sem Mudanças**: IPT não modificado → pular processamento
3. **Re-ingestão Com Mudanças**: IPT modificado → atualizar documentos existentes, remover ausentes
4. **Transformação Offline**: Dados originais existentes → gerar/atualizar documentos transformados
5. **Falha Parcial**: Transformação falha → fallback para dados originais na coleção transformada

### Validações de Integridade

- Contagem de documentos: original deve ser >= transformada
- IDs correspondentes: cada documento transformado deve ter original com mesmo ID
- Metadados de rastreabilidade: timestamps e versões preservados
- Validação Darwin Core: estrutura DwC-A mantida nos dados originais

## Próximos Passos

Esta pesquisa estabelece a base técnica para:

1. **Phase 1**: Design detalhado de data models e contratos de scripts
2. **Implementação**: Criação dos scripts Bun e workflows GitHub Actions
3. **Testes**: Validação com IPTs reais em ambiente de desenvolvimento
