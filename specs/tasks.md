# Tasks: ChatBB v5.1 - Scope Redefinition and Architecture Refactor

**Input**: Design documents from `/specs/`
**Prerequisites**: plan.md (implementation strategy), spec.md (user stories P1-P2)
**Status**: Ready for implementation

**Organization**: Tasks organized by user story (P1 Dashboard, P1 Data Refresh, P1 ChatBB, P2 API, P2 Transform) enabling independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=Dashboard, US2=API, US3=Data Refresh, US4=ChatBB, US5=Transform)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Astro/Bun configuration

- [ ] T001 Update root package.json with new dependencies (Claude SDK, swagger-jsdoc, MCP protocol libs) in `package.json`
- [ ] T002 Create MongoDB collections schema file at `packages/transform/schema.mongodb.js` defining `threatened_species`, `invasive_species`, `conservation_units`, `transform_status`
- [ ] T003 [P] Configure TypeScript in `packages/web/tsconfig.json` for Astro Islands components
- [ ] T004 [P] Setup Claude API environment variable documentation in `.env.example` with CLAUDE_API_KEY

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create API routing structure in `packages/web/src/pages/api/` directory with base request/response handlers
- [ ] T006 [P] Implement MongoDB connection utility in `packages/web/src/lib/mongodb.ts` (reuse V5.0 connection, add new collections)
- [ ] T007 [P] Create data transformation middleware in `packages/transform/src/lib/enrich.ts` for threatened species, invasive species, UC associations
- [ ] T008 Implement error handling and logging utilities in `packages/web/src/lib/logger.ts` with structured logging (timestamps, error codes, data source tracking)
- [ ] T009 [P] Create type definitions file `packages/web/src/types/biodiversity.ts` defining Taxa, Occurrence, ThreatStatus, InvasiveStatus, ConservationUnit, MCP query types
- [ ] T010 Setup GitHub Actions workflow structure in `.github/workflows/` directory template for data pipeline orchestration
- [ ] T011 Create Swagger/OpenAPI generator configuration in `packages/web/src/lib/swagger-config.ts` using swagger-jsdoc

**Checkpoint**: Foundation ready - design documentation can now be created

---

## Phase 2.5: Design Documentation (Required Deliverables)

**Purpose**: Create design artifacts outlined in plan.md Phase 1

