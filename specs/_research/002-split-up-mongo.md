# Research: Split up mongo.ts

## Research Tasks Completed

### 1. Analyze Current mongo.ts Usage Patterns

**Task**: Research all import statements and function usage across the codebase

**Findings**:

- **Import locations identified**:
  - `packages/web/src/scripts/init-occurrence-cache.ts` - imports `countOccurrenceRegions`
  - `packages/web/src/pages/taxon/[taxonId].json.ts` - imports `getTaxon`
  - `packages/web/src/pages/api/occurrenceCountByState.ts` - imports `countOccurrenceRegions`, `TaxaFilter`
  - `packages/web/src/pages/api/taxaCountByState.ts` - imports `countTaxaRegions`, `TaxaFilter`
  - `packages/web/src/pages/api/taxa.ts` - imports `listTaxaPaginated`
  - `packages/web/src/pages/api/family/[kingdom].ts` - imports `getFamilyPerKingdom`

- **Function usage analysis**:
  - **High usage**: `countOccurrenceRegions`, `countTaxaRegions`, `getTaxon`, `listTaxaPaginated`, `getFamilyPerKingdom`
  - **Low/No usage**: Many functions appear unused in current codebase

### 2. Identify Module Boundaries and Dependencies

**Task**: Research logical grouping of functions and interdependencies

**Findings**:

- **Connection utilities**: `getMongoUrl`, `getClient`, `connectClientWithTimeout`, `getCollection`
- **Taxa operations**: `listTaxa`, `listTaxaPaginated`, `countTaxa`, `countTaxaRegions`, `getTaxonomicStatusPerKingdom`, `getTree`, `getFamilyPerKingdom`, `getTaxaCountPerKingdom`, `getTaxaCountPerOrderByKingdom`, `getTaxaCountPerFamilyByKingdom`, `getTaxon`
- **Occurrence operations**: `listOccurrences`, `countOccurrenceRegions`
- **Threatened species**: `getThreatenedCountPerKingdom`, `getThreatenedCategoriesPerKingdom`
- **Invasive species**: `getInvasiveCountPerKingdom`, `getInvasiveTopOrders`, `getInvasiveTopFamilies`
- **Collections statistics**: `getTopCollectionsByKingdom`
- **Phenological data**: `getCalFenoData`, `getCalFenoFamilies`, `getCalFenoGenera`, `getCalFenoSpecies`, `generatePhenologicalHeatmap`
- **Cache management**: Cache operations handled inline within occurrence queries
- **Shared utilities**: `createBrazilianStateFilter`, `validBrazilianStates`, `brazilianStateVariations`

### 3. Research TypeScript Module Organization Best Practices

**Task**: Find best practices for organizing large TypeScript modules

**Findings**:

- **Barrel exports**: Use `index.ts` files to re-export from multiple modules
- **Single responsibility**: Each module should have one clear purpose
- **Dependency injection**: Consider passing client instances rather than global singletons
- **Error handling**: Centralized error handling patterns
- **Type safety**: Maintain strict typing across module boundaries

### 4. Analyze DRY Opportunities

**Task**: Identify repeated patterns that can be extracted

**Findings**:

- **Kingdom-specific queries**: Multiple functions follow `getXxxPerKingdom` pattern
- **Aggregation pipelines**: Similar MongoDB aggregation patterns for counting by categories
- **State filtering**: Brazilian state validation logic repeated
- **Collection access**: `getCollection` calls scattered throughout

## Decisions Made

### Decision: Module Structure

**Chosen**: Split into 8 focused modules (connection, taxa, occurrences, threatened, invasive, phenological, cache, utils)

**Rationale**: Follows single responsibility principle. Each module handles one aspect of MongoDB operations. Maintains Least Complex Solution Theorem - each module can stand alone.

**Alternatives considered**:

- Single large file (rejected: violates maintainability requirements)
- Split by collection type (rejected: mixes concerns like connection + business logic)
- Split by operation type (rejected: scatters related functions)

### Decision: Import Strategy

**Chosen**: Use barrel exports with `index.ts` to maintain backward compatibility

**Rationale**: Allows gradual migration of imports. Existing code can continue working while new code uses specific imports.

**Alternatives considered**:

- Direct imports from specific modules (rejected: requires immediate update of all imports)
- No barrel exports (rejected: breaks existing imports)

### Decision: Shared Dependencies

**Chosen**: Create shared utilities module for common functions

**Rationale**: DRY principle - extract common patterns like state filtering and aggregation helpers.

**Alternatives considered**:

- Duplicate code (rejected: violates DRY)
- Pass utilities as parameters (rejected: increases coupling)

### Decision: Error Handling

**Chosen**: Maintain existing error handling patterns per module

**Rationale**: Preserves existing behavior. Each module handles its own errors appropriately.

**Alternatives considered**:

- Global error handler (rejected: loses context-specific error handling)
- Throw all errors (rejected: breaks existing error handling expectations)

## Technical Approach

### Phase 1 Implementation Strategy

1. Create new module structure in `packages/web/src/lib/mongo/`
2. Extract functions following the identified boundaries
3. Create barrel exports in `index.ts`
4. Update imports to use new structure
5. Remove original `mongo.ts` file
6. Run tests and validation

### Migration Path

1. **Week 1**: Create new modules, maintain old file
2. **Week 2**: Update imports gradually, test each change
3. **Week 3**: Remove old file, final testing
4. **Week 4**: Performance optimization and cleanup

### Risk Mitigation

- **Testing**: Manual validation at each step
- **Backups**: Git commits at each major change
- **Rollback**: Can revert to original file if needed
- **Documentation**: Update all import references

## Constitution Compliance

- **Princípio I**: All documentation in Portuguese ✓
- **Princípio II**: Automated code quality maintained ✓
- **Princípio III**: No UX impact (refactoring only) ✓
- **Princípio IV**: Maintains monorepo structure ✓
- **Princípio V**: Preserves MongoDB integration ✓
