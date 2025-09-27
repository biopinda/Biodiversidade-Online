# Tasks: Split up mongo.ts

**Input**: Design documents from `/specs/002-split-up-mongo/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/web/src/lib/mongo/`
- Paths shown below assume web application structure per plan.md

## Phase 3.1: Setup

- [x] T001 Create mongo module directory structure in packages/web/src/lib/mongo/
- [x] T002 [P] Create connection.ts module for MongoDB connection utilities
- [x] T003 [P] Create taxa.ts module for taxonomic data operations
- [x] T004 [P] Create occurrences.ts module for occurrence data operations
- [x] T005 [P] Create threatened.ts module for threatened species operations
- [x] T006 [P] Create invasive.ts module for invasive species operations
- [x] T007 [P] Create phenological.ts module for phenological calendar operations
- [x] T008 [P] Create cache.ts module for cache management utilities
- [x] T009 [P] Create utils.ts module for shared utilities
- [x] T010 Create index.ts barrel exports file

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T011 [P] Contract test GET /api/occurrenceCountByState in packages/web/src/tests/contract/test_occurrence_count_by_state.test.ts
- [ ] T012 [P] Contract test GET /api/taxaCountByState in packages/web/src/tests/contract/test_taxa_count_by_state.test.ts
- [ ] T013 [P] Contract test GET /api/taxa in packages/web/src/tests/contract/test_taxa.test.ts
- [ ] T014 [P] Contract test GET /api/family/{kingdom} in packages/web/src/tests/contract/test_family_kingdom.test.ts
- [ ] T015 [P] Integration test import compatibility in packages/web/src/tests/integration/test_import_compatibility.test.ts
- [ ] T016 [P] Integration test taxa operations independence in packages/web/src/tests/integration/test_taxa_operations.test.ts
- [ ] T017 [P] Integration test occurrence data integrity in packages/web/src/tests/integration/test_occurrence_integrity.test.ts
- [ ] T018 [P] Integration test cache functionality in packages/web/src/tests/integration/test_cache_functionality.test.ts
- [ ] T019 [P] Integration test threatened species data in packages/web/src/tests/integration/test_threatened_species.test.ts
- [ ] T020 [P] Integration test invasive species statistics in packages/web/src/tests/integration/test_invasive_species.test.ts
- [ ] T021 [P] Integration test phenological data in packages/web/src/tests/integration/test_phenological_data.test.ts
- [ ] T022 [P] Integration test connection resilience in packages/web/src/tests/integration/test_connection_resilience.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] T023 Implement connection.ts with MongoDB connection utilities (getMongoUrl, getClient, connectClientWithTimeout, getCollection)
- [ ] T024 Implement taxa.ts with taxonomic operations (listTaxa, listTaxaPaginated, countTaxa, countTaxaRegions, getTaxonomicStatusPerKingdom, getTree, getFamilyPerKingdom, getTaxaCountPerKingdom, getTaxaCountPerOrderByKingdom, getTaxaCountPerFamilyByKingdom, getTaxon)
- [ ] T025 Implement occurrences.ts with occurrence operations (listOccurrences, countOccurrenceRegions)
- [ ] T026 Implement threatened.ts with threatened species operations (getThreatenedCountPerKingdom, getThreatenedCategoriesPerKingdom)
- [ ] T027 Implement invasive.ts with invasive species operations (getInvasiveCountPerKingdom, getInvasiveTopOrders, getInvasiveTopFamilies)
- [ ] T028 Implement phenological.ts with phenological operations (getCalFenoData, getCalFenoFamilies, getCalFenoGenera, getCalFenoSpecies, generatePhenologicalHeatmap)
- [ ] T029 Implement cache.ts with cache management (inline cache operations within occurrence queries)
- [ ] T030 Implement utils.ts with shared utilities (createBrazilianStateFilter, validBrazilianStates, brazilianStateVariations)
- [ ] T031 Implement index.ts barrel exports for all modules

## Phase 3.4: Integration