- [ ] T011A Create research.md documenting 8 research topics: MCP integration patterns, Astro Islands state management, Claude API conversation context, Swagger auto-generation, data enrichment strategy, database consistency across interfaces, component removal dependencies, GeoJSON serialization in `specs/main/research.md`
- [ ] T011B Create data-model.md defining entities (Taxa, Occurrence, ThreatenedSpecies, InvasiveSpecies, ConservationUnit), fields, relationships, validation rules, and critical attributes list (scientificName, decimalLatitude, decimalLongitude, eventDate, basisOfRecord) in `specs/main/data-model.md`
- [ ] T011C Create contracts/ directory with OpenAPI 3.0 schemas for endpoints: GET /api/taxa, GET /api/occurrences, POST /api/chat/send, GET /api/dashboard/summary in `specs/main/contracts/`
- [ ] T011D Create quickstart.md with setup instructions, validation scenarios, "well-formed question" criteria for ChatBB testing (must include species name/location/attribute, grammatically correct, within biodiversity domain), performance validation steps in `specs/main/quickstart.md`
- [ ] T011E Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` to update CLAUDE.md with new dependencies (Claude SDK, MCP protocol, swagger-jsdoc), architecture notes (three interfaces pattern), key file locations

**Checkpoint**: Design documentation complete - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Dashboard Homepage (Priority: P1) 🎯 MVP

**Goal**: Deliver Analytic Dashboard as application homepage with real-time filter visualization

**Independent Test**: Launch http://localhost:4321/, verify Dashboard displays with biodiversity statistics (threatened count, invasive count, total species), apply filters (species type, region, conservation status), verify visualizations update within 1 second, verify ChatBB menu option visible

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create Dashboard component file `packages/web/src/components/Dashboard.astro` as Astro island with basic layout
- [ ] T013 [P] [US1] Create API endpoint `packages/web/src/pages/api/dashboard/summary.ts` returning total species counts by type (native, threatened, invasive)
- [ ] T014 [P] [US1] Create Dashboard filter component `packages/web/src/components/DashboardFilters.astro` (Astro Island) with species type, region, conservation_status select/checkbox inputs
- [ ] T015 [US1] Implement taxa filtering API endpoint `packages/web/src/pages/api/taxa.ts` accepting query params: type, region, conservation_status; returns JSON array with pagination (limit=100, offset)
- [ ] T016 [P] [US1] Create chart visualization components in `packages/web/src/components/Charts.astro` (using Chart.js or similar) for species type distribution bar chart and status pie chart
- [ ] T017 [P] [US1] Create statistics card components `packages/web/src/components/StatCards.astro` displaying threatened count, invasive count, total species, last updated timestamp
- [ ] T018 [US1] Connect filters to API: Implement SWR/Fetch logic in Dashboard island to call `/api/taxa` when filters change, update visualizations (target: <1 second response)
- [ ] T019 [P] [US1] Add Tailwind CSS styling to Dashboard components in `packages/web/src/styles/dashboard.css` ensuring responsive design (mobile-first) and accessibility (WCAG 2.1)
- [ ] T020 [US1] Refactor home page `packages/web/src/pages/index.astro` to use Dashboard component as primary content (rename current /taxa, /mapa, /tree to archived versions)
- [ ] T021 [P] [US1] Add ChatBB menu button to Dashboard header in `packages/web/src/components/DashboardHeader.astro` with link/modal to `/chat` route
- [ ] T022 [US1] Implement data caching layer in `packages/web/src/lib/cache.ts` with TTL=1 hour for dashboard summary and taxa queries to reduce MongoDB load
- [ ] T023 [US1] Add error handling and loading states to Dashboard filters (show spinner on filter change, display error toast if API fails)
- [ ] T024 [US1] Create integration test for Dashboard UI in `tests/integration/test-dashboard.md` - launch browser, verify elements present, test filter interactions, validate data updates

**Checkpoint**: Dashboard homepage fully functional, independently testable, ready to deploy as MVP

---

## Phase 4: User Story 3 - Data Refresh Pipeline (Priority: P1)

**Goal**: Maintain automated weekly data refresh cycle with enrichment

**Independent Test**: Run manual transformation on existing raw data, verify transformed data appears in taxa/occurrences collections, verify Dashboard/API show refreshed data within 1 hour, verify threatened species/invasive species/UC enrichment fields populated

### Implementation for User Story 3

- [ ] T025 [P] [US3] Create threatened species loader `packages/transform/src/loaders/threatened.ts` fetching from authoritative Brazilian sources (Flora/Funga), creating `threatened_species` collection with taxonID, threat_level, protection_status
- [ ] T026 [P] [US3] Create invasive species loader `packages/transform/src/loaders/invasive.ts` fetching IBAMA invasive registry, creating `invasive_species` collection with taxonID, geographic_origin, ecosystem_impact
- [ ] T027 [P] [US3] Create conservation units loader `packages/transform/src/loaders/conservation_units.ts` loading ICMBio UC data with geographic boundaries, designation_type, management_status
- [ ] T027A [P] [US3] Implement DwC-A format validation in `packages/transform/src/validation/dwca-validator.ts` checking archive structure, meta.xml schema, core/extension files, logging malformed files with descriptive errors (FR-I04)
- [ ] T027B [P] [US3] Create taxonomy synonym resolver `packages/transform/src/enrichment/synonym-resolver.ts` using Flora/Funga do Brasil API to update accepted names, track synonym mappings, log resolution history (FR-T14)
- [ ] T027C [P] [US3] Create TaxonID association module `packages/transform/src/enrichment/taxonid-linker.ts` matching taxa across IPT sources using scientificName+authorship, assigning stable TaxonID, handling conflicts (FR-T15)
- [ ] T028 [US3] Implement taxa enrichment pipeline `packages/transform/src/taxa-enrich.ts` that reads raw taxa from `taxa_ipt`, joins with enrichment collections, writes to `taxa` preserving \_id, logs metrics
- [ ] T029 [US3] Implement occurrences enrichment pipeline `packages/transform/src/occurrences-enrich.ts` that: validates coordinates against Brazil bounds (FR-T09), filters non-Brazil records (FR-T12), harmonizes continent/country fields (FR-T11), normalizes stateProvince using IBGE codes (FR-T13), associates with UCs via geographic intersection, links to taxa via TaxonID, writes to `occurrences` with error handling
- [ ] T030 [US3] Create transformation coordinator script `packages/transform/src/transform.ts` that orchestrates loaders → enrichment, implements distributed lock, tracks history in `process_metrics`
- [ ] T031 [P] [US3] Create CLI command `bun run transform:execute` in `packages/transform/package.json` that runs transformation coordinator
- [ ] T032 [US3] Update GitHub Actions workflow `.github/workflows/transform-weekly.yml` to trigger post-ingest at 04:00 UTC with distributed lock and error notifications
- [ ] T033 [US3] Implement data consistency check `packages/transform/src/validate-consistency.ts` comparing data versions across Dashboard cache, collections, and process_metrics
- [ ] T034 [US3] Create fallback mechanism in `packages/web/src/lib/data-fallback.ts` where Dashboard/API/ChatBB use previous good snapshot if transformation in progress
- [ ] T035 [US3] Add transformation status endpoint `packages/web/src/pages/api/transform-status.ts` returning current state, last run time, next scheduled, error messages
- [ ] T036 [US3] Create validation test `tests/integration/test-data-refresh.md` documenting manual trigger, verification, monitoring procedures

**Checkpoint**: Data refresh pipeline operational, enrichment working, all three interfaces receive updated data

---

## Phase 5: User Story 4 - ChatBB Conversational Interface (Priority: P1)

**Goal**: Deliver natural language interface for biodiversity questions via Claude API with MCP adapter

**Independent Test**: Open http://localhost:4321/chat, send sample questions, verify ChatBB responds with accurate data, test follow-up questions with context, verify error handling

### Implementation for User Story 4

- [ ] T037 [P] [US4] Create ChatBB page component `packages/web/src/pages/chat.astro` with message display, input field, send button, loading indicator, error display
- [ ] T038 [P] [US4] Create MCP adapter `packages/web/src/lib/mcp-adapter.ts` that maps natural language to API calls, caches common queries, handles MCP errors gracefully
- [ ] T039 [P] [US4] Create Claude API integration `packages/web/src/lib/claude-client.ts` initializing Anthropic SDK, maintaining conversation context, handling streaming responses
- [ ] T040 [US4] Create API endpoint `packages/web/src/pages/api/chat/send.ts` (POST) accepting query/conversationId, calling Claude with system prompt, using MCP adapter for data, returning response and dataSources
- [ ] T041 [P] [US4] Create chat context management `packages/web/src/lib/chat-context.ts` storing history in localStorage/MongoDB, limiting to 10 messages, providing export
- [ ] T042 [P] [US4] Create system prompts for Claude in `packages/web/src/lib/system-prompts.ts` with Portuguese and English prompts including examples and data source descriptions
- [ ] T043 [US4] Implement streaming response UI in ChatBB page displaying Claude response as it streams, showing source citations, handling stream errors
- [ ] T044 [P] [US4] Create error handling component `packages/web/src/components/ChatError.astro` displaying MCP failures, Claude errors, rate limits with retry button
- [ ] T045 [US4] Create conversation context storage in MongoDB `chat_sessions` collection with schema and TTL 7 days
- [ ] T046 [US4] Implement conversation export feature (JSON/markdown) in `packages/web/src/lib/chat-export.ts`
- [ ] T047 [US4] Create integration test `tests/integration/test-chatbb.md` documenting test questions, expected patterns, context testing, error scenarios, performance targets

**Checkpoint**: ChatBB fully functional with Claude API and MCP adapter, conversation context maintained, error handling complete

---

## Phase 6: User Story 2 - REST API with Swagger (Priority: P2)

**Goal**: Deliver complete REST API with Swagger/OpenAPI documentation

**Independent Test**: Access http://localhost:4321/api/docs, verify Swagger UI displays all endpoints with schemas, test API calls via curl, verify response times <500ms

### Implementation for User Story 2

- [ ] T048 [P] [US2] Create taxa API endpoint `packages/web/src/pages/api/taxa/index.ts` (GET) supporting type, region, conservation_status filters, pagination, returning count header
- [ ] T049 [P] [US2] Create taxa by ID endpoint `packages/web/src/pages/api/taxa/[taxonId].ts` (GET) returning single taxa with full details
- [ ] T050 [P] [US2] Create occurrences API endpoint `packages/web/src/pages/api/occurrences/index.ts` (GET) with taxonID, region, geobox, threat_status filters, pagination, <500ms target
- [ ] T051 [P] [US2] Create occurrences GeoJSON endpoint `packages/web/src/pages/api/occurrences/geojson.ts` (GET) returning FeatureCollection with geometry.Point and properties
- [ ] T052 [P] [US2] Create statistics endpoints for species-count, occurrences-by-region, conservation-units in `packages/web/src/pages/api/stats/`
- [ ] T053 [US2] Create Swagger/OpenAPI spec file `packages/web/src/lib/swagger-spec.ts` defining all endpoints with schemas, examples, error codes
- [ ] T054 [US2] Create Swagger UI endpoint `packages/web/src/pages/api/docs.ts` (GET) serving Swagger UI HTML
- [ ] T055 [P] [US2] Add request validation middleware in `packages/web/src/lib/api-validation.ts` validating query params and returning 400 if invalid
- [ ] T056 [P] [US2] Implement pagination validation in `packages/web/src/lib/pagination.ts` ensuring efficient MongoDB skip/limit
- [ ] T057 [US2] Create API performance optimization in `packages/web/src/lib/api-cache.ts` with 1 hour TTL and invalidation trigger
- [ ] T058 [P] [US2] Add CORS configuration in astro.config.mjs for external domain access
- [ ] T059 [US2] Create API integration test `tests/integration/test-api.md` with curl examples, status codes, filtering, pagination, performance validation
- [ ] T060 [US2] Create API error handling response spec `packages/web/src/lib/api-errors.ts` with standard format and HTTP codes

**Checkpoint**: REST API fully functional, Swagger documentation complete, performance targets met

---

## Phase 7: User Story 5 - Data Transformation Automation (Priority: P2)

**Goal**: Implement automated transformation triggers and monitoring

**Independent Test**: Modify transformation code, push to main, verify GitHub Actions triggers automatically, verify Dashboard/API/ChatBB reflect new logic

### Implementation for User Story 5

- [ ] T061 [P] [US5] Create GitHub Actions workflow `.github/workflows/transform-on-code-change.yml` triggering on packages/transform/\* changes with distributed lock
- [ ] T062 [P] [US5] Create manual transform trigger endpoint `packages/web/src/pages/api/admin/transform-trigger.ts` (POST) with admin auth, returning status and estimatedDuration
- [ ] T063 [US5] Create transformation monitoring dashboard `packages/web/src/pages/admin/transforms.astro` showing history, current progress, next scheduled, manual trigger button
- [ ] T064 [P] [US5] Implement transformation rollback mechanism `packages/transform/src/rollback.ts` restoring previous snapshot on >10% error rate
- [ ] T065 [US5] Create transformation monitoring alerts `packages/transform/src/alerts.ts` for timeout (>2h), error rate (>5%), enrichment coverage drops
- [ ] T066 [P] [US5] Add data version tracking `packages/web/src/lib/data-version.ts` storing version in metrics and API headers
- [ ] T067 [US5] Create transformation validation suite `packages/transform/src/validate.ts` verifying \_id consistency, enrichment fields, coordinates, geographic bounds
- [ ] T068 [US5] Implement incremental transformation capability `packages/transform/src/incremental-transform.ts` tracking transformed records by timestamp

**Checkpoint**: Transformation fully automated, monitoring and alerts in place

---

## Phase 8: Polish & Component Removal

**Purpose**: Code cleanup and legacy component removal

- [ ] T069 [P] Remove phenological calendar components: Delete fenologia.astro, Fenologia\* files, remove from navigation, clean references
- [ ] T070 [P] Remove taxonomic search interface: Delete taxa.astro, tree.astro, TaxonomicTree\* files, remove from navigation
- [ ] T071 [P] Remove distribution map components: Delete mapa.astro, DistributionMap\* files, remove map library dependencies
- [ ] T072 Audit dependencies in package.json files: Verify no unused libraries from removed components, commit cleanup
- [ ] T073 [P] Update documentation: Update README.md with three access points, create ARCHITECTURE.md, add CHANGELOG.md for v5.1
- [ ] T074 [P] Code cleanup: Run prettier, tsc --noEmit, remove dead code, update imports
- [ ] T075 [P] Add missing error handling: Audit all API endpoints, verify graceful degradation if MongoDB/Claude unavailable
- [ ] T076 [P] Performance validation: Benchmark Dashboard filter response (<1s), API endpoint response (<500ms), ChatBB query response (<2s), build time (<60s per constitution), document baselines in performance-report.md
- [ ] T077 Run quickstart.md validation: Follow setup instructions, test each user story per acceptance scenarios, document issues

**Checkpoint**: Codebase clean, legacy components removed, all code tested, performance validated

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **Design Documentation (Phase 2.5)**: Depends on Foundational - can run in parallel with early user stories or sequentially before them
- **User Stories (Phase 3-7)**: All depend on Foundational, recommended to complete Phase 2.5 first for clarity
  - P1 stories (1, 3, 4) can proceed in parallel
  - P2 stories (2, 5) can proceed after Foundational
- **Polish (Phase 8)**: Can begin after US1 complete, other phases continue in parallel

### User Story Dependencies

- **US1 (Dashboard)**: No dependencies on other stories
- **US3 (Data Refresh)**: Depends on T006 (MongoDB) but independent of other stories
- **US4 (ChatBB)**: Depends on T006 and T009 but independent of other stories
- **US2 (API)**: Can start immediately after Foundational
- **US5 (Automation)**: Depends on T006, T008 but can be implemented independently

### Parallel Opportunities

**Phase 1**: T003, T004 can run in parallel
**Phase 2**: T006, T007, T009 can run in parallel (5, 8, 10 sequential/blocking)
**US1**: T012-T024 marked [P] can parallelize (components/API before integration)
**US3**: T025-T027 loaders can parallelize, then sequential enrichment
**US4**: T037-T047 marked [P] can parallelize (components/context before integration)
**US2**: T048-T052, T055, T056, T058 marked [P] can parallelize
**US5**: T061, T062, T064, T066 marked [P] can parallelize
**Phase 8**: T069-T071, T073-T076 marked [P] can parallelize

---

## Implementation Strategy

### MVP First (Dashboard Only)

1. Phase 1 (Setup)
2. Phase 2 (Foundational)
3. Phase 2.5 (Design Documentation - recommended for clarity)
4. Phase 3 (US1 Dashboard)
5. **STOP** - Test Dashboard independently
6. Deploy/demo MVP

### Incremental Delivery

1. MVP (Phases 1-2-2.5-3: Setup + Foundational + Design + Dashboard)
2. Add US3 (Data Refresh - Phase 4)
3. Add US4 (ChatBB - Phase 5)
4. Add US2 (API - Phase 6)
5. Add US5 (Automation - Phase 7)
6. Phase 8 (Polish) throughout

### Parallel Team (5 developers)

1. All complete Phases 1-2 (Setup + Foundational)
2. Complete Phase 2.5 (Design Documentation) - can be done by 1-2 devs while others start user stories
3. Fan out to user stories:
   - Dev 1: US1 (Dashboard - Phase 3)
   - Dev 2: US3 (Data Refresh - Phase 4)
   - Dev 3: US4 (ChatBB - Phase 5)
   - Dev 4: US2 (API - Phase 6)
   - Dev 5: US5 (Automation - Phase 7)
4. Dev 1 leads Phase 8 (Polish) cleanup after US1 complete

---

## Summary

- **Total Tasks**: 85 across 9 phases
- **Setup (Phase 1)**: 4 tasks
- **Foundational (Phase 2)**: 7 tasks
- **Design Documentation (Phase 2.5)**: 5 tasks
- **US1 - Dashboard (Phase 3)**: 13 tasks
- **US3 - Data Refresh (Phase 4)**: 15 tasks
- **US4 - ChatBB (Phase 5)**: 11 tasks
- **US2 - API (Phase 6)**: 13 tasks
- **US5 - Automation (Phase 7)**: 8 tasks
- **Polish (Phase 8)**: 9 tasks

**Status**: Ready for implementation
**MVP Scope**: Phases 1-2-2.5 + Phase 3 (US1), validate independently
**Full Scope**: All Phases 1-8, all User Stories
