# Biodiversidade.Online v5.1 Architecture

**Version**: 5.1.0
**Date**: 2025-12-21
**Status**: Implementation Complete (MVP Ready)

## Overview

ChatBB v5.1 refactors Biodiversidade.Online into a simplified, user-focused architecture with three complementary interfaces consuming unified transformed data:

1. **Analytic Dashboard** - Visual exploration with real-time filters
2. **ChatBB** - Natural language conversational interface
3. **REST API** - Programmatic integration with Swagger documentation

## Three-Interface Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Sources (IPT, GBIF, etc.)               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │  Ingest Package │
                        │ (packages/ingest)│
                        └────────┬────────┘
                                 │
                        ┌────────▼────────────┐
                        │ Transform Package   │
                        │(packages/transform) │
                        └────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
   ┌─────▼─────┐          ┌─────▼──────┐         ┌──────▼──────┐
   │  MongoDB  │          │  MongoDB   │         │   MongoDB   │
   │  (Core)   │          │ (Enriched) │         │  (Sessions) │
   └─────┬─────┘          └─────┬──────┘         └──────┬──────┘
         │                      │                       │
         └──────────────────────┼──────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
    ┌────▼────────┐    ┌────────▼────────┐   ┌────────▼────────┐
    │  Dashboard  │    │    ChatBB       │   │   REST API      │
    │ (Port 4321) │    │ (Port 4321/chat)│   │ (/api/*)        │
    └─────────────┘    └─────────────────┘   └─────────────────┘
```

## Component Details

### 1. Analytic Dashboard (User Story 1)

**Location**: `packages/web/src/pages/index.astro`

**Components**:

- `Dashboard.astro` - Main container
- `DashboardHeader.tsx` - Navigation (ChatBB link, API docs)
- `DashboardFilters.tsx` - Interactive filters (type, region, status)
- `StatCards.tsx` - Statistics display
- `Charts.tsx` - Visualizations (bar, pie)

**API Endpoints**:

- `GET /api/dashboard/summary` - Statistics (threatened, invasive, total)

**Features**:

- Real-time filter updates (<1 second)
- Responsive design (mobile-first)
- WCAG 2.1 accessibility
- 1-hour cache for performance
- Portuguese/English language support

**Performance Targets**:

- Page load: <2 seconds
- Filter response: <1 second
- No JavaScript (Astro Islands only on interactive elements)

---

### 2. ChatBB Conversational Interface (User Story 4)

**Location**: `packages/web/src/pages/chat.astro`

**Components**:

- `ChatBB.tsx` - Full chat interface
- `claude-client.ts` - Anthropic SDK integration
- `mcp-adapter.ts` - Natural language → MongoDB mapping

**API Endpoints**:

- `POST /api/chat/send` - Send message, get Claude response

**Features**:

- Natural language queries ("Quantas espécies ameaçadas?")
- Conversation history (last 10 messages, 7-day retention)
- Data source citation
- Export (JSON/Markdown)
- Streaming responses (prepared)
- Error handling with fallback

**Claude Integration**:

- Model: claude-3-5-sonnet-20241022
- Context: Biodiversity-focused system prompt
- Max tokens: 4096
- Temperature: Default (0.7)

**Performance Targets**:

- First response: <1 second
- Complete response: <5 seconds
- Context accuracy: >95% on well-formed questions

---

### 3. REST API (User Story 2)

**Location**: `packages/web/src/pages/api/`

**Core Endpoints**:

```
GET /api/dashboard/summary
  ├─ totalSpecies
  ├─ threatenedCount
  ├─ invasiveCount
  └─ totalOccurrences

GET /api/taxa
  ├─ Query: type, region, conservation_status, limit, offset
  └─ Returns: PaginatedResponse<Taxa>

GET /api/occurrences
  ├─ Query: taxonID, region, geobox, limit, offset
  └─ Returns: PaginatedResponse<Occurrence>

GET /api/occurrences/geojson
  ├─ Query: bbox, limit
  └─ Returns: RFC 7946 FeatureCollection

GET /api/transform-status
  ├─ status: idle, running, failed, success
  ├─ lastRun: ISO timestamp
  ├─ nextScheduled: ISO timestamp
  └─ errorCount: number

GET /api/docs
  └─ Returns: Swagger UI HTML (OpenAPI 3.0)

POST /api/chat/send
  ├─ Body: { query, conversationId }
  └─ Returns: { response, dataSources, conversationId }
```

**Validation**:

- Request validation before queries
- Type checking (limit, offset, region, geobox)
- Bounds validation (Brazil coordinates)
- Error responses with standard codes

**CORS**:

- Whitelisted origins: localhost, biodiversidade.online
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type, Authorization, X-Requested-With
- Credentials: Enabled

**Error Handling**:

- 400: Invalid parameters
- 404: Resource not found
- 500: Database/service error
- 503: Service unavailable

**Performance**:

- Pagination max: 10,000 records
- GeoJSON max: 1,000 features
- Cache: 1-3600 seconds (by endpoint)
- Response target: <500ms

**Swagger Documentation**:

- Endpoint: `GET /api/docs`
- Format: OpenAPI 3.0
- Try-it-out enabled
- Schema validation

---

## Data Model

### Collections

| Collection           | Purpose                    | Indexes                                              | TTL    |
| -------------------- | -------------------------- | ---------------------------------------------------- | ------ |
| `taxa`               | Species with enrichment    | scientificName, family, threatStatus, invasiveStatus | None   |
| `occurrences`        | Observations with location | geometry (2dsphere), taxonID, eventYear, stateCode   | None   |
| `threatened_species` | Threat data                | taxonID                                              | None   |
| `invasive_species`   | Invasive metadata          | taxonID                                              | None   |
| `conservation_units` | Protected areas            | geometry (2dsphere), jurisdictionCode                | None   |
| `chat_sessions`      | Conversation history       | userId                                               | 7 days |
| `data_versions`      | Version tracking           | timestamp                                            | None   |
| `process_metrics`    | Transformation logs        | startTime                                            | None   |

### Critical Attributes

**Taxa**:

- scientificName (required)
- kingdom, phylum, class, order, family, genus
- threatStatus, invasiveStatus
- occurrenceCount

**Occurrence**:

- taxonID (foreign key)
- decimalLatitude, decimalLongitude (required, indexed, spatial)
- eventDate, eventYear
- stateProvince, stateCode
- threatStatus, invasiveStatus, conservationUnit

---

## Data Flow

### 1. Ingest Flow

```
IPT Repositories
    ↓
packages/ingest (parse DwC-A)
    ↓
MongoDB: taxa_ipt, occurrences_ipt
```

### 2. Transform Flow

```
Raw Collections (taxa_ipt, occurrences_ipt)
    ↓
Loaders (threatened, invasive, UCs)
    ↓
Enrichment (join, associate)
    ↓
MongoDB: taxa, occurrences (enriched)
    ↓
Version tracking in process_metrics
```

### 3. Query Flow

**Dashboard**:

```
GET /api/dashboard/summary
    ↓
MongoDB (taxa, occurrences collections)
    ↓
Cache (1 hour)
    ↓
Response (total, threatened, invasive counts)
```

**ChatBB**:

```
POST /api/chat/send
    ↓
MCP Adapter (parse query → MongoDB query)
    ↓
Fetch data (taxa, occurrences)
    ↓
Claude API (with data context)
    ↓
Store in chat_sessions
    ↓
Response (with data sources)
```

**REST API**:

```
GET /api/taxa?filters
    ↓
Validate parameters
    ↓
MongoDB query (with indexes)
    ↓
Paginate results
    ↓
Cache (1 hour)
    ↓
Response + headers
```

---

## Technology Stack

| Layer             | Technology                 | Version           |
| ----------------- | -------------------------- | ----------------- |
| **Frontend**      | Astro + React              | Latest            |
| **Backend**       | Node.js + Astro API Routes | 20.19.4+          |
| **Runtime**       | Bun                        | 1.2.21+           |
| **Database**      | MongoDB                    | 5.0+              |
| **Styling**       | Tailwind CSS               | 3.x               |
| **AI/ML**         | Claude API (Anthropic)     | claude-3-5-sonnet |
| **Documentation** | Swagger/OpenAPI            | 3.0               |
| **CI/CD**         | GitHub Actions             | Latest            |

---

## Deployment Architecture

### Local Development

```
npm install
# Set environment variables
npm run web:dev
# http://localhost:4321
```

### Production

```
Dockerfile
    ↓
Docker Container (Node.js)
    ↓
Docker Registry
    ↓
Kubernetes / Cloud Platform
    ↓
Port 4321 (HTTP)
    ↓
MongoDB (external)
```

---

## Security & Compliance

### Input Validation

- ✅ Query parameter validation
- ✅ Type checking (limit, offset, region, geobox)
- ✅ Bounds validation (Brazil coordinates)
- ✅ Sanitization before database queries

### CORS & Headers

- ✅ CORS whitelisting (localhost, biodiversidade.online)
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options)
- ✅ XSS protection (1; mode=block)
- ✅ Credentials support

### Data Privacy

- ✅ Chat sessions auto-expire (7 days)
- ✅ No sensitive data in logs
- ✅ MongoDB authentication via secrets
- ✅ Claude API key in environment

### Compliance

- ✅ WCAG 2.1 accessibility
- ✅ Data localization (Brazil focus)
- ✅ Scientific nomenclature standards
- ✅ Open data compatible (GBIF, SiBBr)

---

## Monitoring & Maintenance

### Health Checks

- `GET /api/health` - Service status
- `GET /api/transform-status` - Transformation status
- `GET /api/dashboard/summary` - Data availability

### Alerts

- High error rate (>5%)
- Transformation timeout (>2 hours)
- No data updates (>24 hours)
- Service unavailability

### Backups

- Snapshot-based rollback (last 5 versions)
- MongoDB backups (external)
- GitHub repository backups

### Performance Monitoring

- Dashboard filter response (<1s)
- API endpoint response (<500ms)
- ChatBB query response (<5s)
- Build time (<60s)

---

## Files & Directories

```
.
├── .github/
│   └── workflows/
│       └── transform-weekly.yml
├── packages/
│   ├── ingest/                 # Data ingestion
│   ├── transform/              # Data transformation
│   │   ├── src/
│   │   │   ├── loaders/        # threatened, invasive, UCs
│   │   │   ├── enrichment/     # Coordinator
│   │   │   ├── alerts.ts       # Monitoring
│   │   │   └── rollback.ts     # Disaster recovery
│   │   └── package.json
│   └── web/                    # Astro application
│       ├── src/
│       │   ├── pages/
│       │   │   ├── index.astro # Dashboard
│       │   │   ├── chat.astro  # ChatBB
│       │   │   └── api/        # API routes
│       │   ├── components/     # React components
│       │   ├── lib/            # Utilities
│       │   │   ├── claude-client.ts
│       │   │   ├── mcp-adapter.ts
│       │   │   ├── data-version.ts
│       │   │   ├── api-validation.ts
│       │   │   ├── api-errors.ts
│       │   │   ├── pagination.ts
│       │   │   └── swagger-config.ts
│       │   └── types/          # TypeScript types
│       └── astro.config.mjs
├── specs/main/
│   ├── spec.md                 # Feature specification
│   ├── plan.md                 # Implementation plan
│   ├── tasks.md                # Task breakdown
│   ├── research.md             # Technical research
│   ├── data-model.md           # Entity definitions
│   ├── quickstart.md           # Setup guide
│   └── contracts/              # API specifications
├── ARCHITECTURE.md             # This file
├── CHANGELOG.md                # Version history
├── package.json                # Root dependencies
└── README.md                   # Project overview
```

---

## Development Workflow

### Adding a Feature

1. Create branch or commit to main (per instructions)
2. Implement in appropriate package (web, transform, ingest)
3. Add tests/validation
4. Run type checks: `bun run typecheck`
5. Format: `bun run format`
6. Commit with semantic message

### Running Tests

```bash
bun run test:web
bun run test:transform
bun run test:ingest
```

### Local Development

```bash
# Start Dashboard + API
bun run web:dev

# Watch transformation
bun run transform:watch

# Manual transformation
bun run transform:execute
```

---

## Future Enhancements

### Phase 2 (Planned)

- Streaming chat responses (SSE)
- Advanced search with facets
- Map visualization integration
- User accounts & preferences
- Performance optimization (caching, indexing)

### Phase 3 (Planned)

- Mobile app (iOS/Android)
- Real-time data synchronization
- Advanced analytics dashboard
- Community contributions
- Multi-language support

---

## Support & Documentation

- **Development**: See `packages/*/README.md`
- **Deployment**: See `DEPLOYMENT.md`
- **API Docs**: Visit `http://localhost:4321/api/docs` (Swagger)
- **Setup**: See `specs/main/quickstart.md`
- **Issues**: GitHub Issues with detailed context

---

**Status**: ✅ MVP Complete (Phases 1-7 implemented)
**Next Step**: Phase 8 cleanup (in progress) → Production Ready
