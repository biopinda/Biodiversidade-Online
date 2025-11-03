# Architecture Change: Integrated Ingestion & Transformation

**Date**: 2025-10-31  
**Status**: Proposed  
**Supersedes**: Original tasks.md (v1) with separate ingestion and transformation workflows

## Summary

This document describes the architectural change from **separate ingestion and transformation pipelines** to an **integrated approach** where transformation happens immediately after ingestion within the same process.

## Problem Statement

The original architecture (tasks.md v1) had these issues:

1. **Dual Execution**: Ingest workflow completes, then chains to transform workflow - doubling execution time
2. **Cyclic Dependencies**: Transform package needed to import from ingest (for deterministic-id utilities), but ingest would need to import from transform for integrated approach
3. **Complexity**: Two separate workflows with orchestration overhead
4. **Unnecessary Separation**: Transformation is deterministic and fast - no reason to delay it

## Solution: Integrated Ingestion + Transformation

### Core Principles

1. **Single Execution Path**: `bun run ingest:flora` downloads DwC-A → inserts raw to `taxa_ipt` → transforms → inserts to `taxa`
2. **Shared Package**: Create `packages/shared` for common utilities (deterministic-id, database, collections, metrics)
3. **Transform as Library**: Export transformation functions (`transformTaxonRecord`, `transformOccurrenceRecord`) for inline use
4. **Bulk Re-transformation**: Separate CLI (`bun run transform:taxa`) only for reprocessing when transformation logic changes

### Package Structure

```
packages/
├── shared/                    # NEW: Common utilities
│   ├── src/
│   │   ├── utils/
│   │   │   └── deterministic-id.ts
│   │   ├── lib/
│   │   │   ├── database.ts
│   │   │   └── metrics.ts
│   │   ├── config/
│   │   │   └── collections.ts
│   │   └── index.ts
│   └── package.json
│
├── ingest/                    # UPDATED: Now imports from shared + transform
│   ├── src/
│   │   ├── flora.ts          # Imports transformTaxonRecord, calls inline
│   │   ├── fauna.ts          # Imports transformTaxonRecord, calls inline
│   │   └── ocorrencia.ts     # Imports transformOccurrenceRecord, calls inline
│   └── package.json          # deps: @darwincore/shared, @darwincore/transform
│
├── transform/                 # UPDATED: Exports functions + bulk CLI
│   ├── src/
│   │   ├── taxa/
│   │   │   ├── transformTaxonRecord.ts      # EXPORTED function
│   │   │   ├── transformTaxa.ts             # Bulk pipeline (CLI)
│   │   │   ├── normalizeTaxon.ts
│   │   │   └── enrichTaxon.ts
│   │   ├── occurrences/
│   │   │   ├── transformOccurrenceRecord.ts # EXPORTED function
│   │   │   ├── transformOccurrences.ts      # Bulk pipeline (CLI)
│   │   │   ├── normalizeOccurrence.ts
│   │   │   └── enrichOccurrence.ts
│   │   ├── cli/
│   │   │   ├── runTransform.ts
│   │   │   └── checkLock.ts
│   │   └── index.ts          # Exports transformTaxonRecord, transformOccurrenceRecord
│   └── package.json          # deps: @darwincore/shared (NO ingest dependency)
│
└── web/                       # Unchanged
    └── ...
```

### Dependency Graph

```
┌─────────────┐
│   shared    │ ← Common utilities (no dependencies)
└──────┬──────┘
       │
   ┌───┴────────────┐
   │                │
┌──▼─────┐    ┌────▼────┐
│ ingest │    │transform│
│  deps: │    │  deps:  │
│ shared │    │ shared  │
│transform│    └─────────┘
└────────┘
```

**No cyclic dependency**: `transform` doesn't import from `ingest`; `ingest` imports from `transform`.

### Execution Flow

#### Ingestion (Integrated)

```typescript
// packages/ingest/src/flora.ts
import { transformTaxonRecord } from '@darwincore/transform'
import { buildTaxonDeterministicId } from '@darwincore/shared'

async function processRecord(rawDoc, db) {
  // 1. Generate deterministic _id
  const _id = buildTaxonDeterministicId({
    taxonID: rawDoc.taxonID,
    source: 'flora'
  })
  rawDoc._id = _id

  // 2. Insert raw document
  await db
    .collection('taxa_ipt')
    .updateOne({ _id }, { $set: rawDoc }, { upsert: true })

  // 3. Transform immediately
  const transformedDoc = await transformTaxonRecord(rawDoc, db)

  // 4. Insert transformed document (same _id)
  await db
    .collection('taxa')
    .updateOne({ _id }, { $set: transformedDoc }, { upsert: true })
}
```

#### Bulk Re-transformation (Standalone)

