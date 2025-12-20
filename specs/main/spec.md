# Feature Specification: ChatBB v5.1 - Scope Redefinition and Architecture Refactor

**Created**: 2025-12-20
**Status**: Draft
**Previous Version**: V5.0

## Overview

ChatBB v5.1 refactors the Biodiversidade.Online platform to a simplified, focused architecture with three complementary access points. The Analytic Dashboard becomes the primary interface (homepage), ChatBB provides natural language access via MCP, and REST API enables programmatic integration. Core infrastructure maintains robust data ingestion and transformation pipelines for taxa, occurrences, threatened species, invasive species, and conservation units. Legacy components (phenological calendar, taxonomic search interfaces, distribution maps) are removed.

## User Scenarios & Testing

### User Story 1 - Data Analyst explores biodiversity via Dashboard homepage (Priority: P1)

A data analyst launches the platform and sees the Analytic Dashboard as the homepage. They explore Brazilian biodiversity through interactive visualizations, applying filters for species type (native, threatened, invasive), geographic location, and conservation status. When they need conversational assistance, they access ChatBB via menu.

**Why this priority**: Dashboard is the primary interface and core value; determines user first impression and accessibility.

**Independent Test**: Launch application and verify Dashboard displays as homepage with biodiversity visualizations, filters work in real-time, and ChatBB is accessible via menu.

**Acceptance Scenarios**:

1. **Given** user launches application, **When** page loads, **Then** Analytic Dashboard displays as homepage
2. **Given** user on Dashboard, **When** applies filters (species type, location, conservation status), **Then** visualizations update in real-time
3. **Given** user sees Dashboard menu, **When** clicks ChatBB option, **Then** ChatBB conversation interface opens in new window/tab
4. **Given** user has ChatBB open, **When** asks "How many threatened species are in the Amazon?", **Then** receives response with accurate data from transformed database

---

### User Story 2 - External Developer integrates via REST API with Swagger (Priority: P2)

A developer needs to integrate Brazilian biodiversity data into their system. They access the REST API documented with Swagger/OpenAPI, exploring endpoints, understanding schemas, and testing API calls directly from Swagger UI.

**Why this priority**: Programmatic access enables external integrations and extends platform reach.

**Independent Test**: Access Swagger documentation, verify all endpoints documented with examples, test API calls against transformed data, confirm response consistency.

**Acceptance Scenarios**:

1. **Given** developer accesses `/api/docs`, **When** page loads, **Then** Swagger UI displays all available endpoints
2. **Given** developer expands endpoint in Swagger (e.g., GET /api/taxa), **When** views details, **Then** sees request parameters, response schema, and code examples
3. **Given** developer makes API call GET /api/taxa?threatStatus=endangered, **When** request completes, **Then** receives JSON array of threatened species with HTTP 200
4. **Given** developer calls GET /api/occurrences with geographic filter, **When** query processes, **Then** receives GeoJSON FeatureCollection in < 500ms

---

### User Story 3 - System maintains automated data refresh cycle (Priority: P1)

System downloads new data weekly and makes it available without manual intervention. Updated data immediately appears in Dashboard, ChatBB, and API.

**Why this priority**: Data freshness is fundamental to platform value and user trust.

**Independent Test**: Workflow executes, inserts raw data in taxa_ipt/occurrences_ipt, transforms to taxa/occurrences, and all three interfaces show updated data within 1 hour.

**Acceptance Scenarios**:

1. **Given** scheduled time triggers (Flora 02:00 UTC, Fauna 02:30 UTC, Occurrences 03:00 UTC), **When** workflows execute, **Then** raw data inserted into *_ipt collections
2. **Given** raw data inserted, **When** transformation completes, **Then** transformed data appears in taxa/occurrences collections
3. **Given** transformation succeeds, **When** Dashboard/ChatBB/API refresh, **Then** new data visible to users within 1 hour
4. **Given** data includes threatened species, invasive species, conservation units, **When** transformation enrichment runs, **Then** fields populated with authoritative source data

---

### User Story 4 - ChatBB provides conversational natural language interface (Priority: P1)

User asks complex biodiversity questions in Portuguese/English. ChatBB understands context, retrieves relevant data via MCP, and provides synthesized responses with species information, locations, conservation status.

**Why this priority**: ChatBB is core interface for non-technical users and enables novel data exploration patterns.

**Independent Test**: Send 10 diverse natural language questions (species queries, geographic questions, conservation status questions); verify 95% answered correctly with data from transformed database.

**Acceptance Scenarios**:

1. **Given** user in ChatBB interface, **When** types "Quais espécies ameaçadas estão em unidades de conservação?", **Then** ChatBB retrieves data and responds with relevant species list and UC names
2. **Given** ChatBB processes question, **When** MCP queries database, **Then** response includes scientific name, threat status, location, and UC information
3. **Given** user asks follow-up question, **When** ChatBB maintains conversation context, **Then** can answer relative questions ("How many of those are endemic?")
4. **Given** MCP connection fails, **When** user sends query, **Then** user receives helpful error message explaining temporary unavailability

