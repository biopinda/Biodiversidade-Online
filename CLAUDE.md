# Biodiversidade.Online V6.0 - Brazilian Biodiversity Platform

Biodiversidade.Online is a Brazilian biodiversity platform that integrates taxonomic data (flora, fauna), occurrence records, and enrichment data into a unified MongoDB database. The system provides access via an analytical Dashboard, a conversational AI assistant (ChatBB), and a REST API.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Environment Setup and Dependencies

- Install Node.js v20.19.4 or later: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`
- Install Bun (package manager): `curl -fsSL https://bun.sh/install | bash && export PATH="$HOME/.bun/bin:$PATH"`
- Install zip utility for data processing: `sudo apt update && sudo apt install zip`

### Core Build and Development Commands

- **NEVER CANCEL any build or test commands** - All commands complete quickly (under 30 seconds)
- Navigate to web application: `cd packages/web/`
- Install dependencies: `bun install` -- takes ~56 seconds. Set timeout to 120+ seconds.
- Build application: `bun run build` -- takes ~16 seconds. Set timeout to 60+ seconds.
- Run development server: `bun run dev` -- starts in <1 second on http://localhost:4321/.
- Run production server: `node dist/server/entry.mjs` -- NOT the bun preview command
  - These bun/node commands should only be executed within the `packages/web/` subfolder

### Data Processing Scripts (Bun)

- Navigate to repo root directory
- Run flora data update: `bun run ingest:flora [DWCA_URL]`
- Run fauna data update: `bun run ingest:fauna [DWCA_URL]`
- Run occurrence data update: `bun run ingest:occurrences`
- Load reference data (CSV → MongoDB):
  - `bun run load:fauna-ameacada -- <csv>` / `load:plantae-ameacada` / `load:fungi-ameacada`
  - `bun run load:invasoras -- <csv>`
  - `bun run load:catalogo-ucs -- <csv>`
- Run thematic enrichment (in-place):
  - `bun run enrich:ameacadas` — adds `threatStatus` to `taxa`
  - `bun run enrich:invasoras` — adds `invasiveStatus` to `taxa`
  - `bun run enrich:ucs` — adds `conservationUnits` to `occurrences`
- Re-normalization (legacy, rarely needed): `bun run transform:taxa`, `bun run transform:occurrences`
- Check locks: `bun run transform:check-lock`
- These scripts require MongoDB connection via MONGO_URI environment variable

### Web Application Commands

- Navigate to web directory: `cd packages/web/`
- Start cache cron job: `bun run start-cache-cron`
- Run dashboard cache job: `bun run cache-dashboard` (requires .env file)
- Check formatting: `bunx prettier --check src/` (will show formatting issues)
- Fix formatting: `bunx prettier --write src/` (ALWAYS run before committing)
- TypeScript compilation check: `bunx tsc --noEmit` (may show unused variable warnings)

## Database Requirements

- **CRITICAL**: Application requires MongoDB connection
- Copy `.env.example` to `.env` and configure `MONGO_URI`
- Example: `MONGO_URI=mongodb://localhost:27017/your_database_name`
- Without proper MongoDB configuration, web application will fail to start properly

## Monorepo Setup

This project uses a monorepo structure with multiple packages managed by Bun workspaces:

- **Root**: Contains shared configuration (tsconfig.json, package.json for workspace management) and catalog dependencies
- **packages/ingest**: Data acquisition - ingestion scripts for DwC-A data
- **packages/transform**: Data enrichment - reference data loaders and thematic enrichment scripts
- **packages/shared**: Shared utilities (database, IDs, metrics)
- **packages/web**: Data presentation - Astro.js web application (Dashboard, ChatBB, API)

### Package Management

- Use Bun as the primary package manager
- Root `bun.lock` manages workspace dependencies
- Root `package.json` defines shared catalog dependencies for all packages
- Each package has its own `package.json` that references catalog dependencies
- Install dependencies from root: `bun install` (manages all packages)
- Run scripts across packages using `bun run --filter <package> <script>`

### Working with Multiple Packages

- For web development: `cd packages/web/` then run commands
- For data processing: Use root commands like `bun run ingest:flora [URL]`
- For enrichment: Use root commands like `bun run enrich:ameacadas`, `bun run load:fauna-ameacada -- <csv>`
- Shared TypeScript config in root `tsconfig.base.json`
- Use catalog references in package.json for shared dependencies

## Validation and Testing

- **No automated test suite available** - manual testing required
- Always validate web application starts: Access http://localhost:4321/ after running `bun run dev`
- Check TypeScript compilation: `bunx tsc --noEmit` (may show warnings, but should not error) or `npx tsc --noEmit`
- Verify formatting: `bunx prettier --check src/` or `npx prettier --check src/`
- **MANUAL VALIDATION SCENARIOS**:
  1. **Homepage/Dashboard**: http://localhost:4321/ should load the analytical dashboard
  2. **Chat Interface**: http://localhost:4321/chat should load ChatBB AI interface
  3. **Dashboard**: http://localhost:4321/dashboard should load data visualization dashboard
  4. **API Health**: http://localhost:4321/api/health should return JSON status
  5. **Swagger API Docs**: http://localhost:4321/api/docs should load API documentation
