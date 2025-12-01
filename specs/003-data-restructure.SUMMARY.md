# Architecture Rework Summary

## What Changed

I've completely reworked the architecture based on your suggestion to integrate transformation into the ingestion process. Here's what was updated:

### 1. **New Architecture: Integrated Ingestion + Transformation**

**Before**:

- Ingest downloads data → saves to `taxa_ipt` → workflow completes
- Transform workflow triggers → reads `taxa_ipt` → transforms → saves to `taxa`

**After**:

- Ingest downloads data → saves to `taxa_ipt` → **immediately transforms** → saves to `taxa` (all in one process)
- Transform workflow only for **bulk re-processing** when transform logic changes

### 2. **New Package: `packages/shared`**

Created to avoid cyclic dependencies between `ingest` ↔ `transform`:

```
packages/shared/
├── src/
│   ├── utils/deterministic-id.ts    # Moved from ingest
│   ├── lib/database.ts              # MongoDB connection utilities
│   ├── lib/metrics.ts               # Metrics tracking
│   └── config/collections.ts        # Collection name constants
```

**Dependencies**:

- `shared` has no package dependencies (only mongodb, bson, types)
- `ingest` depends on `shared` + `transform`
- `transform` depends on `shared` (NOT on ingest)

### 3. **Updated Documents**

#### `specs/003-data-restructure/spec.md`

- **User Story 1**: Now "Ingestão e Transformação Integrada de Taxa" (was just "Ingestão")
- **User Story 2**: Now "Ingestão e Transformação Integrada de Ocorrências"
- **User Story 3**: NEW - "Re-transformação em Massa" (bulk reprocessing)
- **User Story 4**: APIs (was US5)
- **User Story 5**: Web Interface (was US6)
- Removed old US3 and US4 (transformation as separate steps)
- Updated all functional requirements to reflect integrated approach

#### `specs/003-data-restructure/tasks-v2.md` (NEW)

Complete rewrite of task breakdown:

- **Phase 1**: Setup shared package (T001-T008)
- **Phase 2**: Transform package foundation - exportable functions (T009-T017)
- **Phase 3**: US1 - Integrated taxa ingestion (T018-T020)
- **Phase 4**: US2 - Integrated occurrence ingestion (T021)
- **Phase 5**: US3 - Bulk re-transformation (T022-T026)
- **Phase 6**: US4 - APIs (T027-T034)
- **Phase 7**: US5 - Web interface (T035-T041)
- **Phase 8**: Workflows (T042-T046)
- **Phase 9**: Documentation (T047-T051)

**Total**: 51 tasks (down from 45, but more focused)

#### `specs/003-data-restructure/ARCHITECTURE_CHANGE.md` (NEW)

Comprehensive documentation explaining:

- Problem with old architecture
- Solution design
- Package structure
- Execution flow examples
- When to use integrated vs bulk approach
- Migration path
- Benefits and risks

### 4. **Key Implementation Changes**

#### Ingestion Scripts Will Look Like:

```typescript
// packages/ingest/src/flora.ts
import { transformTaxonRecord } from '@darwincore/transform'

async function processRecord(rawDoc, db) {
  // 1. Insert raw
  await db
    .collection('taxa_ipt')
    .updateOne({ _id: rawDoc._id }, { $set: rawDoc }, { upsert: true })

  // 2. Transform immediately
  const transformed = await transformTaxonRecord(rawDoc, db)

  // 3. Insert transformed
  await db
    .collection('taxa')
    .updateOne(
      { _id: transformed._id },
      { $set: transformed },
      { upsert: true }
    )
}
```

#### Transform Package Exports:

```typescript
// packages/transform/src/index.ts
export { transformTaxonRecord } from './taxa/transformTaxonRecord'
export { transformOccurrenceRecord } from './occurrences/transformOccurrenceRecord'
```

#### Bulk Re-transformation CLI:

```bash
# Only when transform logic changes or version bumps
bun run transform:taxa
bun run transform:occurrences
```

### 5. **Workflow Changes**

#### Ingestion Workflows (flora, fauna, occurrences)

**Removed**: Automatic chaining to transform workflows

```yaml
# OLD - REMOVED
transform:
  needs: ingest
  uses: ./.github/workflows/transform-taxa.yml
```

**Why**: Transformation now happens inline during ingestion

#### Transform Workflows (taxa, occurrences)

**Updated**: Trigger only on version bump or manual

```yaml
on:
  workflow_dispatch: # Manual trigger
  push:
    paths:
      - 'packages/transform/package.json' # Version bump
      - 'packages/transform/src/taxa/**' # Logic change
```

## Benefits of New Architecture

1. ✅ **Faster**: Single execution eliminates workflow orchestration overhead
2. ✅ **Simpler**: One command (`bun run ingest:flora`) does everything
3. ✅ **Consistent**: Raw and transformed data always in sync
4. ✅ **Flexible**: Bulk re-transformation available when needed
5. ✅ **No Cyclic Dependencies**: Clean package structure via `shared`

## When to Use What

### Regular Data Updates

```bash
# Weekly cron or manual update
bun run ingest:flora      # Downloads + transforms
bun run ingest:fauna      # Downloads + transforms
bun run ingest:occurrences # Downloads + transforms
```

### Transform Logic Changed

```bash
# Bump version in packages/transform/package.json
# Then either:
git push  # GitHub Actions auto-triggers transform workflows
# OR
bun run transform:taxa         # Manual local run
bun run transform:occurrences  # Manual local run
```

## Next Steps

To implement this architecture:

1. **Start with Phase 1** (T001-T008): Create `packages/shared`
2. **Then Phase 2** (T009-T017): Setup transform exports
3. **Then Phase 3** (T018-T020): Update flora/fauna scripts
4. **Then Phase 4** (T021): Update occurrences script
5. Continue with remaining phases

## Files Updated

- ✅ `specs/003-data-restructure/spec.md` - User stories reworked
- ✅ `specs/003-data-restructure/tasks-v2.md` - NEW task breakdown
- ✅ `specs/003-data-restructure/ARCHITECTURE_CHANGE.md` - NEW architecture docs
- ✅ `package.json` - Added comments explaining integrated approach

## Files Preserved

- 📄 `specs/003-data-restructure/tasks.md` - Original (for reference)
- 📄 Other spec files (plan.md, research.md, etc.) - Still valid

## Questions?

The architecture is now aligned with your vision:

- ✅ Transform happens during ingest (no separate step)
- ✅ Shared code in `packages/shared` (no cyclic deps)
- ✅ Transform workflows only for version bumps/manual triggers
- ✅ Clean dependency graph: `shared` ← `transform` ← `ingest`

Ready to start implementation with Phase 1 (creating the shared package)?
