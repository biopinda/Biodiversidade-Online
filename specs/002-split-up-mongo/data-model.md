# Data Model: Split up mongo.ts

## Overview

The mongo.ts refactoring involves restructuring database operations around MongoDB collections and their associated functions. The current monolithic file contains operations across multiple domains that need to be logically separated.

## Core Entities

### MongoDB Collections

| Collection        | Purpose                                   | Key Fields                                                                                     |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `taxa`            | Taxonomic data from Flora/Fauna do Brasil | `kingdom`, `scientificName`, `taxonID`, `distribution`, `taxonomicStatus`                      |
| `ocorrencias`     | Occurrence records                        | `scientificName`, `kingdom`, `stateProvince`, `country`, `decimalLatitude`, `decimalLongitude` |
| `faunaAmeacada`   | Threatened fauna data                     | `threatStatus`, `scientificName`, `kingdom`                                                    |
| `cncfloraPlantae` | Threatened plant data                     | `Categoria de Risco`, `scientificName`, `kingdom`                                              |
| `cncfloraFungi`   | Threatened fungi data                     | `Categoria de Risco`, `scientificName`, `kingdom`                                              |
| `invasoras`       | Invasive species data                     | `scientificName`, `kingdom`, `family`, `oorder`                                                |
| `calFeno`         | Phenological calendar data                | `scientificName`, `family`, `genus`, `canonicalName`, `month`, `flowering`                     |
| `occurrenceCache` | Cached aggregation results                | `key`, `data`, `createdAt`, `filters`                                                          |

### Function Categories

#### Connection Management

- **Purpose**: Handle MongoDB client lifecycle and connection
- **Functions**: `getMongoUrl`, `getClient`, `connectClientWithTimeout`, `getCollection`
- **Dependencies**: Environment variables, MongoDB driver

#### Taxa Operations

- **Purpose**: Query and manipulate taxonomic data
- **Functions**: `listTaxa`, `listTaxaPaginated`, `countTaxa`, `countTaxaRegions`, `getTaxonomicStatusPerKingdom`, `getTree`, `getFamilyPerKingdom`, `getTaxaCountPerKingdom`, `getTaxaCountPerOrderByKingdom`, `getTaxaCountPerFamilyByKingdom`, `getTaxon`
- **Dependencies**: `taxa` collection, state normalization utilities

#### Occurrence Operations

- **Purpose**: Handle occurrence data queries and aggregations
- **Functions**: `listOccurrences`, `countOccurrenceRegions`
- **Dependencies**: `ocorrencias` collection, caching system, state filtering

#### Threatened Species Operations

- **Purpose**: Query endangered/threatened species data
- **Functions**: `getThreatenedCountPerKingdom`, `getThreatenedCategoriesPerKingdom`
- **Dependencies**: `faunaAmeacada`, `cncfloraPlantae`, `cncfloraFungi` collections

#### Invasive Species Operations

- **Purpose**: Query invasive species data and statistics
- **Functions**: `getInvasiveCountPerKingdom`, `getInvasiveTopOrders`, `getInvasiveTopFamilies`
- **Dependencies**: `invasoras` collection

#### Phenological Operations

- **Purpose**: Handle phenological calendar data
- **Functions**: `getCalFenoData`, `getCalFenoFamilies`, `getCalFenoGenera`, `getCalFenoSpecies`, `generatePhenologicalHeatmap`
- **Dependencies**: `calFeno` collection

#### Cache Management

- **Purpose**: Manage cached aggregation results
- **Functions**: Cache operations are handled inline within occurrence queries
- **Dependencies**: `occurrenceCache` collection, MongoDB indexes

#### Shared Utilities

- **Purpose**: Common utilities used across modules
- **Functions**: `createBrazilianStateFilter`, state validation arrays
- **Dependencies**: Brazilian geographic data

## Relationships

```
Connection Management
├── Taxa Operations (uses getCollection)
├── Occurrence Operations (uses getCollection)
├── Threatened Species Operations (uses getCollection)
├── Invasive Species Operations (uses getCollection)
├── Phenological Operations (uses getCollection)
├── Cache Management (uses getCollection)
└── Shared Utilities (independent)

Shared Utilities
├── Taxa Operations (state filtering)
├── Occurrence Operations (Brazilian state validation)
└── Cache Management (result processing)
```

## Validation Rules

### Connection Requirements

- MongoDB URI must be provided via environment variables
- Connection timeout: 10 seconds
- Connection pool: max 10 connections
- Retry writes enabled

### Data Integrity

- Taxonomic status must be valid (NOME_ACEITO, NOME_ACEITO_SINONIMO, etc.)
- Geographic coordinates must be within Brazilian boundaries
- Kingdom values must be: Plantae, Animalia, Fungi
- State/Province must be valid Brazilian state

### Cache Constraints

- TTL: 1 hour for cached results
- Key uniqueness enforced
- Background index creation

## State Transitions

### Module Loading

1. Environment variables loaded
2. MongoDB client initialized (lazy)
3. Collections accessed on-demand
4. Cache collection ensured when needed

### Query Execution

1. Collection access requested
2. Connection validated
3. Query executed with timeout
4. Results processed and returned
5. Cache updated (for aggregations)

### Error Handling

1. Connection failures → null returns with warnings
2. Query timeouts → fallback queries attempted
3. Cache failures → proceed without caching
4. Invalid data → filtered out silently

## Migration Considerations

### Backward Compatibility

- All existing function signatures maintained
- Import paths updated via barrel exports
- Error handling behavior preserved

### Performance Impact

- Lazy loading prevents startup delays
- Connection pooling maintained
- Caching strategy preserved
- Aggregation pipelines optimized

### Testing Requirements

- Each module can be unit tested independently
- Integration tests for cross-module interactions
- Performance tests for query optimization
- Error handling tests for failure scenarios
