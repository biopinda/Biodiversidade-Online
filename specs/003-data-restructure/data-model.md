# Data Model: Reestruturação de Dados

**Date**: 2025-10-29  
**Feature**: 003-data-restructure  
**Status**: Complete

## Overview

Este documento define o modelo de dados para a arquitetura de separação entre ingestão raw e transformação. O modelo introduz 4 collections principais (2 raw + 2 transformed) e 2 collections auxiliares (concurrency control + metrics).

---

## Core Entities

### 1. TaxaRaw (Collection: `taxa_ipt`)

Armazena dados taxonômicos brutos diretamente dos arquivos DwC-A sem modificações.

**Purpose**: Preservar dados originais para auditoria, reprodutibilidade e rastreabilidade.

**Schema**: Conforme `docs/schema-dwc2json-taxa-mongoDBJSON.json` (existente)

**Key Fields**:

```typescript
interface TaxaRaw {
  _id: string // MUST be taxonID do DwC-A (chave natural)
  taxonID: string
  scientificName: string
  kingdom: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  specificEpithet?: string
  infraspecificEpithet?: string
  taxonRank: string // e.g., "ESPECIE", "GENERO", "VARIEDADE"
  taxonomicStatus?: string
  higherClassification?: string
  vernacularname?: Array<{
    vernacularName: string
    language: string
  }>
  distribution?: Array<{
    locationID?: string
    locality?: string
    establishmentMeans?: string
    occurrenceRemarks?: string
  }>
  speciesprofile?: Array<any>
  resourcerelationship?: Array<any>
  // ... todos os demais campos DwC preservados
}
```

**Relationships**:

- 1:1 com `Taxa` (transformed) via `_id`
- N:M com `OccurrenceRaw` via `scientificName` (nome como string, não foreign key)

**Validation Rules**:

- `_id` MUST be unique (MongoDB enforces)
- `_id` MUST equal `taxonID` (generated during ingestion)
- `scientificName` MUST be non-empty string
- `kingdom` MUST be non-empty string

**State Transitions**: N/A (immutable after ingestion, apenas upsert em re-ingestão)

**Indexes**:

- Primary: `_id` (automatic)
- Secondary: `taxonID` (para compatibility), `scientificName`, `kingdom`

---

### 2. Taxa (Collection: `taxa`)

Armazena dados taxonômicos transformados e enriquecidos.

**Purpose**: Servir dados de alta qualidade para APIs e interface web.

**Schema**: Evolução do schema atual com campos adicionais de rastreabilidade

**Key Fields**:

```typescript
interface Taxa {
  _id: string // MUST be IDENTICAL to TaxaRaw._id (rastreabilidade)

  // Campos DwC preservados (subset filtrado)
  taxonID: string
  scientificName: string
  kingdom: 'Animalia' | 'Plantae' | 'Fungi'
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  specificEpithet?: string
  infraspecificEpithet?: string
  taxonRank: 'ESPECIE' | 'VARIEDADE' | 'FORMA' | 'SUB_ESPECIE' // Filtrado
  taxonomicStatus?: string

  // Campos transformados
  canonicalName: string // Gerado de genus + specificEpithet + infraspecificEpithet
  flatScientificName: string // scientificName sem caracteres especiais, lowercase
  higherClassification: string // Processado (segundo componente após split ';')

  vernacularname: Array<{
    vernacularName: string // Normalizado: lowercase com hífens
    language: string // Capitalizado: "Português"
  }>

  // Distribution processado diferente para Flora/Fauna
  distribution: FloraDistribution | FaunaDistribution

  // Relationships processados
  othernames?: Array<{
    taxonID: string
    scientificName: string
    taxonomicStatus: string
  }>

  // Species profile processado (apenas Flora/Fungi)
  speciesprofile?: {
    lifeForm?: any // vegetationType removido
    // ... outros campos preservados
  }

  // Dados agregados de outras fontes
  threatStatus?: {
    source: 'cncfloraFungi' | 'cncfloraPlantae' | 'faunaAmeacada'
    category?: string
    // ... campos específicos de ameaça
  }

  invasiveStatus?: {
    isInvasive: boolean
    source: 'invasoras'
    // ... campos específicos
  }

  conservationUnits?: Array<{
    ucName: string
    // ... campos de UC
  }>

  // Metadata de transformação
  _transformedAt?: Date // Timestamp da última transformação
  _transformVersion?: string // Versão do script de transformação
}

interface FloraDistribution {
  origin?: string // establishmentMeans do primeiro elemento
  Endemism?: string // De occurrenceRemarks.endemism
  phytogeographicDomains?: any
  occurrence: string[] // Array de locationID ordenado
  vegetationType?: any // De speciesprofile[0].lifeForm.vegetationType
}

interface FaunaDistribution {
  origin?: string
  occurrence: string[] // locality split por ';'
  countryCode: string[] // Split por ';'
}
```