---

### User Story 5 - Developer modifies transformation logic and re-transforms (Priority: P2)

Developer modifies transformation code, system re-transforms data without re-ingesting raw sources, and updated data appears in all interfaces.

**Why this priority**: Enables rapid iteration on data quality and feature enhancements without waiting for full ingestion cycle.

**Acceptance Scenarios**:

1. **Given** developer modifies transformation code in taxa/occurrences handlers, **When** pushes to main, **Then** workflow automatically triggers re-transformation
2. **Given** re-transformation starts, **When** process completes, **Then** transformed data updated with new logic, no data duplication
3. **Given** transformation succeeds, **When** Dashboard/ChatBB/API query, **Then** new transformation logic reflected in results

---

### Edge Cases

- E1: IPT indisponível - continua com outros, falha logada
- E2: Dados malformados - salvos em bruta, não transformados, erro logado
- E3: Re-transformação demora - libera lock se > 2h
- E4: Duplicação entre IPTs - detectada antes de inserir
- E5: País ≠ Brasil - filtrado, retido em bruta
- E6: MCP connection to database fails - ChatBB degrades gracefully with user notification
- E7: Dashboard receives concurrent requests during transformation - uses previous valid data snapshot
- E8: API receives request for non-existent species - returns HTTP 404 with clear message
- E9: Threatened species/invasive species enrichment data missing - transformation logs warning and continues with available data

## Requirements

### Functional Requirements

**Dashboard Interface**
- **FR-D01**: MUST display Analytic Dashboard as application homepage
- **FR-D02**: MUST render real-time biodiversity visualizations (charts, statistics, filters)
- **FR-D03**: MUST support filters: species type (native, threatened, invasive), geographic location, conservation status
- **FR-D04**: MUST update visualizations within 1 second of filter changes
- **FR-D05**: MUST include menu option to open ChatBB interface
- **FR-D06**: MUST display data from transformed taxa and occurrences collections

**ChatBB Conversational Interface (via MCP)**
- **FR-C01**: MUST accept natural language queries in Portuguese and English
- **FR-C02**: MUST retrieve data from transformed database via MCP protocol
- **FR-C03**: MUST provide responses with species information (name, threat status, location, conservation unit)
- **FR-C04**: MUST maintain conversation context for follow-up questions
- **FR-C05**: MUST gracefully handle MCP connection failures with user-friendly error messages
- **FR-C06**: MUST answer 95% of well-formed biodiversity questions accurately

**REST API with Swagger Documentation**
- **FR-A01**: MUST expose complete REST API for taxa data
- **FR-A02**: MUST expose complete REST API for occurrences data
- **FR-A03**: MUST provide Swagger/OpenAPI documentation for all endpoints
- **FR-A04**: MUST support filtering: species type, geographic region, conservation status, threat level
- **FR-A05**: MUST return JSON responses with appropriate HTTP status codes (200, 400, 404, 500)
- **FR-A06**: MUST respond to queries within 500ms for up to 10,000 records
- **FR-A07**: MUST support pagination for large result sets

**Data Ingestion Pipeline**
- **FR-I01**: MUST download Flora from ipt.jbrj.gov.br (Sunday 02:00 UTC)
- **FR-I02**: MUST download Fauna from ipt.jbrj.gov.br (Sunday 02:30 UTC)
- **FR-I03**: MUST process ~490 occurrence repositories (Sunday 03:00 UTC)
- **FR-I04**: MUST validate DwC-A format and handle malformed files with descriptive error messages
- **FR-I05**: MUST store raw data in taxa_ipt and occurrences_ipt collections
- **FR-I06**: MUST preserve _id identically between raw and transformed data

**Data Transformation Pipeline**
- **FR-T01**: MUST transform taxa inline after raw data insert
- **FR-T02**: MUST transform occurrences in batch mode
- **FR-T03**: MUST extract canonicalName from scientificName
- **FR-T04**: MUST validate taxonRank values
- **FR-T05**: MUST normalize categorical fields
- **FR-T06**: MUST enrich with threatened species status from authoritative sources
- **FR-T07**: MUST enrich with invasive species information from authoritative sources
- **FR-T08**: MUST enrich with conservation unit (UC) information and geographic associations
- **FR-T09**: MUST validate geographic references
- **FR-T10**: MUST normalize eventDate for occurrences
- **FR-T11**: MUST harmonize continent and geographic fields
- **FR-T12**: MUST filter and retain only Brazil records
- **FR-T13**: MUST normalize stateProvince using consistent geographic codes
- **FR-T14**: MUST update taxonomy synonyms
- **FR-T15**: MUST associate TaxonID across sources

