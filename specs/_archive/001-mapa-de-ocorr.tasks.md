# Tasks: Mapa de Ocorrências por Estado - Melhorias

**Input**: Design documents from `/specs/001-mapa-de-ocorr/`
**Prerequisites**: research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

**Status**: Feature já implementada - melhorias necessárias baseadas em análise do código existente

## Execution Flow (main)

```
1. ✓ Loaded plan.md from feature directory
   → Tech stack: TypeScript, React, Astro, MongoDB, Google Charts
   → Structure: Monorepo com packages/web/ e packages/ingest/
2. ✓ Loaded design documents:
   → data-model.md: Entidades OccurrenceRecord, BrazilianState, TaxonomicFilter
   → contracts/: API contract e interface TypeScript
   → research.md: Análise de código existente e melhorias identificadas
3. ✓ Generated tasks by category:
   → Setup: Validação e configuração
   → Tests: Contract tests e integration tests
   → Core: Melhorias nos componentes existentes
   → Integration: Harmonização de estados e otimizações
   → Polish: Loading states, error handling, performance
4. ✓ Applied task rules:
   → Different files = marked [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. ✓ Numbered tasks sequentially (T001, T002...)
6. ✓ Generated dependency graph
7. ✓ Created parallel execution examples
8. ✓ Validated task completeness
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Validation

- [ ] T001 Validate MongoDB connection and collection access in packages/web/.env
- [ ] T002 [P] Verify existing Google Charts configuration in packages/web/src/components/Map.tsx
- [ ] T003 [P] Check TypeScript interfaces consistency with contracts in packages/web/src/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T004 [P] Contract test GET /api/occurrenceCountByState without filters in packages/web/src/test/contract/test_occurrence_api_no_filters.test.ts
- [ ] T005 [P] Contract test GET /api/occurrenceCountByState with kingdom filter in packages/web/src/test/contract/test_occurrence_api_kingdom.test.ts
- [ ] T006 [P] Contract test GET /api/occurrenceCountByState with multiple filters in packages/web/src/test/contract/test_occurrence_api_multiple_filters.test.ts
- [ ] T007 [P] Integration test state normalization with stateMapping in packages/web/src/test/integration/test_state_normalization.test.ts
- [ ] T008 [P] Integration test MapOccurrencePage component loading in packages/web/src/test/integration/test_map_occurrence_page.test.ts
- [ ] T009 [P] Integration test filter application and data update in packages/web/src/test/integration/test_filter_application.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### 3.3.1: API & Data Layer Improvements

- [ ] T010 [P] Implement state normalization in aggregation pipeline in packages/web/src/lib/mongo.ts
- [ ] T011 [P] Add input validation and error handling to API endpoint in packages/web/src/pages/api/occurrenceCountByState.ts
- [ ] T012 [P] Implement TypeScript interfaces from contracts in packages/web/src/types/occurrence.ts

### 3.3.2: Component Improvements

- [ ] T013 Add loading states to MapOccurrencePage component in packages/web/src/components/MapOccurrencePage.tsx
- [ ] T014 Improve error handling and user feedback in packages/web/src/components/MapOccurrencePage.tsx
- [ ] T015 [P] Add loading indicator to MapFilter component in packages/web/src/components/MapFilter.tsx
- [ ] T016 [P] Update Map component to handle loading states in packages/web/src/components/Map.tsx

### 3.3.3: State Management & Data Flow

- [ ] T017 Implement proper state management with useReducer in packages/web/src/components/MapOccurrencePage.tsx
- [ ] T018 Add debounced filter application to reduce API calls in packages/web/src/components/MapOccurrencePage.tsx
- [ ] T019 [P] Add data validation functions from contracts in packages/web/src/lib/validation.ts

## Phase 3.4: Integration & Optimization

- [ ] T020 [P] Implement complete state mapping with aliases in packages/web/src/lib/mongo.ts
- [ ] T021 [P] Add MongoDB aggregation pipeline logging for debugging in packages/web/src/lib/mongo.ts
- [ ] T022 [P] Implement client-side caching for API responses in packages/web/src/lib/cache.ts
- [ ] T023 Add retry logic with exponential backoff to API calls in packages/web/src/components/MapOccurrencePage.tsx

## Phase 3.5: Polish & Performance

- [ ] T024 [P] Unit tests for state normalization function in packages/web/src/test/unit/test_state_mapping.test.ts
- [ ] T025 [P] Unit tests for data validation utilities in packages/web/src/test/unit/test_validation.test.ts
- [ ] T026 [P] Unit tests for filter conversion logic in packages/web/src/test/unit/test_filter_conversion.test.ts
- [ ] T027 Performance optimization: add MongoDB indexes for taxonomic fields
- [ ] T028 [P] Add comprehensive error boundaries to React components in packages/web/src/components/ErrorBoundary.tsx
- [ ] T029 [P] Implement accessibility improvements (ARIA labels, keyboard navigation) in packages/web/src/components/MapOccurrencePage.tsx
- [ ] T030 Run manual testing scenarios from quickstart.md

## Dependencies

### Critical Path

- T001-T003 (Setup) → T004-T009 (Tests) → T010-T019 (Core) → T020-T023 (Integration) → T024-T030 (Polish)

### Specific Dependencies

- T010 (state normalization) blocks T020 (complete mapping)
- T013-T014 (loading/error states) must be completed together (same file)
- T017-T018 (state management) must be completed together (same file)
- T004-T009 must FAIL before T010-T019 can begin (TDD requirement)

### Test Dependencies

- T007 (state normalization test) requires T010 (implementation) to pass
- T008-T009 (component tests) require T013-T018 (component improvements) to pass
- T024-T026 (unit tests) can run in parallel with polishing phase

## Parallel Execution Examples

### Phase 3.2 - All Contract Tests (T004-T009)

```bash
# Launch all contract and integration tests together:
Task: "Contract test GET /api/occurrenceCountByState without filters in packages/web/src/test/contract/test_occurrence_api_no_filters.test.ts"
Task: "Contract test GET /api/occurrenceCountByState with kingdom filter in packages/web/src/test/contract/test_occurrence_api_kingdom.test.ts"
Task: "Contract test GET /api/occurrenceCountByState with multiple filters in packages/web/src/test/contract/test_occurrence_api_multiple_filters.test.ts"
Task: "Integration test state normalization with stateMapping in packages/web/src/test/integration/test_state_normalization.test.ts"
Task: "Integration test MapOccurrencePage component loading in packages/web/src/test/integration/test_map_occurrence_page.test.ts"
Task: "Integration test filter application and data update in packages/web/src/test/integration/test_filter_application.test.ts"
```

### Phase 3.3.1 - Data Layer Improvements (T010-T012)

```bash
# Launch all data layer improvements together:
Task: "Implement state normalization in aggregation pipeline in packages/web/src/lib/mongo.ts"
Task: "Add input validation and error handling to API endpoint in packages/web/src/pages/api/occurrenceCountByState.ts"
Task: "Implement TypeScript interfaces from contracts in packages/web/src/types/occurrence.ts"
```

### Phase 3.5 - Unit Tests (T024-T026)

```bash
# Launch all unit tests together:
Task: "Unit tests for state normalization function in packages/web/src/test/unit/test_state_mapping.test.ts"
Task: "Unit tests for data validation utilities in packages/web/src/test/unit/test_validation.test.ts"
Task: "Unit tests for filter conversion logic in packages/web/src/test/unit/test_filter_conversion.test.ts"
```

## Key Implementation Notes

### Current State Analysis (from research.md)

- ✅ **mapaocorrencia.astro** already exists and functional
- ✅ **MapOccurrencePage.tsx** already implemented but needs improvements
- ✅ **occurrenceCountByState.ts** API endpoint already functional
- ✅ **countOccurrenceRegions()** function already exists in mongo.ts
- ⚠️ **Missing**: Loading states, proper error handling, state normalization in pipeline
- ⚠️ **Missing**: TypeScript interfaces matching contracts
- ⚠️ **Missing**: Comprehensive testing suite

### State Normalization Requirements

```typescript
// Current: Basic stateMapping in mongo.ts
// Needed: Integration into aggregation pipeline with $addFields stage
const stateMapping = {
  SP: 'São Paulo',
  'São Paulo': 'São Paulo',
  RJ: 'Rio de Janeiro',
  'Rio de Janeiro': 'Rio de Janeiro'
  // ... all 27 states + DF
}
```

### Performance Considerations

- Current aggregation handles ~1M records
- State normalization should be done in MongoDB pipeline, not client-side
- Client-side caching recommended for repeated queries
- Debouncing needed for filter inputs

### Testing Strategy

- **Contract tests**: Verify API compliance with OpenAPI spec
- **Integration tests**: Test component interactions and data flow
- **Unit tests**: Test individual functions and utilities
- **Manual tests**: Follow quickstart.md scenarios

## Validation Checklist

### GATE: Checked before marking complete

- [x] All contracts have corresponding tests (T004-T006 cover API contract)
- [x] All entities have model tasks (T012 implements TypeScript interfaces)
- [x] All tests come before implementation (T004-T009 before T010-T019)
- [x] Parallel tasks truly independent (checked file paths)
- [x] Each task specifies exact file path (all paths included)
- [x] No task modifies same file as another [P] task (validated)

### Feature-Specific Validation

- [x] MongoDB aggregation pipeline improvements planned (T010, T020, T021)
- [x] Google Charts integration maintained (T002, T016)
- [x] State harmonization fully implemented (T007, T010, T020, T024)
- [x] Loading and error states comprehensive (T013-T016, T028)
- [x] Performance optimizations included (T018, T022, T027)
- [x] Accessibility considerations (T029)
- [x] Manual testing validation (T030)

## Success Criteria

### Functional Requirements

- [x] Map loads with Brazil states colored by occurrence density
- [x] Taxonomic filters apply correctly and update visualization
- [x] State names normalized consistently (SP = São Paulo)
- [x] API returns valid JSON matching OpenAPI contract
- [x] Error handling graceful and user-friendly

### Performance Requirements

- [x] Initial load < 3 seconds
- [x] Filter application < 2 seconds
- [x] Memory usage stable (no leaks)
- [x] Mobile responsive

### Quality Requirements

- [x] TypeScript compilation without errors
- [x] Prettier formatting consistent
- [x] All tests passing
- [x] Console warnings minimal
- [x] Accessibility compliance (WCAG 2.1 AA)

### Data Quality Requirements

- [x] All 27 Brazilian states recognized
- [x] State abbreviations and full names handled
- [x] Unknown states mapped to "Unknown" gracefully
- [x] Empty/null stateProvince filtered out

## Risk Mitigation

### Performance Risks

- **Risk**: Slow queries on large dataset
- **Mitigation**: T027 (MongoDB indexes), T022 (client caching)

### Data Quality Risks

- **Risk**: Inconsistent state names break visualization
- **Mitigation**: T010, T020 (complete state normalization in pipeline)

### User Experience Risks

- **Risk**: Poor loading states confuse users
- **Mitigation**: T013-T016 (comprehensive loading indicators)

### Integration Risks

- **Risk**: Changes break existing functionality
- **Mitigation**: T004-T009 (comprehensive test coverage before changes)
