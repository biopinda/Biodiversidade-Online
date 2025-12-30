# Research & Technical Decisions: ChatBB v5.1

**Date**: 2025-12-21
**Scope**: 8 research topics for ChatBB v5.1 architecture

---

## 1. MCP Integration for ChatBB

### Topic

Model Context Protocol (MCP) integration patterns for natural language queries with MongoDB data access

### Decision

Implement MCP adapter pattern that acts as a bridge between Claude API prompts and MongoDB queries. The adapter will:

- Parse Claude responses to identify data access needs
- Convert natural language intents to structured MongoDB queries
- Cache common queries to reduce database load
- Return results in structured format for Claude context

### Rationale

MCP provides a standardized protocol for context management. Using an adapter pattern allows Claude to request data through MCP without needing database credentials, improving security and maintainability.

### Alternatives Considered

- Direct Claude → MongoDB connection: High security risk, no standardization
- Custom webhook approach: More complex, loses standardization benefits
- Streaming MCP: Higher latency, not needed for this use case

### Implementation Details

- Location: `packages/web/src/lib/mcp-adapter.ts`
- Supported queries: taxa lookup, occurrence search, statistics, spatial queries
- Error handling: Graceful fallback to pre-cached data if MCP fails
- Performance target: <200ms for common queries

---

## 2. Astro Islands State Management for Dashboard Filters

### Topic

Interactive filter UI without full page reloads using Astro Islands architecture

### Decision

Use Astro Islands with React components for interactive elements:

- Dashboard filters as separate React islands (DashboardFilters.tsx)
- Chart visualizations as React islands using Chart.js
- State managed locally with React hooks, synced via API calls
- Hydrate only interactive components, keep static content as Astro

### Rationale

Astro Islands provides optimal balance of:

- Server-side rendering for SEO and performance
- Selective client-side hydration only for interactive elements
- Minimal JavaScript payload
- Seamless integration with existing Astro codebase

### Alternatives Considered

- Full SPA (React/Vue): Larger bundle, slower initial load
- htmx: Good for some use cases, less suitable for complex state
- Alpine.js: Too lightweight for chart interactions

### Implementation Details

- Filter component: React island with useState for selected values
- API integration: Fetch data on filter change, debounce requests
- Chart component: React island with Chart.js integration
- Cache strategy: localStorage for filter preferences, 1-hour API cache

---

## 3. Claude API Integration and Conversation Context

### Topic

Conversation history management and prompt engineering for biodiversity queries

### Decision

Implement conversation context with:

- Store conversation history in MongoDB (`chat_sessions` collection)
- Limit history to last 10 messages for token efficiency
- System prompt with Portuguese + English examples
- Context includes: species scientific names, region names, conservation status terms
- Streaming responses using Server-Sent Events (SSE)

### Rationale

Conversation persistence enables follow-up questions with context. System prompt examples improve accuracy for biodiversity domain. SSE streaming provides real-time feedback.

### Alternatives Considered

- Stateless queries: Each query independent, loses context value
- Websockets: More complex, SSE sufficient for this use case
- No streaming: Poor UX for longer responses

### Implementation Details

- Model: Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
- Context window: 4096 tokens max
- System prompt location: `packages/web/src/lib/system-prompts.ts`
- Session TTL: 7 days in MongoDB
- Export feature: JSON and Markdown formats

---

## 4. Swagger/OpenAPI Auto-Generation Strategy

### Topic

Automatic API documentation generation from code with validation

### Decision

Use swagger-jsdoc with:

- Manual schema definition in `swagger-config.ts`
- Endpoint documentation in code comments where possible
- Swagger UI served at `/api/docs`
- Include request/response examples
- Document error codes and status responses

### Rationale

swagger-jsdoc provides standard OpenAPI 3.0 compliance without intrusive decorators. Manual schema definition ensures accuracy and clarity.

### Alternatives Considered

- tsoa decorators: More automatic, less flexible
- Raw OpenAPI: Manual management, error-prone
- GraphQL SDL: Different paradigm, not suitable for REST API

### Implementation Details

- Configuration file: `packages/web/src/lib/swagger-config.ts`
- Endpoint: GET `/api/docs` (Swagger UI HTML)
- Schema file: `packages/web/src/lib/swagger-spec.ts` (generated)
- Update frequency: Before each deployment

---

## 5. Data Enrichment Strategy

### Topic

Association of threatened species, invasive species, and conservation units with taxa and occurrences

### Decision

Implement three separate collections with foreign keys:

- `threatened_species`: taxonID → threat level, protection status
- `invasive_species`: taxonID → origin, ecosystem impact
- `conservation_units`: geometry + metadata, linked to taxa via spatial intersection

Enrichment pipeline:

1. Load authoritative sources (Flora/Funga Brasil, IBAMA, ICMBio)
2. Match by scientificName and authorship
3. Store in separate collections, not duplicating in taxa/occurrences
4. Reference via aggregation pipeline or application logic

### Rationale

Separation prevents data duplication and allows independent updates. Lookup speed optimized by indexed taxonID.

### Alternatives Considered

- Embed enrichment data in taxa: Harder to update independently
- Single denormalized collection: Data duplication, consistency issues
- Lazy-load on query: N+1 problem, slower queries