**System Maintenance**
- **FR-M01**: MUST trigger automated re-transformation when transformation code changes
- **FR-M02**: MUST allow manual trigger of ingestion/transformation workflows
- **FR-M03**: MUST prevent duplicate data during re-transformation
- **FR-M04**: MUST use distributed locks for concurrent operation safety
- **FR-M05**: MUST log all metrics and errors with timestamps
- **FR-M06**: MUST trace transformation execution history

**Component Removal**
- **FR-R01**: MUST remove phenological calendar code and functionality
- **FR-R02**: MUST remove taxonomic search interface components
- **FR-R03**: MUST remove distribution map components
- **FR-R04**: MUST remove all dead code dependencies on removed components

### Key Entities

- **Taxa**: Entidade taxonômica com metadados científicos, nome canonicalizado, rank, status de ameaça, categoria invasora, ocorrências em UCs
- **Ocorrência**: Registro observacional com georreferência, data padronizada, localização (estado/município/UC), referência a taxa
- **Threatened Species**: Extensão de Taxa com nível de ameaça, status de proteção, programa de recuperação
- **Invasive Species**: Extensão de Taxa com origem geográfica, impacto documentado em ecossistemas
- **Conservation Unit (UC)**: Unidade de conservação com limite geográfico, tipo de designação, status de gestão
- **TaxonID**: Identificador único para taxa em todas as bases de dados
- **IPT**: Repositório DwC-A (~490 repositórios de ocorrências)
- **DwC-A**: Darwin Core Archive - padrão de formatação de dados

## Success Criteria

- **SC-001**: Dashboard displays as homepage on application launch with zero errors
- **SC-002**: Dashboard filters update visualizations within 1 second of user input
- **SC-003**: ChatBB answers 95% of well-formed biodiversity questions with data from transformed database
- **SC-004**: REST API serves all endpoints with response time < 500ms for queries returning up to 10,000 records
- **SC-005**: Swagger documentation covers 100% of API endpoints with examples and schemas
- **SC-006**: Complete data ingestion and transformation cycle completes in < 24 hours
- **SC-007**: All three interfaces (Dashboard, ChatBB, API) show consistent data within 1 hour of transformation completion
- **SC-008**: System supports minimum 50 concurrent Dashboard users without performance degradation
- **SC-009**: All phenological calendar, taxonomic search, and distribution map code is removed from repository
- **SC-010**: Data quality metrics show < 1% of transformed records with missing critical attributes
- **SC-011**: MCP connection maintains 99% uptime for ChatBB queries
- **SC-012**: Platform documentation clearly describes three access points and use cases

### Non-Functional

- **NFR-001**: TypeScript, Bun, MongoDB 4.4+, Docker, GitHub Actions
- **NFR-002**: No exposed credentials, use environment variables
- **NFR-003**: ~12M occurrences, API latency < 500ms, Dashboard filter response < 1s
- **NFR-004**: Idempotent ingestion/transformation, no duplication
- **NFR-005**: Structured logs with timestamps, metrics, and error tracking
- **NFR-006**: MCP compatible database/API layer for ChatBB integration
- **NFR-007**: Supports 50+ concurrent Dashboard users without degradation
- **NFR-008**: Data consistency across all three interfaces within 1 hour

## Assumptions

1. MongoDB accessible via MONGO_URI environment variable
2. GitHub Actions with secrets properly configured for weekly workflow triggers
3. DwC-A files from Flora, Fauna, and occurrence IPTs are generally valid or gracefully handled with error logs
4. Existing data ingestion and transformation code in @darwincore packages can be leveraged and enhanced
5. ChatBB leverages existing Claude API or compatible LLM (specific model selection deferred to implementation)
6. MCP (Model Context Protocol) integration uses existing or to-be-developed database adapter
7. Raw data collections (_ipt) are retained for historical audit and recovery purposes
8. Taxonomy enrichment (threatened species, invasive species) uses authoritative Brazilian sources
9. Conservation unit (UC) data is maintained in accessible geographic database format
10. Meilisearch or similar search backend is optional enhancement (not required for MVP)
11. TypeScript/Bun/Astro technology stack continues from V5.0
12. Collector canonicalization remains in separate project (not v5.1 scope)

## Dependencies

- Existing spec.md and plan.md from V5.0 (as foundation)
- Packages `@darwincore/ingest`, `@darwincore/transform` (via Bun workspaces)
- Flora, Fauna, and occurrence IPT repositories
- Authoritative data sources for threatened species, invasive species
- Conservation unit geographic database
- Claude API or compatible LLM for ChatBB
- MCP protocol implementation for database access

## Out of Scope

- Technology stack changes beyond enhancements
- Web interfaces beyond Dashboard homepage consolidation
- Complete collector canonicalization
- External data systems beyond IPT/Flora/Fauna
- Real-time streaming data updates (weekly batch sufficient)
- Phenological calendar, taxonomic search interfaces, distribution maps (explicitly removed)
- Advanced analytics or custom reporting beyond Dashboard visualization
