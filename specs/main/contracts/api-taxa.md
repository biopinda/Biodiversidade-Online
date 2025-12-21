# API Contract: GET /api/taxa

## Purpose
Retrieve filtered list of taxa with pagination support

## Request

### Method
`GET`

### URL
`/api/taxa`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | - | Filter by species type: `native`, `threatened`, `invasive` |
| `region` | string | No | - | Filter by state/region code (IBGE format) |
| `conservation_status` | string | No | - | Filter by conservation status: `threatened`, `near-threatened`, `least-concern` |
| `family` | string | No | - | Filter by family name |
| `limit` | integer | No | 100 | Number of results to return (max 1000) |
| `offset` | integer | No | 0 | Number of results to skip |

### Headers
```
Accept: application/json
```

## Response

### Success (200 OK)

```json
{
  "data": [
    {
      "_id": "65f89a1c2d3e4f5g6h7i8j9k",
      "scientificName": "Ara macao (Linnaeus, 1758)",
      "kingdom": "Animalia",
      "family": "Psittacidae",
      "genus": "Ara",
      "species": "macao",
      "commonName": "Arara-vermelha-grande",
      "threatStatus": "least-concern",
      "invasiveStatus": "native",
      "occurrenceCount": 1243,
      "lastUpdated": "2025-12-21T10:00:00Z"
    }
  ],
  "total": 1234,
  "limit": 100,
  "offset": 0
}
```

### Error (400 Bad Request)

**When**: Invalid query parameters

```json
{
  "status": 400,
  "message": "Invalid region code",
  "code": "INVALID_PARAMS"
}
```

### Error (500 Internal Server Error)

**When**: Database connection failure

```json
{
  "status": 500,
  "message": "Database error",
  "code": "DB_ERROR"
}
```

## Implementation Notes

1. **Performance**: Target response time < 500ms
2. **Caching**: Results cached for 1 hour
3. **Pagination**: Enforces max 1000 records per request
4. **Validation**: Query parameters validated before database query
5. **Data Sources**: Uses `taxa` collection with denormalized threat/invasive status

## Test Scenarios

### Test 1: Basic query
```bash
curl "http://localhost:4321/api/taxa?limit=10"
```
**Expected**: 10 taxa records with pagination info

### Test 2: Filter by threat status
```bash
curl "http://localhost:4321/api/taxa?conservation_status=threatened&limit=50"
```
**Expected**: Only threatened species

### Test 3: Filter by region
```bash
curl "http://localhost:4321/api/taxa?region=13&limit=20"
```
**Expected**: Only taxa from Amazonas state (code 13)

### Test 4: Invalid limit
```bash
curl "http://localhost:4321/api/taxa?limit=2000"
```
**Expected**: 400 error - limit exceeds max

## Response Time Targets

| Scenario | Target |
|----------|--------|
| No filters, limit=100 | <200ms |
| Single filter | <300ms |
| Multiple filters | <500ms |

