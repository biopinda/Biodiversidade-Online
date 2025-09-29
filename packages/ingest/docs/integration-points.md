# Pontos de Integração para Preservação de Dados Originais

**Data**: 2025-09-29  
**Baseado na análise**: fauna.ts, flora.ts, ocorrencia.ts, dwca.ts

## Análise dos Scripts Existentes

### 1. fauna.ts - Estrutura Atual

**Fluxo Principal**:

1. `processaZip(url)` → Downloads e extrai DwC-A
2. `processaFauna(json)` → Aplica transformações específicas de fauna
3. Verificação de versão via coleção `ipts`
4. Limpeza por kingdom: `kingdom: 'Animalia'`
5. Inserção em lotes de 5000 documentos
6. Criação de índices

**Transformações Aplicadas**:

- `distribution`: Reestruturação de arrays para objeto com `origin`, `occurrence`, `countryCode`
- `resourcerelationship`: Conversão para `othernames` com lookup de nomes científicos
- `higherClassification`: Uso apenas do segundo componente (split por ';')
- `vernacularname`: Normalização de nomes vernaculares
- Adição de campos: `kingdom: 'Animalia'`, `canonicalName`, `flatScientificName`

**Ponto de Integração Ideal**:

- **Antes** de `processaFauna()` → preservar dados originais
- **Após** transformação → salvar dados transformados com referência

### 2. flora.ts - Estrutura Atual

**Fluxo Principal**: Idêntico ao fauna.ts

**Transformações Específicas**:

- `distribution`: Campos adicionais como `Endemism`, `phytogeographicDomains`, `vegetationType`
- `speciesprofile`: Processamento de perfil de espécies e remoção de `vegetationType`
- Kingdom não fixo (detectado a partir dos dados)
- Limpeza por: `$or: [{ kingdom: 'Plantae' }, { kingdom: 'Fungi' }]`

**Ponto de Integração**: Mesmo padrão do fauna.ts

### 3. ocorrencia.ts - Estrutura Mais Complexa

**Fluxo Principal**:

1. Carregamento de configuração via CSV (`referencias/occurrences.csv`)
2. Verificação de versão individual por IPT usando `getEml()` + timeout
3. Processamento concorrente com `runWithConcurrency()` (limite: 10 simultâneos)
4. Download via `processaZip()` com SQLite iterator para grandes volumes
5. Transformações inline durante inserção
6. Limpeza baseada em `iptId` individual

**Transformações Específicas**:

- `geoPoint`: Criação de coordenadas GeoJSON válidas
- `canonicalName`: Construção do nome canônico
- `iptKingdoms`: Array de kingdoms do CSV config
- Conversão de strings para números: `year`, `month`, `day`
- Normalização geográfica: `normalizeCountryName()`, `normalizeStateName()`
- Processamento de `eventDate`: Parsing para Date object

**Pontos de Integração Únicos**:

- Processamento por lotes via SQLite iterator
- Múltiplos IPTs por execução
- Controle de falhas de rede e IPTs offline

### 4. dwca.ts - Função `processaZip()`

**Função Central para Todos os Scripts**:

- Download com timeout configurável
- Extração de arquivo ZIP
- Parsing de meta.xml para estrutura DwC-A
- Duas estratégias: JSON (fauna/flora) vs SQLite (ocorrências)

**Retorno**:

```typescript
{
  json: DwcJson,    // Dados originais extraídos
  ipt: Ipt          // Metadados do IPT com id e version
}
```

**Ponto de Integração IDEAL**:

- Interceptar dados ANTES de qualquer transformação
- Usar o retorno `{ json, ipt }` como base para preservação

## Estratégia de Refatoração (Zero Downtime)

### Princípio: Preservação Transparente

```typescript
// ANTES (atual)
const { json, ipt } = await processaZip(url)
const transformedData = processaSpecific(json) // processaFauna/Flora
// ... salvar transformedData

// DEPOIS (com preservação)
const { json, ipt } = await processaZip(url)

// NOVO: Preservar dados originais PRIMEIRO
await preserveOriginalData(json, ipt, collectionType)

// MANTIDO: Aplicar transformações existentes (INALTERADAS)
const transformedData = processaSpecific(json)

// EXPANDIDO: Salvar transformados com referência original
await saveTransformedWithReference(transformedData, ipt)
```