```typescript
// packages/transform/src/taxa/transformTaxa.ts
import { transformTaxonRecord } from './transformTaxonRecord'

async function retransformAll(db) {
  const cursor = db.collection('taxa_ipt').find()

  for await (const rawDoc of cursor) {
    const transformedDoc = await transformTaxonRecord(rawDoc, db)
    await db
      .collection('taxa')
      .updateOne(
        { _id: rawDoc._id },
        { $set: transformedDoc },
        { upsert: true }
      )
  }
}
```

### Workflow Changes

#### Before (v1 - Separated)

```yaml
# .github/workflows/update-mongodb-flora.yml
jobs:
  ingest:
    # ... download and insert to taxa_ipt

  transform:
    needs: ingest
    uses: ./.github/workflows/transform-taxa.yml
    secrets: inherit
```

**Problem**: Two sequential jobs, double execution time.

#### After (v2 - Integrated)

```yaml
# .github/workflows/update-mongodb-flora.yml
jobs:
  ingest:
    # ... download, insert to taxa_ipt, transform, insert to taxa (all in one job)
```

```yaml
# .github/workflows/transform-taxa.yml
on:
  workflow_dispatch: # Manual trigger
  push:
    paths:
      - 'packages/transform/package.json' # Version bump
      - 'packages/transform/src/taxa/**' # Logic change

jobs:
  retransform:
    # ... bulk re-transformation of all taxa_ipt records
```

**Benefit**: Single execution for normal flow; separate workflow only for bulk reprocessing.

## When to Use Each Approach

### Integrated Ingestion (`bun run ingest:flora`)

**Use when**:

- Regular weekly/scheduled data updates
- Initial data loading
- Processing new IPT resources

**Characteristics**:

- Downloads fresh data
- Inserts raw + transformed in one pass
- Fast (transformation is inline, no orchestration overhead)

### Bulk Re-transformation (`bun run transform:taxa`)

**Use when**:

- Transformation logic changed (bug fix, new field, updated filter)
- Version bumped in `packages/transform/package.json`
- Need to regenerate all transformed data without re-downloading

**Characteristics**:

- Reads from existing `taxa_ipt`/`occurrences_ipt`
- Reprocesses ALL records (batch processing)
- Uses locks to prevent concurrent runs
- Triggered manually or by version change

## Migration Path

### From tasks.md (v1) to tasks-v2.md

1. **Phase 1**: Create `packages/shared` and move common utilities
2. **Phase 2**: Update `packages/transform` to export transformation functions
3. **Phase 3**: Refactor `packages/ingest` to import and call transformation inline
4. **Phase 4**: Remove workflow chaining from ingestion workflows
5. **Phase 5**: Update transformation workflows for version-based/manual triggers

### Backward Compatibility

- Raw collections (`taxa_ipt`, `occurrences_ipt`) remain unchanged
- Transformed collections (`taxa`, `occurrences`) remain unchanged
- APIs consuming transformed data are unaffected
- Only internal execution flow changes

## Benefits

1. **Performance**: Single execution path eliminates workflow orchestration overhead
2. **Simplicity**: One command does both ingestion and transformation
3. **Consistency**: Raw and transformed data always in sync (atomic operation)
4. **Flexibility**: Bulk re-transformation available when needed
5. **Maintainability**: Clear separation of concerns via shared package

## Risks and Mitigations

| Risk                                  | Mitigation                                                           |
| ------------------------------------- | -------------------------------------------------------------------- |
| Transformation error breaks ingestion | Wrap transform calls in try-catch; log error but continue processing |
| Increased memory usage                | Process in batches (already implemented in current code)             |
| Debugging complexity                  | Separate metrics for ingestion vs transformation steps               |
| Version mismatch between packages     | Use workspace protocol (`workspace:*`) in package.json               |

## Success Criteria

- [ ] `bun run ingest:flora` completes and populates both `taxa_ipt` and `taxa`
- [ ] `bun run ingest:fauna` completes and populates both `taxa_ipt` and `taxa`
- [ ] `bun run ingest:occurrences` completes and populates both `occurrences_ipt` and `occurrences`
- [ ] `_id` is identical between raw and transformed collections
- [ ] `bun run transform:taxa` can regenerate all `taxa` from `taxa_ipt`
- [ ] `bun run transform:occurrences` can regenerate all `occurrences` from `occurrences_ipt`
- [ ] Workflows trigger correctly (ingestion on schedule, transform on version bump/manual)
- [ ] No cyclic dependencies detected (`bun install` succeeds)
- [ ] TypeScript compilation succeeds (`bunx tsc --build`)

## Related Documents

- **spec.md**: Updated user stories reflecting integrated approach
- **tasks-v2.md**: New task breakdown with shared package and integrated flow
- **tasks.md** (original): Preserved for reference but superseded by tasks-v2.md