**Relationships**:

- 1:1 com `TaxaRaw` via `_id` (rastreabilidade)
- 1:N com `Occurrence` via `taxonID` (validado durante transformação)
- N:M com `cncfloraFungi`, `cncfloraPlantae`, `faunaAmeacada`, `invasoras`, `catalogoucs` (agregação)

**Validation Rules**:

- `_id` MUST be identical to corresponding `TaxaRaw._id`
- `taxonRank` MUST be in allowed values (filtro durante transformação)
- `canonicalName` MUST be non-empty (gerado de campos disponíveis)
- `flatScientificName` MUST be non-empty lowercase alphanumeric
- `kingdom` MUST be 'Animalia' | 'Plantae' | 'Fungi'

**State Transitions**:

```
[TaxaRaw ingested] → [Transformation triggered] → [Taxa created/updated]
                   ↓
        [Aggregations applied (threat, invasive, UC)]
                   ↓
        [Validation passed] → [Record persisted]
```

**Indexes**:

- Primary: `_id`
- Secondary: `scientificName`, `kingdom`, `family`, `genus`, `(taxonID, kingdom)`, `canonicalName`, `flatScientificName`

---

### 3. OccurrenceRaw (Collection: `occurrences_ipt`)

Armazena dados de ocorrências brutos diretamente dos arquivos DwC-A sem modificações.

**Purpose**: Preservar dados originais de observações/coletas para auditoria.

**Schema**: Conforme `docs/schema-dwc2json-ocorrencias-mongoDBJSON.json` (existente)

**Key Fields**:

```typescript
interface OccurrenceRaw {
  _id: string // MUST be `${occurrenceID}:${iptId}` (unicidade entre IPTs)
  occurrenceID: string
  scientificName: string
  kingdom?: string // Pode conter múltiplos valores separados por vírgula no CSV
  family?: string
  genus?: string
  specificEpithet?: string

  // Campos geográficos (strings como recebidos)
  decimalLatitude?: string
  decimalLongitude?: string
  continent?: string
  country?: string
  stateProvince?: string
  county?: string
  locality?: string

  // Campos temporais (strings como recebidos)
  eventDate?: string
  year?: string
  month?: string
  day?: string

  // Coleta
  recordedBy?: string
  recordNumber?: string
  catalogNumber?: string

  // Metadata de origem
  basisOfRecord?: string
  occurrenceRemarks?: string

  // ... todos os demais campos DwC preservados
}
```

**Relationships**:

- 1:1 com `Occurrence` (transformed) via `_id`
- N:M com `TaxaRaw` via `scientificName` (string match, não foreign key)

**Validation Rules**:

- `_id` MUST be unique (formato: `occurrenceID:iptId`)
- `occurrenceID` MUST be non-empty (ou gerado via fallback)
- Campos preservados como recebidos (sem validação de tipos)

**State Transitions**: N/A (immutable after ingestion)

**Indexes**:

- Primary: `_id`
- Secondary: `occurrenceID`, `scientificName`, `iptId`

---

### 4. Occurrence (Collection: `occurrences`)

Armazena dados de ocorrências transformados, validados e enriquecidos.

**Purpose**: Servir dados de ocorrências de alta qualidade para mapas e análises.

**Schema**: Evolução do schema atual com validações e harmonizações

**Key Fields**:

