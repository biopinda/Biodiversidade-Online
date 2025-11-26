# MongoDB Indexes Configuration for Original Collections

**Data**: 2025-09-29  
**Coleções**: taxaOriginal, ocorrenciasOriginal

## Índices para taxaOriginal

```javascript
// Índice principal por IPT e record ID (único)
db.taxaOriginal.createIndex(
  { iptId: 1, ipt_record_id: 1 },
  { unique: true, name: 'ipt_record_unique' }
)

// Índice por versão do IPT (para verificação de mudanças)
db.taxaOriginal.createIndex(
  { iptId: 1, ipt_version: 1 },
  { name: 'ipt_version_lookup' }
)

// Índice por status de processamento
db.taxaOriginal.createIndex(
  { 'processing_status.is_processed': 1 },
  { name: 'processing_status_lookup' }
)

// Índice temporal por ingestão
db.taxaOriginal.createIndex(
  { 'ingestion_metadata.timestamp': -1 },
  { name: 'ingestion_timestamp' }
)

// Índice por tipo de coleção
db.taxaOriginal.createIndex(
  { collection_type: 1 },
  { name: 'collection_type_lookup' }
)

// Índice composto para consultas de transformação
db.taxaOriginal.createIndex(
  {
    collection_type: 1,
    'processing_status.is_processed': 1,
    'ingestion_metadata.timestamp': -1
  },
  { name: 'transformation_queue' }
)
```

## Índices para ocorrenciasOriginal

```javascript
// Índice principal por IPT e record ID (único)
db.ocorrenciasOriginal.createIndex(
  { iptId: 1, ipt_record_id: 1 },
  { unique: true, name: 'ipt_record_unique' }
)

// Índice por versão do IPT (para verificação de mudanças)
db.ocorrenciasOriginal.createIndex(
  { iptId: 1, ipt_version: 1 },
  { name: 'ipt_version_lookup' }
)

// Índice por status de processamento
db.ocorrenciasOriginal.createIndex(
  { 'processing_status.is_processed': 1 },
  { name: 'processing_status_lookup' }
)

// Índice temporal por ingestão
db.ocorrenciasOriginal.createIndex(
  { 'ingestion_metadata.timestamp': -1 },
  { name: 'ingestion_timestamp' }
)

// Índice por tipo de coleção (sempre 'ocorrencias')
db.ocorrenciasOriginal.createIndex(
  { collection_type: 1 },
  { name: 'collection_type_lookup' }
)

// Índice composto para consultas de transformação
db.ocorrenciasOriginal.createIndex(
  {
    iptId: 1,
    'processing_status.is_processed': 1,
    'ingestion_metadata.timestamp': -1
  },
  { name: 'transformation_queue' }
)

// Índice por IPT para processamento paralelo
db.ocorrenciasOriginal.createIndex(
  { iptId: 1, 'ingestion_metadata.timestamp': -1 },
  { name: 'ipt_processing_order' }
)
```

## Índices para Coleções Existentes (Extensões)

### taxa (extensões para rastreabilidade)

```javascript
// Índice para referência ao documento original
db.taxa.createIndex(
  { 'original_reference.original_id': 1 },
  { name: 'original_reference_lookup', sparse: true }
)

// Índice por timestamp de transformação
db.taxa.createIndex(
  { 'transformation_metadata.timestamp': -1 },
  { name: 'transformation_timestamp', sparse: true }
)

// Índice composto para rastreabilidade bidirecional
db.taxa.createIndex(
  {
    'original_reference.iptId': 1,
    'original_reference.ipt_record_id': 1
  },
  { name: 'bidirectional_traceability', sparse: true }
)
```

### ocorrencias (extensões para rastreabilidade)

```javascript
// Índice para referência ao documento original
db.ocorrencias.createIndex(
  { 'original_reference.original_id': 1 },
  { name: 'original_reference_lookup', sparse: true }
)

// Índice por timestamp de transformação
db.ocorrencias.createIndex(
  { 'transformation_metadata.timestamp': -1 },
  { name: 'transformation_timestamp', sparse: true }
)

// Índice composto para rastreabilidade bidirecional
db.ocorrencias.createIndex(
  {
    'original_reference.iptId': 1,
    'original_reference.ipt_record_id': 1
  },
  { name: 'bidirectional_traceability', sparse: true }
)
```

## Índices para ProcessingLocks