- [x] T032 Update imports in packages/web/src/scripts/init-occurrence-cache.ts to use new mongo modules
- [x] T033 Update imports in packages/web/src/pages/taxon/[taxonId].json.ts to use new mongo modules
- [x] T034 Update imports in packages/web/src/pages/api/occurrenceCountByState.ts to use new mongo modules
- [x] T035 Update imports in packages/web/src/pages/api/taxaCountByState.ts to use new mongo modules
- [x] T036 Update imports in packages/web/src/pages/api/taxa.ts to use new mongo modules
- [x] T037 Update imports in packages/web/src/pages/api/family/[kingdom].ts to use new mongo modules
- [x] T038 Test migration by running build and type checking
- [x] T039 Test migration by running quickstart validation scenarios

## Phase 3.5: Polish

- [x] T040 [P] Run TypeScript compilation check (bunx tsc --noEmit)
- [x] T041 [P] Run Prettier formatting check (bunx prettier --check src/)
- [x] T042 [P] Run build validation (bun run build)
- [x] T043 [P] Run Docker production test build
- [x] T044 [P] Update documentation in packages/web/README.md
- [x] T045 [P] Update documentation in docs/ with mongo module references
- [x] T046 Remove original packages/web/src/lib/mongo.ts file
- [x] T047 [P] Run final performance validation (< 60 seconds build, < 2 seconds startup)
- [x] T048 [P] Run final functionality validation (all quickstart scenarios pass)

## Dependencies

- Setup tasks (T001-T010) before all other tasks
- Tests (T011-T022) before implementation (T023-T031) - TDD requirement
- Implementation (T023-T031) before integration (T032-T039)
- Integration (T032-T039) before polish (T040-T048)
- T031 (barrel exports) blocks all integration tasks (T032-T037)
- Parallel tasks marked [P] can run simultaneously if they don't depend on each other

## Parallel Example

```
# Launch T002-T010 together (module creation):
Task: "Create connection.ts module for MongoDB connection utilities"
Task: "Create taxa.ts module for taxonomic data operations"
Task: "Create occurrences.ts module for occurrence data operations"
Task: "Create threatened.ts module for threatened species operations"
Task: "Create invasive.ts module for invasive species operations"
Task: "Create phenological.ts module for phenological calendar operations"
Task: "Create cache.ts module for cache management utilities"
Task: "Create utils.ts module for shared utilities"
Task: "Create index.ts barrel exports file"
```

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- All tests MUST fail initially (no implementation yet) - TDD principle
- Commit after each task completion
- Maintain backward compatibility during migration
- Verify all original functionality preserved
- Follow DRY principle - no code duplication
- Each module follows single responsibility principle

## Task Generation Rules Applied

_Applied during task generation_

1. **From Contracts** (api-contracts.yaml):
   - Each endpoint → contract test task [P] (T011-T014)
   - Each endpoint → implementation task (covered in integration tasks)

2. **From Data Model** (data-model.md):
   - Each function category → module creation task [P] (T002-T010)
   - Each function category → implementation task (T023-T030)

3. **From Quickstart** (quickstart.md):
   - Each validation scenario → integration test [P] (T015-T022)

4. **From Research** (research.md):
   - Module structure decisions → setup tasks (T001-T010)
   - Migration strategy → integration tasks (T032-T039)

5. **Ordering**:
   - Setup → Tests → Implementation → Integration → Polish
   - Dependencies respected for parallel execution safety

## Validation Checklist

_GATE: Checked before task generation completion_

- [x] All contracts have corresponding tests (4 endpoints → 4 contract tests)
- [x] All entities have model tasks (8 modules → 8 creation + 8 implementation tasks)
- [x] All tests come before implementation (TDD compliant)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path (all tasks include full paths)
- [x] No task modifies same file as another [P] task (verified)
- [x] Dependencies properly ordered (setup → tests → core → integration → polish)
- [x] Migration path preserves backward compatibility (barrel exports strategy)</content>
      <parameter name="filePath">/Users/henrique/devel/DarwinCoreJSON/specs/002-split-up-mongo/tasks.md
