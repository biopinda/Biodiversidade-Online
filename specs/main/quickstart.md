# Quickstart Guide: ChatBB v5.1

**Version**: 5.1.0
**Last Updated**: 2025-12-21

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Validation Scenarios](#validation-scenarios)
4. [Well-Formed Questions for ChatBB](#well-formed-questions-for-chatbb)
5. [Performance Validation](#performance-validation)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js**: v20.19.4 or higher
- **Bun**: v1.2.21 or higher (installed via `npm install -g bun`)
- **MongoDB**: Local or remote instance with connection URI
- **Claude API Key**: Valid API key from Anthropic
- **Git**: For cloning and repository management

### System Requirements

- **RAM**: Minimum 2GB (4GB recommended)
- **Disk Space**: 5GB for dependencies and database
- **Network**: For MongoDB, Anthropic API, and IPT data sources

---

## Local Setup

### 1. Clone Repository and Install Dependencies

```bash
git clone https://github.com/biodiversidade-online/platform.git
cd biodiversidade-online
bun install
```

### 2. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/biodiversidade
MONGO_DB_NAME=dwc2json

# Claude API
CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096

# Application
NODE_ENV=development
PORT=4321
```

### 3. Start MongoDB

**Option A: Local Docker Container**

```bash
docker run -d \
  -p 27017:27017 \
  -v mongo_data:/data/db \
  --name biodiversity-mongo \
  mongo:latest
```

**Option B: System MongoDB**

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu
sudo systemctl start mongodb

# Windows
net start MongoDB
```

### 4. Build Project

```bash
# Install all workspace dependencies
bun install

# Build all packages
bun run web:build

# TypeScript check
bun run typecheck
```

### 5. Start Development Server

```bash
# Start Astro dev server for packages/web
bun run web:dev
```

**Expected Output**:

```
astro dev
  ➜  Local:    http://localhost:4321/
  ➜  press h for help
```

Access application at: **http://localhost:4321/**

---

## Validation Scenarios

### Scenario 1: Dashboard Loads with Real Data

**Steps**:

1. Navigate to http://localhost:4321/
2. Verify page loads in < 2 seconds
3. Check that statistics display:
   - ✓ Total species count (e.g., "50,234 species")
   - ✓ Threatened count
   - ✓ Invasive count
4. Verify charts render (bar chart for species by type, pie chart for status)

**Pass Criteria**:

- Page loads without errors
- All statistics have numeric values > 0
- Charts display with data

---

### Scenario 2: Dashboard Filters Work Responsively

**Steps**:

1. On Dashboard, click "Type" filter dropdown
2. Select "Threatened"
3. Observe API call and chart update
4. Measure response time (should be < 1 second)
5. Repeat with "Region" filter (select a state)
6. Combine filters: Type + Region
7. Verify "Clear Filters" resets all selections

**Pass Criteria**:

- Filter UI responds immediately
- Charts update within < 1 second
- Data correctly reflects filter selection
- Clear filters works

---

### Scenario 3: REST API Returns Correct Data

**Execute curl commands**:

```bash
# Test 1: Get taxa list
curl "http://localhost:4321/api/taxa?limit=10" | jq .

# Test 2: Filter threatened species
curl "http://localhost:4321/api/taxa?conservation_status=threatened&limit=5" | jq .

# Test 3: Get occurrences as GeoJSON
curl "http://localhost:4321/api/occurrences/geojson?limit=100" | jq . | head -20

# Test 4: Get dashboard summary
curl "http://localhost:4321/api/dashboard/summary" | jq .
```

**Pass Criteria**:

- All responses are valid JSON
- HTTP status codes are 200
- Data structures match swagger-config schemas
- Response times < 500ms

---

### Scenario 4: ChatBB Conversational Interface

**Test Natural Language Queries**:

1. Navigate to http://localhost:4321/chat
2. Send first query: _"Quantas espécies ameaçadas de extinção existem no Brasil?"_
3. Verify response:
   - ✓ Claude responds with species count
   - ✓ Response appears to stream in
   - ✓ Response shows data sources cited
4. Send follow-up: _"E quantas são da Mata Atlântica?"_
5. Verify Claude understands context (previous conversation)
6. Export conversation as JSON/Markdown

**Pass Criteria**:

- Query returns answer within 5 seconds
- Claude correctly interprets domain questions
- Follow-up shows context awareness
- Export produces valid file

---

### Scenario 5: Swagger Documentation Available

**Steps**:

1. Navigate to http://localhost:4321/api/docs
2. Verify Swagger UI loads
3. Check that all endpoints documented:
   - `/api/taxa`
   - `/api/occurrences`
   - `/api/occurrences/geojson`
   - `/api/dashboard/summary`
   - `/api/chat/send`
4. Try "Try it out" on an endpoint
5. Verify request/response display

**Pass Criteria**:

- Swagger UI loads without errors
- All endpoints visible
- Example requests work
- Schemas match actual API responses

---

## Well-Formed Questions for ChatBB

ChatBB achieves 95%+ accuracy on **well-formed questions** that include:

### Criteria

A well-formed question must have:

1. **Species/Taxon Reference**: Includes common or scientific name
   - ✓ "Arara-vermelha-grande" (common name)
   - ✓ "Ara macao" (scientific name)
   - ✗ "Aves aquáticas" (too broad)

2. **Geographic Scope** (optional but preferred): State, biome, or region
   - ✓ "na Mata Atlântica"
   - ✓ "em São Paulo"
   - ✓ "no Pantanal"

3. **Specific Attribute Query**: What you want to know
   - ✓ "conservação status"
   - ✓ "Where found"
   - ✓ "threat level"

4. **Grammatically Correct**: Proper Portuguese or English
   - ✓ "Qual é o status de conservação da onça-pintada?"
   - ✗ "onça pintada status conservação?" (grammatically incorrect)

5. **Within Biodiversity Domain**: Question about species, ecology, conservation
   - ✓ "How many endangered species in the Amazon?"
   - ✗ "What is the capital of Brazil?" (not biodiversity)

### Example Well-Formed Questions

✓ **Perfect**: "Quantas espécies de aves ameaçadas existem na Mata Atlântica?"

- Has: species (aves), attribute (ameaçadas), location (Mata Atlântica)

✓ **Good**: "Qual é o status de conservação da jaguatirica?"

- Has: species (jaguatirica), attribute (status)

✓ **Acceptable**: "Invasive fish species"

- Has: attribute (invasive), species type (fish)

✗ **Poor**: "Birds"

- Missing: specific species, attribute, scope

✗ **Out of scope**: "How many birds exist globally?"

- Outside Brazil/biodiversity domain

---

## Performance Validation

### 1. Dashboard Filter Response Time

**Test**:

```javascript
// Open browser console and run:
const start = performance.now()
// Click filter dropdown
// Wait for data update
const end = performance.now()
console.log(`Response time: ${end - start}ms`)
```

**Target**: < 1000ms

**Benchmark Baseline** (v5.1):

- No filters: 200-300ms
- Single filter: 300-500ms
- Multiple filters: 500-800ms

### 2. API Endpoint Response Time

**Test**:

```bash
# Test taxa endpoint
curl -w "Total: %{time_total}s\n" \
  "http://localhost:4321/api/taxa?limit=100"

# Test occurrences endpoint
curl -w "Total: %{time_total}s\n" \
  "http://localhost:4321/api/occurrences?limit=100"
```

**Targets**:

- No filters: < 200ms
- With filters: < 500ms

### 3. ChatBB Response Time

**Test**:

```javascript
// In ChatBB page console:
const start = performance.now()
// Send message
// Wait for complete response
const end = performance.now()
console.log(`ChatBB response: ${end - start}ms`)
```

**Targets**:

- First response token: < 1000ms
- Complete response: < 5000ms

### 4. Build Time

**Test**:

```bash
bun run web:build
# Should complete in < 60 seconds
```

---

## Data Validation Checklist

After loading data, verify:

- [ ] Dashboard shows non-zero species counts
- [ ] Threatened species count > 0
- [ ] Invasive species count > 0
- [ ] Total occurrences > 1,000,000
- [ ] Filtering by state returns data
- [ ] API endpoints return valid JSON
- [ ] GeoJSON endpoint returns valid FeatureCollection
- [ ] ChatBB responds to domain queries

---

## Troubleshooting

### Issue: MongoDB Connection Failed

**Error**: `Could not connect to MongoDB`

**Solutions**:

1. Check MongoDB is running:

   ```bash
   mongosh "mongodb://localhost:27017"
   ```

2. Verify MONGO_URI in .env.local

   ```env
   MONGO_URI=mongodb://localhost:27017/biodiversidade
   ```

3. Check MongoDB logs:
   ```bash
   docker logs biodiversity-mongo  # If using Docker
   ```

### Issue: Claude API Key Invalid

**Error**: `Invalid API key` or `Unauthorized`

**Solutions**:

1. Verify key in .env.local:

   ```bash
   grep CLAUDE_API_KEY .env.local
   ```

2. Verify key format: Should start with `sk-ant-`

3. Check key hasn't expired: https://console.anthropic.com/

### Issue: Dashboard Shows "No Data"

**Steps**:

1. Check if data ingested into MongoDB:

   ```javascript
   db.taxa.countDocuments() // Should be > 0
   db.occurrences.countDocuments() // Should be > 0
   ```

2. Verify collections exist:

   ```bash
   mongosh
   > use dwc2json
   > show collections
   ```

3. Run ingest if needed:
   ```bash
   bun run ingest:occurrences
   bun run ingest:flora
   ```

### Issue: Filters Not Updating

**Steps**:

1. Open browser DevTools → Network tab
2. Click filter, check that API request fires
3. Verify response status is 200
4. Check browser console for JavaScript errors
5. Clear browser cache and reload

### Issue: Build Fails with TypeScript Errors

**Steps**:

1. Run type check:

   ```bash
   bun run typecheck
   ```

2. Fix reported errors in source files

3. Retry build:
   ```bash
   bun run web:build
   ```

---

## Next Steps

After validating setup:

1. **For Development**: Continue with Phase 3 (Dashboard enhancement)
2. **For Production**: Deploy following DEPLOYMENT.md
3. **For Data Import**: Run ingest + transform pipelines
4. **For Testing**: Run integration test suite

---

## Support

- **Documentation**: https://github.com/biodiversidade-online/platform/docs
- **Issues**: https://github.com/biodiversidade-online/platform/issues
- **Discussions**: https://github.com/biodiversidade-online/platform/discussions