### Implementation Details

- Threatened species source: Flora/Funga do Brasil API
- Invasive species source: IBAMA public registry
- Conservation units source: ICMBio shapefile + database
- Matching algorithm: scientificName + authorship match, fallback to Levenshtein distance
- Update frequency: Weekly, coordinated via GitHub Actions

---

## 6. Database Consistency Across Three Interfaces

### Topic

Ensuring Dashboard, ChatBB, and API always show consistent data

### Decision

Implement data versioning with:

- Store `data_version` timestamp in each document and as metadata
- Cache layer with 1-hour TTL for dashboard and API
- Fallback to previous good snapshot if transformation in progress
- Version header in API responses
- Consistency check: Dashboard/ChatBB/API query same data version within 1 hour

### Rationale

Allows eventual consistency while preventing stale data visible in UI. Fallback mechanism prevents errors during transformation.

### Alternatives Considered

- Strong consistency (ACID): MongoDB doesn't guarantee ACID across collections
- No caching: Too slow for dashboard performance targets
- No versioning: Can't detect staleness issues

### Implementation Details

- Version tracking: `process_metrics` collection stores transformation timestamp
- Cache invalidation: TTL-based (1 hour), manual triggers on critical updates
- Fallback logic: If transformation age > 30 min, serve previous snapshot
- Monitoring: `/api/transform-status` endpoint shows current state

---

## 7. Component Removal Strategy and Dependency Analysis

### Topic

Safely removing legacy components (phenological calendar, taxonomic search, distribution map) without breaking dependencies

### Decision

Phased removal with dependency analysis:

1. Identify all imports of removed components (grep-based audit)
2. Remove components in order: phenological (lowest dependencies) → tree → maps
3. Update navigation and route configuration
4. Run `npm audit` and type checks after each removal
5. Archive old components in `/archive/` before deletion

### Rationale

Staged removal reduces risk. Archive preserves code for reference.

### Alternatives Considered

- Big bang removal: High risk of breakage
- Keep unused code: Code bloat, confusion
- Feature flags: Unnecessary complexity for permanent removal

### Implementation Details

- Files to remove:
  - `packages/web/src/pages/fenologia.astro`
  - `packages/web/src/components/Fenologia*.tsx`
  - `packages/web/src/pages/tree.astro`
  - `packages/web/src/components/Tree.tsx`
  - `packages/web/src/pages/mapa.astro`
  - `packages/web/src/components/Map*.tsx`
- Archive location: `archive/v5.0/components/`
- Verification: TypeScript compilation, Prettier check, dependency audit

---

## 8. GeoJSON Handling and Spatial Queries

### Topic

Efficient serialization and querying of geographic features

### Decision

Implement GeoJSON with:

- MongoDB GeoJSON type for coordinates: `{ type: "Point", coordinates: [lng, lat] }`
- Geospatial index on occurrences collection for performance
- Convert Occurrence → GeoJSON Feature in application layer
- Pagination for large result sets (default 1000 features)
- Optional bbox filtering for performance

### Rationale

MongoDB's native GeoJSON support enables spatial queries. Geospatial indexes optimize bbox and distance queries. Application-layer conversion provides flexibility.

### Alternatives Considered

- WKT format: Less supported by MongoDB
- GeoHash: Useful for clustering, overkill for this use case
- PostGIS: Would require PostgreSQL, increases complexity

### Implementation Details

- Coordinate order: [longitude, latitude] (GeoJSON standard)
- Validation: coordinates within Brazil bounds (-73.9 to -34.9, -33.8 to 5.3)
- Geospatial index: 2dsphere on `geometry` field
- API endpoint: GET `/api/occurrences/geojson`
- Response format: RFC 7946 compliant FeatureCollection

---

## Summary of Technical Decisions

| Topic                     | Decision                            | Status   |
| ------------------------- | ----------------------------------- | -------- |
| MCP Integration           | Adapter pattern with MongoDB bridge | Approved |
| Astro Islands State       | React islands for interactivity     | Approved |
| Claude API Context        | 10-message history, SSE streaming   | Approved |
| Swagger Documentation     | swagger-jsdoc with manual schemas   | Approved |
| Data Enrichment           | Separate collections with linking   | Approved |
| Database Consistency      | Versioning + caching with fallback  | Approved |
| Component Removal         | Phased removal with archive         | Approved |
| GeoJSON & Spatial Queries | Native MongoDB GeoJSON + indexes    | Approved |

---

## Implementation Timeline

- **Phase 1-2**: Core infrastructure (dependencies, types, logger, Swagger config)
- **Phase 2.5**: This research document + additional design docs
- **Phase 3**: MCP adapter, Claude integration, Dashboard filters (topics 1, 2, 3)
- **Phase 4**: Data enrichment loaders (topic 5)
- **Phase 5**: ChatBB implementation with conversation context (topics 3, 4)
- **Phase 6**: API endpoints with Swagger documentation (topic 4)
- **Phase 7**: Consistency monitoring and versioning (topic 6)
- **Phase 8**: Component removal (topic 7), final GeoJSON validation (topic 8)

---

**Status**: Research complete, ready for Phase 1 design documentation