```typescript
interface Occurrence {
  _id: string // MUST be IDENTICAL to OccurrenceRaw._id

  // Campos DwC preservados
  occurrenceID: string
  scientificName: string // Pode ser substituído por nome aceito se for sinônimo
  family?: string
  genus?: string
  specificEpithet?: string

  // Campos transformados/validados
  canonicalName: string // Gerado de genus + specificEpithet + infraspecificEpithet
  flatScientificName: string // Sem caracteres especiais, lowercase
  iptKingdoms: string[] // Array resultado do split de kingdom por vírgula

  // Vinculação taxonômica
  taxonID?: string // Validado e vinculado de collection Taxa

  // Campos geográficos harmonizados
  geoPoint?: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  } // Criado apenas se coordenadas válidas
  continent: string // Harmonizado para "América do Sul"
  country: string // Normalizado: "Brasil"
  stateProvince?: string // Normalizado: "São Paulo", "Rio de Janeiro"
  county?: string // Harmonizado com lista IBGE
  locality?: string

  // Campos temporais parseados
  eventDate?: Date // Parseado de string ou composto de year/month/day
  year?: number // Convertido para number se válido (>0)
  month?: number // Convertido para number se válido (1-12)
  day?: number // Convertido para number se válido (1-31)

  // Coleta
  recordedBy?: string // Original preservado
  collectors?: ParsedCollector[] // Parseado via algoritmo externo (se disponível)
  recordNumber?: string
  catalogNumber?: string

  // Metadata de origem
  iptId: string // Identificador do IPT source
  ipt: string // Nome do repositório
  basisOfRecord?: string

  // Campos específicos de domínio
  reproductiveCondition?: 'flor' | 'fruto' // Para Plantae, parseado de occurrenceRemarks

  // Metadata de transformação
  _transformedAt?: Date
  _transformVersion?: string
  parsingStatus?: 'success' | 'failed' // Status de parsing de collectors
}

interface ParsedCollector {
  name: string
  // ... campos retornados pelo algoritmo de parsing
}
```

**Relationships**:

- 1:1 com `OccurrenceRaw` via `_id` (rastreabilidade)
- N:1 com `Taxa` via `taxonID` (vinculação após validação)

**Validation Rules**:

- `_id` MUST be identical to corresponding `OccurrenceRaw._id`
- `geoPoint.coordinates[0]` (longitude) MUST be -180 to 180 if present
- `geoPoint.coordinates[1]` (latitude) MUST be -90 to 90 if present
- `year` MUST be >0 if number
- `month` MUST be 1-12 if number
- `day` MUST be 1-31 if number
- `country` MUST be "Brasil" (filtro - registros de outros países são excluídos)

**State Transitions**:

```
[OccurrenceRaw ingested] → [Transformation triggered]
                         ↓
        [Coordinate validation] → [geoPoint created if valid]
                         ↓
        [Date parsing] → [year/month/day/eventDate normalized]
                         ↓
        [Geographic harmonization] → [country/state/county normalized]
                         ↓
        [Taxonomic validation] → [scientificName validated against Taxa]
                         ↓
        [Collector parsing] → [collectors field populated if successful]
                         ↓
        [Country filter] → [Only Brasil records persisted]
                         ↓
        [Record persisted]
```

**Indexes** (preservados de implementação atual):

- Primary: `_id`
- Secondary: `scientificName`, `iptId`, `ipt`, `canonicalName`, `flatScientificName`, `iptKingdoms`, `year`, `month`, `eventDate`, `country`, `stateProvince`, `genus`, `specificEpithet`, `kingdom`, `family`, `recordedBy`, `recordNumber`, `locality`
- Composite: `(country, stateProvince)`, `(genus, specificEpithet)`, `(kingdom, country)`, `(kingdom, stateProvince)`, `(kingdom, family)`, `(stateProvince, kingdom, phylum, class, order, family, genus, specificEpithet)`
- Geospatial: `geoPoint` (2dsphere index)

---

## Auxiliary Entities

### 5. TransformStatus (Collection: `transform_status`)

Controla concorrência de processos de transformação.

**Purpose**: Prevenir race conditions e permitir detecção de locks obsoletos.

**Schema**:

```typescript
interface TransformStatus {
  _id: string // Igual a process_type para simplificar queries
  process_type: 'taxa' | 'occurrences'
  status: 'running' | 'completed' | 'failed'
  started_at: Date
  updated_at: Date
  process_id: string // UUID gerado por cada execução
  runner_id?: string // GitHub runner ID se aplicável
  error_message?: string // Se status === 'failed'
}
```

**Relationships**: N/A (standalone)

**Validation Rules**:

- `process_type` MUST be unique (enforced via `_id`)
- `status` MUST be in allowed enum values
- Lock é considerado obsoleto se `updated_at < Date.now() - 2 hours`

**State Transitions**:

```
[Transform start] → findOneAndUpdate({process_type, status: {$ne: 'running'}}, {status: 'running'})
                  ↓
     [Heartbeat optional] → updateOne({process_id}, {updated_at: Date.now()})
                  ↓
     [Transform complete] → updateOne({process_id}, {status: 'completed'})
                  ↓
     [On error] → updateOne({process_id}, {status: 'failed', error_message})
```

**Indexes**:

- Primary: `_id` (process_type)
- Secondary: `process_id`, `status`, `updated_at`

---

### 6. ProcessMetrics (Collection: `process_metrics`)

Armazena métricas operacionais de processos de ingestão e transformação.

