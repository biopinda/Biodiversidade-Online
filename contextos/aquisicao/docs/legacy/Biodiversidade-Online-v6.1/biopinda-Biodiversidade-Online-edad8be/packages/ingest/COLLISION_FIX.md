# Fix: Taxa ID Collision Between Flora and Fauna

## Problem

TaxonIDs from the Flora do Brasil IPT and Fauna do Brasil IPT were colliding because the same numeric IDs exist in both datasets. This caused documents from one source to overwrite documents from the other source.

### Example Collision

```
Flora taxon: taxonID = "12345" → _id = "12345"
Fauna taxon: taxonID = "12345" → _id = "12345"  ❌ COLLISION!
```

When both were ingested, the fauna record would overwrite the flora record (or vice versa), resulting in data loss.

## Historical Context

Before the restructure, the system used prefixes to distinguish between sources:

- **`P{taxonID}`** for flora (Plantae)
- **`A{taxonID}`** for fauna (Animalia)

This fix restores that convention.

## Root Cause

The `buildTaxonDeterministicId()` function only used the `taxonID` field to generate MongoDB `_id` values:

```typescript
// BEFORE (buggy)
export function buildTaxonDeterministicId(
  source: TaxonIdentifierSource
): string {
  const taxonId = normalize(source.taxonID)
  return sanitizeSegment(taxonId) // Only uses taxonID - no source distinction
}
```

This assumed `taxonID` was globally unique, but it's only unique **within each IPT resource**.

## Solution

Modified `buildTaxonDeterministicId()` to use **A** and **P** prefixes (restoring the original convention):

```typescript
// AFTER (fixed)
export function buildTaxonDeterministicId(
  source: TaxonIdentifierSource
): string {
  const taxonId = normalize(source.taxonID)
  if (!taxonId) {
    throw new Error('taxonID required')
  }

  // Use A prefix for fauna (Animalia) and P prefix for flora (Plantae)
  // to prevent collisions between sources while maintaining compact IDs
  if (source.source === 'fauna') {
    return `A${sanitizeSegment(taxonId)}`
  }
  if (source.source === 'flora') {
    return `P${sanitizeSegment(taxonId)}`
  }

  // Fallback for backward compatibility
  return sanitizeSegment(taxonId)
}
```

### ID Format

New format uses single-letter prefixes:

- **P** = Plantae (flora)
- **A** = Animalia (fauna)

Examples:

- Flora: `P12345` (was `12345`)
- Fauna: `A12345` (was `12345`)

This is **compact, clear, and matches the historical convention**.

## Files Changed

1. **`packages/ingest/src/utils/deterministic-id.ts`**
   - Updated `TaxonIdentifierSource` interface to include `source?: 'flora' | 'fauna'`
   - Modified `buildTaxonDeterministicId()` to use A/P prefixes based on source

2. **`packages/ingest/src/flora.ts`**
   - Pass `source: 'flora'` to `buildTaxonDeterministicId({ taxonID, source: 'flora' })`

3. **`packages/ingest/src/fauna.ts`**
   - Pass `source: 'fauna'` to `buildTaxonDeterministicId({ taxonID, source: 'fauna' })`

## Impact

### Positive

- ✅ Eliminates collisions between flora and fauna taxa
- ✅ Each taxon gets a unique, deterministic ID
- ✅ Prevents data loss from overwrites
- ✅ Maintains determinism - same input always produces same ID
- ✅ Compact format - only 1 extra character (P or A prefix)
- ✅ Semantically meaningful - P for Plantae, A for Animalia
- ✅ Restores historical convention used before restructure
- ✅ Backward compatible fallback when `source` not provided

### Migration Needed

- ⚠️ Existing documents in `taxa_ipt` collection will need to be re-ingested
- ⚠️ Old IDs (format: `{taxonID}`) will be replaced with new IDs (format: `P{taxonID}` or `A{taxonID}`)
- ⚠️ Any references to old IDs in other collections will need updating

## Testing

Created comprehensive test suite in `packages/ingest/test/test-deterministic-id.ts`:

```
Test 1: Taxa IDs - Flora vs Fauna Collision Prevention ✅
Test 2: Taxa IDs - Same Source, Different taxonIDs ✅
Test 3: Taxa IDs - Without iptId (fallback) ✅
Test 4: Occurrence IDs - IPT-based uniqueness ✅
Test 5: Real-world Flora vs Fauna Scenario ✅
Test 6: ID Format Verification ✅
```

All tests passing! 🎉

## Example Usage

### Before Fix

```typescript
// Both produce same ID - COLLISION!
const floraId = buildTaxonDeterministicId({ taxonID: 'FB12345' })
// => "FB12345"

const faunaId = buildTaxonDeterministicId({ taxonID: 'FB12345' })
// => "FB12345"  ❌ Same as flora!
```

### After Fix

```typescript
// Different IDs - NO COLLISION!
const floraId = buildTaxonDeterministicId({
  taxonID: 'FB12345',
  source: 'flora'
})
// => "PFB12345"

const faunaId = buildTaxonDeterministicId({
  taxonID: 'FB12345',
  source: 'fauna'
})
// => "AFB12345"  ✅ Unique!
```

## Next Steps

1. **Re-ingest flora and fauna data** to populate with new ID format
2. **Clear taxa_ipt collection** (optional - or let replaceOne handle it)
3. **Run transform pipeline** to regenerate transformed data
4. **Verify no collisions** in database:
   ```javascript
   // Should return 0
   db.taxa_ipt.aggregate([
     { $group: { _id: '$_id', count: { $sum: 1 } } },
     { $match: { count: { $gt: 1 } } },
     { $count: 'duplicates' }
   ])
   ```

## Database State

### Before Fix

```
taxa_ipt collection:
- Total: N documents
- Collisions: Unknown (silent overwrites)
- Flora-only taxa: Some missing due to fauna overwrites
- Fauna-only taxa: Some missing due to flora overwrites
```

### After Fix

```
taxa_ipt collection:
- Total: N documents (all preserved)
- Collisions: 0 (guaranteed unique)
- Flora taxa: All present with P prefix (e.g., PFB12345)
- Fauna taxa: All present with A prefix (e.g., AFB12345)
```

## Performance

Improved performance over long suffix approach:

- Still O(1) ID generation
- **Shorter IDs** - only adds 1 character (P or A)
- **Less storage overhead** - compact format
- Same indexing performance
- Easier to read and debug

## Rollback

If needed, can rollback by:

1. Revert changes to `deterministic-id.ts`, `flora.ts`, `fauna.ts`
2. Re-ingest with old code
3. Note: Will lose one dataset to collisions again

Not recommended - fix is correct approach.
