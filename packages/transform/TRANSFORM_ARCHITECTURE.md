# Transform Architecture

## Overview

The transform package uses an **orchestrator pattern** with **atomic transform functions** for maximum modularity, testability, and maintainability.

## Architecture

### Core Concepts

1. **Atomic Transform Functions**: Pure functions that take a document as input and return a transformed document (or null) as output
2. **Transform Pipeline**: An ordered sequence of transform steps that process a document
3. **Transform Orchestrator**: Executes the pipeline steps in order, handling errors and null results

### Benefits

- ✅ **Modularity**: Each transformation is isolated and independently testable
- ✅ **Composability**: Transforms can be reordered, added, or removed easily
- ✅ **Debugging**: Failed steps are clearly identified with step names
- ✅ **Reusability**: Atomic transforms can be used in multiple pipelines
- ✅ **Maintainability**: Changes to one transform don't affect others

## Structure

```
packages/transform/src/
├── lib/
│   └── orchestrator.ts          # Core orchestrator engine
├── taxa/
│   ├── transforms/
│   │   ├── index.ts             # Atomic transform functions for taxa
│   │   └── pipeline.ts          # Taxa normalization pipeline
│   ├── transformTaxa.ts         # Taxa transform handler (uses pipeline)
│   └── normalizeTaxon.ts        # Legacy (kept for types)
└── occurrences/
    ├── transforms/
    │   ├── index.ts             # Atomic transform functions for occurrences
    │   └── pipeline.ts          # Occurrence normalization pipeline
    ├── transformOccurrences.ts  # Occurrence transform handler (uses pipeline)
    └── normalizeOccurrence.ts   # Legacy (kept for types)
```

## How It Works

### 1. Atomic Transform Functions

Each transform function follows this signature:

```typescript
type TransformFunction<TInput, TOutput> = (
  document: TInput
) => TOutput | null | Promise<TOutput | null>
```

Example:

```typescript
// Transform: Build canonical name from parts
export function buildCanonicalName(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const tokens = [doc.genus, doc.specificEpithet, doc.infraspecificEpithet]
  const cleaned = tokens.filter((t) => t?.trim())

  if (cleaned.length > 0) {
    doc.canonicalName = cleaned.join(' ')
  }

  return doc
}
```

### 2. Transform Steps

Each step wraps a transform function with metadata:

```typescript
const step = createTransformStep(
  'build-canonical-name', // Step name (for debugging)
  buildCanonicalName, // Transform function
  false // Optional? (default: false)
)
```

- **Required steps**: If the function returns `null`, the pipeline fails
- **Optional steps**: If the function returns `null`, the pipeline continues

### 3. Transform Pipeline

A pipeline defines the ordered sequence of transforms:

```typescript
export const taxaNormalizationPipeline = createTransformPipeline(
  'taxa-normalization', // Pipeline name
  [
    createTransformStep('validate-and-clone', validateAndClone),
    createTransformStep('filter-by-taxon-rank', filterByTaxonRank),
    createTransformStep('build-canonical-name', buildCanonicalName),
    createTransformStep('normalize-kingdom', normalizeKingdom)
    // ... more steps
  ]
)
```

### 4. Pipeline Execution

The orchestrator executes the pipeline:

```typescript
const result = await executeTransformPipeline(
  taxaNormalizationPipeline,
  rawDocument
)

if (result.success) {
  const transformedDoc = result.document
  // Process transformed document
} else {
  console.error(`Failed at step: ${result.failedAt}`)
  // Handle failure
}
```

Result structure:

```typescript
interface TransformResult<T> {
  success: boolean // Did pipeline complete successfully?
  document: T | null // Transformed document (or null if failed)
  failedAt?: string // Name of step that failed
  error?: Error // Error object (if exception occurred)
}
```

## Taxa Transform Pipeline

The taxa normalization pipeline consists of 11 steps:

1. **validate-and-clone**: Validate `_id` and clone document
2. **filter-by-taxon-rank**: Filter to supported ranks (ESPECIE, VARIEDADE, FORMA, SUB_ESPECIE)
3. **build-canonical-name**: Build canonical name from genus, epithets
4. **build-flat-scientific-name**: Build flat scientific name for search
5. **normalize-higher-classification**: Extract phylum from classification string
6. **normalize-kingdom**: Normalize kingdom name (e.g., Animalia)
7. **normalize-vernacular-names**: Lowercase, hyphenize, capitalize language
8. **extract-distribution**: Extract flora/fauna-specific distribution data
9. **normalize-species-profile**: Clean species profile data
10. **convert-resource-relationship**: Convert resourcerelationship → othernames
11. **force-animalia-kingdom**: Ensure fauna has kingdom = 'Animalia'

## Occurrence Transform Pipeline

The occurrence normalization pipeline consists of 12 steps:

1. **validate-and-clone**: Validate `_id` and clone document
2. **normalize-occurrence-id**: Trim occurrence ID
3. **build-geo-point**: Create GeoJSON point from lat/lng
4. **build-canonical-name**: Build canonical name from genus, epithets
5. **build-flat-scientific-name**: Build flat scientific name for search
6. **normalize-ipt-kingdoms**: Parse and normalize IPT kingdoms array
7. **normalize-date-fields**: Convert year/month/day to numbers
8. **normalize-event-date**: Parse event date and populate year/month/day
9. **normalize-country**: Normalize country name (e.g., "Brasil")
10. **normalize-state**: Normalize state/province name
11. **normalize-county**: Normalize county name (capitalize words)
12. **check-brazilian-and-set-reproductive**: Filter to Brazilian, set reproductive condition

## Adding New Transforms

### 1. Create the Atomic Function

```typescript
// packages/transform/src/taxa/transforms/index.ts
export function myNewTransform(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  // Perform transformation
  doc.myField = processValue(doc.rawField)
  return doc
}
```

### 2. Add to Pipeline

```typescript
// packages/transform/src/taxa/transforms/pipeline.ts
export const taxaNormalizationPipeline = createTransformPipeline(
  'taxa-normalization',
  [
    // ... existing steps
    createTransformStep('my-new-transform', myNewTransform)
  ]
)
```

### 3. Test

```typescript
// Test the atomic function
const result = myNewTransform({ rawField: 'test' })
assert(result.myField === 'expected')

// Test the full pipeline
const pipelineResult = await executeTransformPipeline(
  taxaNormalizationPipeline,
  rawDocument
)
assert(pipelineResult.success)
```

## Error Tracking

The orchestrator provides detailed error tracking:

- **Step-level errors**: Each failed step is reported as `normalization:step-name`
- **Exception handling**: Errors are caught and reported with the failing step
- **Metrics integration**: Failed steps increment error counters

Example from handler:

```typescript
const result = await executeTransformPipeline(pipeline, raw)
if (!result.success) {
  if (result.failedAt) {
    metrics.addError(`normalization:${result.failedAt}`)
  }
  if (result.error) {
    logger.warn('Error during normalization', result.failedAt, result.error)
  }
}
```

## Performance Considerations

- **Atomic functions are pure**: No side effects, making them fast and cacheable
- **Single pass**: Document flows through pipeline once
- **Minimal cloning**: Only clone at entry point, then mutate in-place
- **No unnecessary work**: Failed steps exit early

## Migration from Legacy Code

The legacy `normalizeTaxon()` and `normalizeOccurrence()` functions have been decomposed into atomic functions:

| Legacy Function         | Atomic Functions                                         |
| ----------------------- | -------------------------------------------------------- |
| `normalizeTaxon()`      | 11 atomic functions in `taxa/transforms/index.ts`        |
| `normalizeOccurrence()` | 12 atomic functions in `occurrences/transforms/index.ts` |

The legacy files are kept for type definitions but are no longer used for transformation logic.

## Future Enhancements

Potential improvements to the orchestrator:

1. **Conditional execution**: Skip steps based on document state
2. **Parallel execution**: Run independent transforms concurrently
3. **Metrics per step**: Track processing time for each step
4. **Step composition**: Create reusable transform combinations
5. **Validation steps**: Add schema validation as pipeline steps
6. **Caching**: Cache results of expensive transformations
