# Transform Quick Reference

## Running Transforms

```bash
# Transform taxa (flora + fauna)
bun run transform:taxa

# Transform occurrences
bun run transform:occurrences

# Dry run (no database writes)
bun run transform:taxa -- --dry-run

# Force (ignore locks)
bun run transform:taxa -- --force
```

## Creating a New Transform Function

1. **Add atomic function** in `transforms/index.ts`:

```typescript
export function myTransform(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  // Do transformation
  doc.myField = processValue(doc.rawField)
  return doc
}
```

2. **Add to pipeline** in `transforms/pipeline.ts`:

```typescript
export const taxaNormalizationPipeline = createTransformPipeline(
  'taxa-normalization',
  [
    // ... existing steps
    createTransformStep('my-transform', myTransform, false) // false = required
  ]
)
```

3. **Test it**:

```typescript
import { executeTransformPipeline } from '../lib/orchestrator'
import { taxaNormalizationPipeline } from './transforms/pipeline'

const result = await executeTransformPipeline(
  taxaNormalizationPipeline,
  rawDocument
)

if (result.success) {
  console.log('Transformed:', result.document)
} else {
  console.log('Failed at:', result.failedAt)
}
```

## Transform Function Patterns

### Pattern 1: Simple Field Transform

```typescript
export function normalizeField(doc: NormalizedDoc): NormalizedDoc {
  if (typeof doc.field === 'string') {
    doc.field = doc.field.trim().toLowerCase()
  }
  return doc
}
```

### Pattern 2: Conditional Transform

```typescript
export function conditionalTransform(doc: NormalizedDoc): NormalizedDoc {
  if (doc.condition === 'value') {
    doc.result = processValue(doc.input)
  }
  return doc
}
```

### Pattern 3: Filter (can return null)

```typescript
export function filterInvalid(doc: NormalizedDoc): NormalizedDoc | null {
  if (!isValid(doc.field)) {
    return null // Fails the pipeline
  }
  return doc
}
```

### Pattern 4: Array Processing

```typescript
export function processArray(doc: NormalizedDoc): NormalizedDoc {
  if (Array.isArray(doc.items)) {
    doc.items = doc.items
      .map((item) => transformItem(item))
      .filter((item) => item !== null)
  }
  return doc
}
```

### Pattern 5: Cleanup/Delete Fields

```typescript
export function cleanup(doc: NormalizedDoc): NormalizedDoc {
  delete doc.tempField
  if (!doc.optionalField) {
    delete doc.optionalField
  }
  return doc
}
```

## Error Handling

### In Transform Functions

```typescript
// Don't throw errors - return null to fail
export function myTransform(doc: NormalizedDoc): NormalizedDoc | null {
  if (!isValid(doc)) {
    return null // Pipeline will fail at this step
  }
  return doc
}

// Or let exceptions bubble up - orchestrator will catch them
export function myTransform(doc: NormalizedDoc): NormalizedDoc {
  // This exception will be caught and reported
  const result = riskyOperation(doc.field)
  doc.field = result
  return doc
}
```

### In Pipeline Handler

```typescript
const result = await executeTransformPipeline(pipeline, raw)

if (!result.success) {
  // Log which step failed
  logger.warn('Transform failed', result.failedAt)

  // Track error metric with step name
  metrics.addError(`normalization:${result.failedAt}`)

  // Check if there was an exception
  if (result.error) {
    logger.error('Exception occurred', result.error)
  }
}
```

## Optional vs Required Steps

```typescript
// Required step (default) - returns null = pipeline fails
createTransformStep('validate', validateDoc, false)

// Optional step - returns null = pipeline continues
createTransformStep('enrich', enrichDoc, true)
```

## Testing Transform Functions

```typescript
import { myTransform } from './transforms'

// Test 1: Valid input
const doc1 = { field: 'test' }
const result1 = myTransform(doc1)
assert(result1?.field === 'expected')

// Test 2: Invalid input (should return null)
const doc2 = { field: null }
const result2 = myTransform(doc2)
assert(result2 === null)

// Test 3: Edge case
const doc3 = { field: '' }
const result3 = myTransform(doc3)
assert(result3?.field === '')
```