**Purpose**: Observabilidade, debugging, capacity planning.

**Schema**:

```typescript
interface ProcessMetrics {
  _id: ObjectId // MongoDB auto-generated (metrics não precisam de ID determinístico)
  process_type:
    | 'ingest_taxa'
    | 'ingest_occurrences'
    | 'transform_taxa'
    | 'transform_occurrences'
  resource_identifier?: string // IPT URL para ingest, 'all' para transform
  started_at: Date
  completed_at: Date
  duration_seconds: number // Calculado: completed_at - started_at
  records_processed: number
  records_inserted: number
  records_updated: number
  records_failed: number
  error_summary: { [errorType: string]: number } // e.g., {network: 5, validation: 12}
  runner_id?: string // GitHub runner para correlação
  version?: string // Versão do script que executou (para tracking de mudanças)
}
```

**Relationships**: N/A (standalone, time-series data)

**Validation Rules**:

- `started_at` MUST be <= `completed_at`
- `duration_seconds` MUST be >= 0
- `records_processed` MUST be >= 0
- `records_inserted + records_updated + records_failed` SHOULD be <= `records_processed`

**State Transitions**:

```
[Process start] → Record start time
               ↓
     [Process execution] → Accumulate counters
               ↓
     [Process end] → insertOne(metrics document)
```

**Indexes**:

- Primary: `_id`
- Secondary: `process_type`, `started_at` (for time-range queries), `resource_identifier`

**Retention Policy**: Manter últimos 90 dias, arquivar ou deletar mais antigos

---

## Data Flows

### Ingestion Flow

```
[IPT DwC-A Download] → [processaZip batches]
                     ↓
          [Generate deterministic _id]
                     ↓
          [safeInsertMany to taxa_ipt/occurrences_ipt]
                     ↓
          [Record ProcessMetrics]
                     ↓
          [Trigger Transform Workflow (if auto)]
```

### Transformation Flow

```
[Acquire lock in TransformStatus] → [Read from taxa_ipt/occurrences_ipt]
                                  ↓
                    [Apply transformations (canonicalName, normalization, etc)]
                                  ↓
                    [Validate (coordinates, dates, taxonID lookup)]
                                  ↓
                    [Apply aggregations (threat, invasive, UC)]
                                  ↓
                    [Copy _id from raw to transformed]
                                  ↓
                    [upsert to taxa/occurrences]
                                  ↓
                    [Validate integrity (_id match between raw/transformed)]
                                  ↓
                    [Record ProcessMetrics]
                                  ↓
                    [Release lock in TransformStatus]
```

### API Query Flow

```
[API Request] → [Parse filters] → [Query taxa/occurrences (transformed collections)]
                                ↓
                    [Apply pagination]
                                ↓
                    [Return JSON response]
```

### Traceability Flow

```
[Given transformed record with _id X]
         ↓
[Query db.taxa_ipt.findOne({_id: X})] → [Returns raw source]
         ↓
[Audit diff between raw and transformed]
```

---

## Migration Considerations

**From Current Schema to New Schema**:

- Current `taxa` collection → Will become `taxa` (transformed)
- Current `occurrences` collection → Will become `occurrences` (transformed)
- **New collections**: `taxa_ipt`, `occurrences_ipt` (populated via re-ingestion)
- **Migration script**: Not in scope - fresh ingestion from IPT sources

**Backward Compatibility**:

- APIs should maintain same response format (fields preserved in transformed collections)
- Web pages should work without changes (collections maintain compatible schemas)

**Data Validation**:

- Post-migration: Verify `COUNT(taxa) <= COUNT(taxa_ipt)` (due to taxonRank filtering)
- Post-migration: Verify `100% of taxa._id exist in taxa_ipt._id`
- Post-migration: Verify `100% of occurrences._id exist in occurrences_ipt._id`

---

## Success Metrics

- **Rastreabilidade**: 100% dos registros transformados podem ser rastreados ao raw via `_id`
- **Integridade**: 0 registros órfãos (transformed sem raw source)
- **Completude**: >= 95% dos campos obrigatórios preenchidos em collections transformadas
- **Qualidade geográfica**: >= 90% das ocorrências com coordenadas válidas possuem `geoPoint`
- **Qualidade temporal**: >= 95% dos registros com `eventDate` válido possuem `year`/`month`/`day` parseados
- **Vinculação taxonômica**: >= 90% das ocorrências com `scientificName` válido possuem `taxonID` vinculado

---

**Version**: 1.0  
**Ready for**: Contract generation (Phase 1 continuation)