- **Database-dependent features**: Chat, dashboard, and API require MongoDB connection
- Build succeeds and production server starts on port 4321

## Project Structure

This is a monorepo project organized by C4 architecture contexts (Acquisition + Transformation, Enrichment, Presentation):

```
/
├── .github/                 # GitHub workflows (all manual)
├── docs/                    # Historical documentation
├── packages/
│   ├── ingest/              # Acquisition: DwC-A ingestion scripts
│   │   ├── package.json     # Package dependencies (references catalog)
│   │   ├── tsconfig.json    # TypeScript config
│   │   ├── chatbb/          # ChatBB specific data
│   │   │   └── fontes/      # Source data files
│   │   ├── referencias/     # Reference data and documentation
│   │   └── src/             # Bun TypeScript scripts for data processing
│   │       ├── fauna.ts     # Fauna data ingestion
│   │       ├── flora.ts     # Flora data ingestion
│   │       ├── ocorrencia.ts# Occurrence data ingestion
│   │       └── lib/
│   │           └── dwca.ts  # Darwin Core Archive utilities
│   ├── transform/           # Enrichment: thematic enrichment of main collections
│   │   └── src/
│   │       ├── cli/         # CLI commands for orchestration
│   │       ├── enrichment/  # Thematic enrichers (ameaçadas, invasoras, UCs)
│   │       ├── loaders/     # Reference data loaders (CSV → MongoDB)
│   │       ├── taxa/        # Taxa normalization pipeline (used by ingest)
│   │       ├── occurrences/ # Occurrences normalization pipeline (used by ingest)
│   │       ├── lib/         # Infrastructure (database, locks, metrics)
│   │       └── utils/       # Utility functions (lookup engine, name normalization)
│   ├── shared/              # Shared utilities (database, IDs, metrics)
│   └── web/                 # Presentation: Astro.js web application
│       ├── astro.config.mjs # Astro configuration
│       ├── components.json  # ShadCN Component configuration
│       ├── cron-dashboard.js# Dashboard cron job
│       ├── Dockerfile       # Production container build
│       ├── package.json     # Package dependencies (references catalog)
│       ├── cache/           # Cached dashboard data
│       └── src/             # Source code
│           ├── components/  # React components
│           ├── data/        # Data utilities
│           ├── layouts/     # Astro layouts
│           ├── lib/         # Library utilities
│           ├── pages/       # Astro pages (Dashboard, ChatBB, APIs)
│           ├── prompts/     # AI prompt configurations
│           ├── scripts/     # TypeScript utilities
│           └── styles/      # Tailwind Stylesheets
├── patches/                 # Package patches
├── scripts/                 # Python utility scripts
├── bun.lock                 # Root Bun lockfile
├── tsconfig.json            # TypeScript project references
└── tsconfig.base.json       # Base TypeScript config
```

## Common Issues and Solutions

- **MongoDB connection errors**: Ensure .env file exists with valid MONGO_URI
- **Build warnings**: Large chunk size warnings are expected for Swagger UI components
- **Port conflicts**: Default port 4321 - change in astro.config.mjs if needed

## CI/CD Information

- All workflows are manual (workflow_dispatch only)
- No automatic triggers on push or schedule
- Docker builds must be triggered manually from GitHub Actions
- MongoDB update workflows must be triggered manually
- Uses self-hosted runners for data processing jobs
- Production deployment must be done manually via UNRAID interface

## Key Application Features

- AI chat interface for biodiversity queries (ChatBB)
- Interactive dashboard with data visualizations
- REST API with Swagger documentation
- Integration with Flora do Brasil, Fauna do Brasil, and occurrence databases

## Development Workflow

1. Always work in the appropriate directory for changes:
   - For web application changes: `cd packages/web/`
   - For data processing changes: `cd packages/ingest/`
   - For enrichment changes: `cd packages/transform/`
   - For shared utilities: `cd packages/shared/`
2. Run `bun install` from root after pulling changes (manages all workspace dependencies)
3. Use `bun run web:dev` for web development with hot reload
4. Use `bun run ingest:<script>` for data processing scripts (e.g., `bun run ingest:flora [URL]`)
5. Use `bun run enrich:<script>` for enrichment and `bun run load:<script>` for reference data loading
6. Check formatting with `bunx prettier --check src/` (in respective directory)
7. Build and test production: `bun run web:build && node packages/web/dist/server/entry.mjs`
8. Ensure MongoDB connection configured for full functionality testing
9. Always validate TypeScript compilation: `bunx tsc --noEmit` (from root)
10. When writing pull requests, make sure to write those in Brazilian Portuguese, as it's the repo's official language

## Performance Notes

- Web build completes in ~16 seconds with Bun
- Development server starts immediately (<1 second)
- Dependency installation takes ~56 seconds with Bun
- Production server starts in <2 seconds
- Data processing scripts timing depends on external data sources
- Prettier formatting takes ~1-2 seconds for all files