## Pipeline Debugging

### Add Logging to Transform

```typescript
export function myTransform(doc: NormalizedDoc): NormalizedDoc {
  console.log('Before:', doc.field)
  doc.field = transformValue(doc.field)
  console.log('After:', doc.field)
  return doc
}
```

### Check Pipeline Result

```typescript
const result = await executeTransformPipeline(pipeline, raw)

console.log('Success:', result.success)
console.log('Failed at:', result.failedAt)
console.log('Document:', result.document)
console.log('Error:', result.error)
```

### Track Which Documents Fail Where

```typescript
const failedSteps = new Map<string, number>()

for await (const raw of cursor) {
  const result = await executeTransformPipeline(pipeline, raw)
  if (!result.success && result.failedAt) {
    failedSteps.set(
      result.failedAt,
      (failedSteps.get(result.failedAt) || 0) + 1
    )
  }
}

console.log('Failed steps summary:', Object.fromEntries(failedSteps))
// Output: { "filter-by-rank": 150, "validate": 5, ... }
```

## Common Tasks

### Add a New Validation

```typescript
// 1. Create function
export function validateTaxonID(doc: NormalizedDoc): NormalizedDoc | null {
  if (!doc.taxonID || typeof doc.taxonID !== 'string') {
    return null
  }
  return doc
}

// 2. Add to pipeline (early in the pipeline)
createTransformStep('validate-taxon-id', validateTaxonID, false)
```

### Add a New Normalization

```typescript
// 1. Create function
export function normalizeScientificName(doc: NormalizedDoc): NormalizedDoc {
  if (typeof doc.scientificName === 'string') {
    doc.scientificName = doc.scientificName.trim()
  }
  return doc
}

// 2. Add to pipeline (after validation)
createTransformStep('normalize-scientific-name', normalizeScientificName)
```

### Reorder Pipeline Steps

```typescript
// Just reorder in the pipeline array
export const pipeline = createTransformPipeline('my-pipeline', [
  createTransformStep('step-1', fn1),
  createTransformStep('step-3', fn3), // Moved up
  createTransformStep('step-2', fn2) // Moved down
])
```

### Temporarily Disable a Step

```typescript
// Comment out the step
export const pipeline = createTransformPipeline('my-pipeline', [
  createTransformStep('step-1', fn1),
  // createTransformStep('step-2', fn2), // Temporarily disabled
  createTransformStep('step-3', fn3)
])
```

## Performance Tips

1. **Keep functions pure** - No side effects, same input = same output
2. **Mutate in place** - Don't clone unnecessarily (already cloned at entry)
3. **Return early** - Check validation first, exit fast
4. **Avoid nested loops** - O(n²) kills performance
5. **Use Set for lookups** - Not Array.includes() for large lists

## Current Pipelines

### Taxa (11 steps)

1. validate-and-clone
2. filter-by-taxon-rank
3. build-canonical-name
4. build-flat-scientific-name
5. normalize-higher-classification
6. normalize-kingdom
7. normalize-vernacular-names
8. extract-distribution
9. normalize-species-profile
10. convert-resource-relationship
11. force-animalia-kingdom

### Occurrences (12 steps)

1. validate-and-clone
2. normalize-occurrence-id
3. build-geo-point
4. build-canonical-name
5. build-flat-scientific-name
6. normalize-ipt-kingdoms
7. normalize-date-fields
8. normalize-event-date
9. normalize-country
10. normalize-state
11. normalize-county
12. check-brazilian-and-set-reproductive

## Metrics & Monitoring

Error metrics are tracked per step:

```typescript
// Old way
metrics.addError('normalization') // Generic

// New way
metrics.addError('normalization:filter-by-taxon-rank') // Specific step
```

View error breakdown:

```typescript
const snapshot = metrics.snapshot()
console.log(snapshot.errorSummary)
// {
//   'normalization:filter-by-taxon-rank': 150,
//   'normalization:validate-and-clone': 5,
//   'enrichment': 20
// }
```
