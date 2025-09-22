# Data Model: Mapa de Ocorrências por Estado

**Date**: 2025-09-22
**Phase**: 1 - Design & Contracts

## Entidades Principais

### 1. OccurrenceRecord (Registro de Ocorrência)

**Fonte**: Coleção MongoDB `dwc2json.ocorrencias`

**Estrutura:**

```typescript
interface OccurrenceRecord {
  _id: ObjectId // Identificador único MongoDB
  stateProvince: string // Estado/província onde ocorreu a observação
  kingdom?: string // Reino taxonômico
  phylum?: string // Filo taxonômico
  class?: string // Classe taxonômica
  order?: string // Ordem taxonômica
  superfamily?: string // Superfamília taxonômica
  family?: string // Família taxonômica
  genus?: string // Gênero taxonômico
  specificEpithet?: string // Epíteto específico
  scientificName?: string // Nome científico completo
  // Outros campos Darwin Core...
}
```

**Regras de Validação:**

- `stateProvince` deve ser normalizado usando `stateMapping`
- Campos taxonômicos podem ser filtrados com regex case-insensitive
- Registros sem `stateProvince` válido são ignorados na agregação

**Estado de Transição:**

```
Raw Data → Normalization → Aggregation → Display
```

### 2. BrazilianState (Estado Brasileiro)

**Fonte**: Mapeamento estático `stateMapping` em mongo.ts

**Estrutura:**

```typescript
interface BrazilianState {
  abbreviation: string // Sigla oficial (ex: "SP", "RJ")
  fullName: string // Nome completo (ex: "São Paulo", "Rio de Janeiro")
  normalizedName: string // Nome normalizado para display
  region: string // Região (Norte, Nordeste, etc.)
  aliases: string[] // Variações encontradas nos dados
}
```

**Mapeamento de Normalização:**

```typescript
const stateMapping: Record<string, string> = {
  // Norte
  AC: 'Acre',
  Acre: 'Acre',
  AP: 'Amapá',
  Amapá: 'Amapá',
  Amapa: 'Amapá',
  AM: 'Amazonas',
  Amazonas: 'Amazonas'
  // ... (27 estados + DF)
}
```

**Regras de Validação:**

- Todas as variações mapeiam para nome oficial completo
- Estados desconhecidos mapeiam para "Unknown"
- Case-insensitive matching para entrada de dados

### 3. TaxonomicFilter (Filtro Taxonômico)

**Fonte**: Interface FilterField em types

**Estrutura:**

```typescript
interface TaxonomicFilter {
  kingdom?: string // Filtro por reino
  phylum?: string // Filtro por filo
  class?: string // Filtro por classe
  order?: string // Filtro por ordem
  superfamily?: string // Filtro por superfamília
  family?: string // Filtro por família
  genus?: string // Filtro por gênero
  specificEpithet?: string // Filtro por epíteto específico
}
```

**Mapeamento UI → DB:**

```typescript
const fieldToParam: Record<FilterField, string> = {
  reino: 'kingdom',
  filo: 'phylum',
  classe: 'class',
  ordem: 'order',
  superfamília: 'superfamily',
  família: 'family',
  gênero: 'genus',
  'epíteto específico': 'specificEpithet'
}
```

**Regras de Validação:**

- Valores não-vazios são aplicados como regex case-insensitive
- Genus e specificEpithet usam match exato (`^value$`)
- Outros campos usam match por palavra (`\\bvalue\\b`)

### 4. OccurrenceCount (Contagem de Ocorrências)

**Fonte**: Resultado da agregação MongoDB

**Estrutura:**

```typescript
interface OccurrenceCount {
  _id: string // Nome normalizado do estado
  count: number // Número de registros de ocorrência
}

interface OccurrenceResponse {
  total: number // Total geral de registros
  regions: OccurrenceCount[] // Contagens por estado
}
```

**Transformação para Google Charts:**

```typescript
// Formato esperado pelo componente Map
type ChartData = [string, any][]

// Transformação:
const chartData: ChartData = [
  ['Estado', 'Ocorrências'],
  ...regions.map(({ _id, count }) => [_id, count])
]
```

**Regras de Validação:**

- `count` sempre >= 0
- `_id` deve corresponder a estado brasileiro válido
- `total` deve ser soma de todas as contagens

## Relacionamentos

### OccurrenceRecord → BrazilianState

- **Tipo**: Many-to-One
- **Campo**: `stateProvince` → `normalizedName`
- **Integridade**: Via `normalizeStateName()` function

### TaxonomicFilter → OccurrenceRecord

- **Tipo**: Filter relationship
- **Aplicação**: MongoDB aggregation match stage
- **Integridade**: Regex validation

### OccurrenceCount → BrazilianState

- **Tipo**: One-to-One
- **Campo**: `_id` corresponds to state name
- **Integridade**: Aggregation ensures valid states only

## Agregação MongoDB Pipeline

### Estágio 1: Match (Filtros)

```typescript
const matchStage = {
  // Aplicar filtros taxonômicos como regex case-insensitive
  [filterKey]: new RegExp(pattern, 'i')
}
```

### Estágio 2: Facet (Contagem Total + Por Estado)

```typescript
{
  $facet: {
    total: [{ $count: 'count' }],
    byRegion: [
      {
        $addFields: {
          normalizedState: { /* normalização de stateProvince */ }
        }
      },
      {
        $group: {
          _id: '$normalizedState',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          _id: { $ne: null, $ne: '', $exists: true }
        }
      },
      { $sort: { count: -1 } }
    ]
  }
}
```

## Estados e Transições

### Fluxo de Dados Principal

```
1. User Input (Filtros)
   ↓
2. TaxonomicFilter (Validação)
   ↓
3. MongoDB Query (Aggregation)
   ↓
4. OccurrenceResponse (Raw Results)
   ↓
5. State Normalization
   ↓
6. ChartData (Google Charts Format)
   ↓
7. Visual Display (Map Component)
```

### Estados de Loading

```
Loading → Data Fetched → Processing → Display
    ↓
  Error → Retry/Fallback
```

### Estados de Filtro

```
Initial (No Filters) → Filtered (Has Filters) → Reset → Initial
```

## Considerações de Performance

### Indexação Recomendada

- Campos taxonômicos (kingdom, phylum, class, order, family, genus)
- Campo stateProvince para agregação
- Índice composto para filtros frequentes

### Otimizações

- Pipeline aggregation em single query
- Client-side caching de resultados
- Debounce em filtros para reduzir queries

### Limitações

- Máximo ~1M registros processados por query
- Timeout de 10 segundos para queries complexas
- Harmonização de estados em runtime (não pré-processada)