### Modificações Mínimas Necessárias

#### 1. fauna.ts e flora.ts

```typescript
// Adicionar APENAS estas 2 linhas
await preserveOriginalData(json, ipt, 'fauna') // ou 'flora'
// ... resto do código INALTERADO
await saveTransformedWithReference(transformedData, ipt) // em vez de insertMany direto
```

#### 2. ocorrencia.ts

```typescript
// Modificação mais complexa devido ao SQLite iterator
for (const batch of ocorrencias) {
  // NOVO: Preservar lote original
  await preserveOriginalBatch(batch, ipt, 'ocorrencias')

  // MANTIDO: Transformação inline (INALTERADA)
  const transformedBatch = batch.map(processOccurrence)

  // EXPANDIDO: Salvar com referência
  await saveOccurrenceBatchWithReference(transformedBatch, ipt)
}
```

### Funções de Preservação a Implementar

#### 1. preserveOriginalData()

```typescript
async function preserveOriginalData(
  json: DwcJson,
  ipt: Ipt,
  collectionType: 'fauna' | 'flora'
) {
  const originalDocuments = Object.entries(json).map(([id, data]) => ({
    _id: new ObjectId(), // Gerar novo ID
    iptId: ipt.id,
    ipt: ipt.tag || collectionType,
    ipt_record_id: id,
    ipt_version: ipt.version,
    collection_type: collectionType,
    original_data: data,
    ingestion_metadata: {
      timestamp: new Date(),
      source_ipt_url: ipt.id,
      processing_version: '1.0.0',
      dwca_version: ipt.version
    },
    processing_status: {
      is_processed: false,
      last_transform_attempt: null
    }
  }))

  // Inserir em coleção específica (taxaOriginal)
  await db.collection('taxaOriginal').insertMany(originalDocuments)
}
```

#### 2. saveTransformedWithReference()

```typescript
async function saveTransformedWithReference(transformedData: any[], ipt: Ipt) {
  // Buscar IDs dos documentos originais
  const originalIds = await db
    .collection('taxaOriginal')
    .find({ iptId: ipt.id, ipt_version: ipt.version })
    .toArray()

  const enrichedData = transformedData.map((doc, index) => ({
    ...doc,
    original_reference: {
      original_id: originalIds[index]._id,
      iptId: ipt.id,
      ipt_record_id: originalIds[index].ipt_record_id
    },
    transformation_metadata: {
      timestamp: new Date(),
      pipeline_version: '1.0.0',
      transform_functions: ['processaFauna'], // ou processaFlora
      fallback_applied: false
    }
  }))

  // Inserir dados transformados com referência
  await db.collection('taxa').insertMany(enrichedData)
}
```

## Compatibilidade com Workflows GitHub Actions

### Manter Interface Externa

**Argumentos**: Sem mudança

- fauna.ts: `bun run fauna -- <dwc-a url>`
- flora.ts: `bun run flora -- <dwc-a url>`
- ocorrencia.ts: `bun run ocorrencia` (sem args)

**Códigos de Saída**: Sem mudança

- 0: Sucesso
- 1: Erro geral

**Logs**: Expandidos (não quebrados)

- Manter logs existentes
- Adicionar logs de preservação original

### Performance Target

**Meta**: < 125% do tempo original

- Preservação original é operação adicional simples (insert)
- Transformação mantém lógica existente
- Overhead principal: queries adicionais para referências

## Próximos Passos da Implementação

1. **T021-T023**: Implementar funções de preservação
2. **T024-T026**: Criar scripts de transformação offline
3. **T027-T029**: Implementar pipelines de transformação
4. **T033-T037**: Criar workflows GitHub Actions para transformação

Esta análise estabelece a base técnica para refatoração gradual e compatível.