```javascript
// Índice único por tipo de recurso quando ativo
db.processingLocks.createIndex(
  { resource_type: 1, is_locked: 1 },
  {
    unique: true,
    partialFilterExpression: { is_locked: true },
    name: 'active_lock_unique'
  }
)

// Índice para limpeza de locks expirados
db.processingLocks.createIndex(
  { lock_expires_at: 1 },
  { name: 'lock_expiration_cleanup' }
)

// Índice por processo que criou o lock
db.processingLocks.createIndex(
  { locked_by: 1 },
  { name: 'lock_ownership_lookup' }
)
```

## Script de Aplicação dos Índices

```javascript
// Script para executar todos os índices
use dwc2json;

print("Criando índices para taxaOriginal...");
db.taxaOriginal.createIndex({ iptId: 1, ipt_record_id: 1 }, { unique: true, name: "ipt_record_unique" });
db.taxaOriginal.createIndex({ iptId: 1, ipt_version: 1 }, { name: "ipt_version_lookup" });
db.taxaOriginal.createIndex({ "processing_status.is_processed": 1 }, { name: "processing_status_lookup" });
db.taxaOriginal.createIndex({ "ingestion_metadata.timestamp": -1 }, { name: "ingestion_timestamp" });
db.taxaOriginal.createIndex({ collection_type: 1 }, { name: "collection_type_lookup" });
db.taxaOriginal.createIndex({ collection_type: 1, "processing_status.is_processed": 1, "ingestion_metadata.timestamp": -1 }, { name: "transformation_queue" });

print("Criando índices para ocorrenciasOriginal...");
db.ocorrenciasOriginal.createIndex({ iptId: 1, ipt_record_id: 1 }, { unique: true, name: "ipt_record_unique" });
db.ocorrenciasOriginal.createIndex({ iptId: 1, ipt_version: 1 }, { name: "ipt_version_lookup" });
db.ocorrenciasOriginal.createIndex({ "processing_status.is_processed": 1 }, { name: "processing_status_lookup" });
db.ocorrenciasOriginal.createIndex({ "ingestion_metadata.timestamp": -1 }, { name: "ingestion_timestamp" });
db.ocorrenciasOriginal.createIndex({ collection_type: 1 }, { name: "collection_type_lookup" });
db.ocorrenciasOriginal.createIndex({ iptId: 1, "processing_status.is_processed": 1, "ingestion_metadata.timestamp": -1 }, { name: "transformation_queue" });
db.ocorrenciasOriginal.createIndex({ iptId: 1, "ingestion_metadata.timestamp": -1 }, { name: "ipt_processing_order" });

print("Estendendo índices das coleções existentes...");
db.taxa.createIndex({ "original_reference.original_id": 1 }, { name: "original_reference_lookup", sparse: true });
db.taxa.createIndex({ "transformation_metadata.timestamp": -1 }, { name: "transformation_timestamp", sparse: true });
db.taxa.createIndex({ "original_reference.iptId": 1, "original_reference.ipt_record_id": 1 }, { name: "bidirectional_traceability", sparse: true });

db.ocorrencias.createIndex({ "original_reference.original_id": 1 }, { name: "original_reference_lookup", sparse: true });
db.ocorrencias.createIndex({ "transformation_metadata.timestamp": -1 }, { name: "transformation_timestamp", sparse: true });
db.ocorrencias.createIndex({ "original_reference.iptId": 1, "original_reference.ipt_record_id": 1 }, { name: "bidirectional_traceability", sparse: true });

print("Criando coleção e índices para ProcessingLocks...");
db.processingLocks.createIndex({ resource_type: 1, is_locked: 1 }, { unique: true, partialFilterExpression: { is_locked: true }, name: "active_lock_unique" });
db.processingLocks.createIndex({ lock_expires_at: 1 }, { name: "lock_expiration_cleanup" });
db.processingLocks.createIndex({ locked_by: 1 }, { name: "lock_ownership_lookup" });

print("Todos os índices criados com sucesso!");
```

## Performance Considerations

### Características dos Índices

- **Sparse indexes**: Para campos opcionais de rastreabilidade
- **Unique constraints**: Evitam duplicação de dados originais
- **Compound indexes**: Otimizam queries complexas de transformação
- **Temporal indexes**: Suportam consultas por data de ingestão/transformação

### Estimativa de Impacto

- **Espaço adicional**: ~20-30% do tamanho das coleções originais
- **Performance de inserção**: Redução estimada de 10-15% devido aos índices únicos
- **Performance de consulta**: Melhoria significativa para rastreabilidade

### Monitoramento

```javascript
// Consultas para monitorar performance dos índices
db.taxaOriginal.getIndexes()
db.taxaOriginal.stats().indexSizes

// Consulta explain para verificar uso de índices
db.taxaOriginal
  .find({ iptId: 'example', 'processing_status.is_processed': false })
  .explain('executionStats')
```
