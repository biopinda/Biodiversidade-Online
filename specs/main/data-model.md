# Data Model: ChatBB v5.1

**Date**: 2025-12-21
**Scope**: Entity definitions, relationships, and validation rules

---

## Entity Overview

```
Taxa ─┬─→ ThreatStatus
      ├─→ InvasiveStatus
      ├─→ ConservationUnit (via geographic association)
      └─→ Occurrence* (1 taxa → many occurrences)

Occurrence ─┬─→ Taxa (via taxonID)
            ├─→ ThreatStatus (via taxa link)
            ├─→ ConservationUnit (via geographic intersection)
            └─→ ChatSession (context reference)
```

---

## Core Entities

### 1. Taxa

**Description**: Scientific classification and status information for species, genera, families, etc.

**MongoDB Collection**: `taxa`

**Fields**:

| Field                          | Type     | Required | Indexed | Description                           |
| ------------------------------ | -------- | -------- | ------- | ------------------------------------- |
| `_id`                          | ObjectId | Yes      | Yes     | Unique MongoDB identifier             |
| `scientificName`               | String   | Yes      | Yes     | ICBN/ICZN compliant name              |
| `kingdom`                      | String   | No       | Yes     | Taxonomic kingdom                     |
| `phylum`                       | String   | No       | No      | Taxonomic phylum                      |
| `class`                        | String   | No       | No      | Taxonomic class                       |
| `order`                        | String   | No       | No      | Taxonomic order                       |
| `family`                       | String   | No       | Yes     | Taxonomic family                      |
| `genus`                        | String   | No       | Yes     | Taxonomic genus                       |
| `species`                      | String   | No       | No      | Specific epithet                      |
| `commonName`                   | String   | No       | No      | Vernacular name (Portuguese)          |
| `threatStatus`                 | String   | No       | Yes     | See ThreatStatus entity               |
| `invasiveStatus`               | String   | No       | Yes     | See InvasiveStatus entity             |
| `conservationUnitAssociations` | Array    | No       | No      | List of UC IDs                        |
| `occurrenceCount`              | Number   | No       | Yes     | Cached count of occurrences           |
| `lastUpdated`                  | Date     | Yes      | Yes     | Timestamp of last modification        |
| `dataSource`                   | String   | No       | No      | Origin source (IPT, literature, etc.) |
| `externalReferences`           | Object   | No       | No      | GBIF ID, Flora/Funga ID, etc.         |

**Indexes**:

```javascript
db.taxa.createIndex({ scientificName: 1 })
db.taxa.createIndex({ family: 1 })
db.taxa.createIndex({ genus: 1 })
db.taxa.createIndex({ threatStatus: 1 })
db.taxa.createIndex({ invasiveStatus: 1 })
db.taxa.createIndex({ lastUpdated: 1 })
db.taxa.createIndex({ kingdom: 1, phylum: 1, class: 1 })
```

**Validation Rules**:

- `scientificName` must be non-empty string
- `kingdom` must be one of: Animalia, Plantae, Fungi, Protista, Monera
- `threatStatus` if present, must reference valid ThreatStatus document
- `lastUpdated` must be valid ISO 8601 date

**Example Document**:

```json
{
  "_id": ObjectId("65f89a1c2d3e4f5g6h7i8j9k"),
  "scientificName": "Ara macao (Linnaeus, 1758)",
  "kingdom": "Animalia",
  "phylum": "Chordata",
  "class": "Aves",
  "order": "Psittaciformes",
  "family": "Psittacidae",
  "genus": "Ara",
  "species": "macao",
  "commonName": "Arara-vermelha-grande",
  "threatStatus": "least-concern",
  "invasiveStatus": "native",
  "occurrenceCount": 1243,
  "lastUpdated": "2025-12-21T10:00:00Z",
  "dataSource": "SiBBr/GBIF",
  "externalReferences": {
    "gbifKey": 2476300,
    "floraFungaId": 12345
  }
}
```

---

### 2. Occurrence

**Description**: Individual organism observation or collection records

**MongoDB Collection**: `occurrences`

**Fields**:

| Field              | Type     | Required | Indexed | Description                       |
| ------------------ | -------- | -------- | ------- | --------------------------------- |
| `_id`              | ObjectId | Yes      | Yes     | Unique MongoDB identifier         |
| `taxonID`          | String   | No       | Yes     | Reference to Taxa.\_id            |
| `scientificName`   | String   | No       | Yes     | For denormalization               |
| `decimalLatitude`  | Number   | Yes      | Yes     | WGS84 latitude                    |
| `decimalLongitude` | Number   | Yes      | Yes     | WGS84 longitude                   |
| `geometry`         | Object   | No       | Yes     | GeoJSON Point for spatial queries |
| `eventDate`        | String   | No       | No      | ISO 8601 or DwC format            |
| `eventYear`        | Number   | No       | Yes     | Extracted year for filtering      |
| `basisOfRecord`    | String   | No       | No      | PreservedSpecimen, Observation... |
| `country`          | String   | No       | No      | Country name or code              |
| `countryCode`      | String   | No       | Yes     | ISO 3166 2-letter code            |
| `stateProvince`    | String   | No       | Yes     | State/province/region             |
| `stateCode`        | String   | No       | Yes     | IBGE state code (27 + 2 digits)   |
| `county`           | String   | No       | No      | County/municipality               |
| `municipality`     | String   | No       | No      | Municipality name                 |
| `threatStatus`     | String   | No       | Yes     | Denormalized from Taxa            |
| `invasiveStatus`   | String   | No       | Yes     | Denormalized from Taxa            |
| `conservationUnit` | String   | No       | Yes     | Name of associated UC             |
| `collectionCode`   | String   | No       | No      | Herbarium/museum code             |
| `lastUpdated`      | Date     | Yes      | Yes     | Timestamp of last modification    |
| `dataSource`       | String   | No       | No      | IPT repository URL or source      |

**Critical Attributes** (for biodiversity domain):

- `scientificName` - Required for species identification
- `decimalLatitude`, `decimalLongitude` - Required for spatial analysis, MUST be within Brazil
- `eventDate` - Required for temporal analysis
- `basisOfRecord` - Quality indicator

**Indexes**:

```javascript
db.occurrences.createIndex({ taxonID: 1 })
db.occurrences.createIndex({ decimalLatitude: 1, decimalLongitude: 1 })
db.occurrences.createIndex({ geometry: '2dsphere' })
db.occurrences.createIndex({ eventYear: 1 })
db.occurrences.createIndex({ stateCode: 1 })
db.occurrences.createIndex({ threatStatus: 1 })
db.occurrences.createIndex({ conservationUnit: 1 })
db.occurrences.createIndex({ dataSource: 1 })
```

**Validation Rules**:

- `decimalLatitude` must be between -33.8 and 5.3 (Brazil bounds)
- `decimalLongitude` must be between -73.9 and -34.9 (Brazil bounds)
- `geometry` must follow GeoJSON Point format if present
- `eventDate` if present, must be valid date format
- `stateCode` if provided, must match Brazil IBGE codes (01-28)

**Example Document**:

```json
{
  "_id": ObjectId("65f89a1c2d3e4f5g6h7i8j9k"),
  "taxonID": "ObjectId(...)",
  "scientificName": "Ara macao (Linnaeus, 1758)",
  "decimalLatitude": -3.5,
  "decimalLongitude": -62.2,
  "geometry": {
    "type": "Point",
    "coordinates": [-62.2, -3.5]
  },
  "eventDate": "2023-06-15",
  "eventYear": 2023,
  "basisOfRecord": "HumanObservation",
  "country": "Brazil",
  "countryCode": "BR",
  "stateProvince": "Amazonas",
  "stateCode": "13",
  "municipality": "Manaus",
  "threatStatus": "least-concern",
  "invasiveStatus": "native",
  "conservationUnit": "Reserva Biológica do Cuieiras",
  "collectionCode": "AMAZ:AVES",
  "lastUpdated": "2025-12-20T08:00:00Z",
  "dataSource": "http://ipt.sibbr.gov.br/..."
}
```

---

### 3. ThreatStatus

**Description**: Conservation threat assessment and protection information

**MongoDB Collection**: `threatened_species`

**Fields**:

| Field              | Type     | Required | Description                    |
| ------------------ | -------- | -------- | ------------------------------ |
| `_id`              | ObjectId | Yes      | Unique identifier              |
| `taxonID`          | String   | Yes      | Reference to Taxa.\_id         |
| `scientificName`   | String   | Yes      | For denormalization            |
| `threatLevel`      | String   | Yes      | IUCN category (see below)      |
| `protectionStatus` | String   | No       | e.g., "Legally protected"      |
| `recoveryStatus`   | String   | No       | e.g., "In recovery", "Stable"  |
| `assessmentDate`   | Date     | No       | When assessment was made       |
| `source`           | String   | Yes      | Flora/Funga Brasil, IUCN, etc. |
| `lastUpdated`      | Date     | Yes      | Timestamp                      |

**Threat Levels** (IUCN Red List):

- `extinct` - EX
- `critically-endangered` - CR
- `endangered` - EN
- `vulnerable` - VU
- `near-threatened` - NT
- `least-concern` - LC
- `data-deficient` - DD

---

### 4. InvasiveStatus

**Description**: Invasive species information and ecological impact

**MongoDB Collection**: `invasive_species`

**Fields**:

| Field               | Type     | Required | Description                      |
| ------------------- | -------- | -------- | -------------------------------- |
| `_id`               | ObjectId | Yes      | Unique identifier                |
| `taxonID`           | String   | Yes      | Reference to Taxa.\_id           |
| `scientificName`    | String   | Yes      | For denormalization              |
| `geographicOrigin`  | String   | No       | Biogeographic origin             |
| `ecosystemImpact`   | String   | No       | e.g., "Predation", "Competition" |
| `invasivenessLevel` | String   | No       | `high`, `medium`, `low`          |
| `affectedBiomes`    | Array    | No       | List of biome names              |
| `source`            | String   | Yes      | IBAMA, scientific literature     |
| `assessmentDate`    | Date     | No       | Assessment date                  |
| `lastUpdated`       | Date     | Yes      | Timestamp                        |

---

### 5. ConservationUnit

**Description**: Protected areas and conservation initiatives (UC)

**MongoDB Collection**: `conservation_units`

**Fields**:

| Field              | Type     | Required | Indexed | Description                      |
| ------------------ | -------- | -------- | ------- | -------------------------------- |
| `_id`              | ObjectId | Yes      | Yes     | Unique identifier                |
| `name`             | String   | Yes      | Yes     | UC official name                 |
| `designationType`  | String   | Yes      | Yes     | e.g., "National Park", "Reserve" |
| `managementStatus` | String   | No       | No      | e.g., "Active", "Proposed"       |
| `geometry`         | GeoJSON  | No       | Yes     | Polygon or MultiPolygon          |
| `area`             | Number   | No       | No      | Area in km²                      |
| `jurisdiction`     | String   | No       | No      | Federal, State, Municipal        |
| `jurisdictionCode` | String   | No       | Yes     | IBGE or ICMBio code              |
| `managingAgency`   | String   | No       | No      | ICMBio, state agency, etc.       |
| `creationDate`     | Date     | No       | No      | When established                 |
| `lastUpdated`      | Date     | Yes      | Yes     | Timestamp                        |

**Indexes**:

```javascript
db.conservation_units.createIndex({ geometry: '2dsphere' })
db.conservation_units.createIndex({ jurisdictionCode: 1 })
db.conservation_units.createIndex({ designationType: 1 })
```

---

### 6. ChatSession

**Description**: Conversation history for ChatBB

**MongoDB Collection**: `chat_sessions`

**Fields**:

| Field       | Type     | Required | Description              |
| ----------- | -------- | -------- | ------------------------ |
| `_id`       | ObjectId | Yes      | Unique session ID        |
| `userId`    | String   | No       | Anonymous user ID (UUID) |
| `messages`  | Array    | Yes      | Array of ChatMessage     |
| `createdAt` | Date     | Yes      | Session creation time    |
| `updatedAt` | Date     | Yes      | Last activity time       |
| `expiresAt` | Date     | Yes      | TTL index (7 days)       |

**ChatMessage Object**:

```json
{
  "role": "user" | "assistant",
  "content": "text content",
  "dataSources": ["taxa API", "occurrences API"],
  "timestamp": "2025-12-21T10:00:00Z"
}
```

**Indexes**:

```javascript
db.chat_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
db.chat_sessions.createIndex({ userId: 1 })
```

---

### 7. Transformation Metadata

**MongoDB Collection**: `process_metrics`

**Fields**:

| Field              | Type     | Required | Description                      |
| ------------------ | -------- | -------- | -------------------------------- |
| `_id`              | ObjectId | Yes      | Unique identifier                |
| `processName`      | String   | Yes      | e.g., "taxa_enrich"              |
| `startTime`        | Date     | Yes      | Process start timestamp          |
| `endTime`          | Date     | No       | Process end timestamp            |
| `status`           | String   | Yes      | `running`, `success`, `failed`   |
| `recordsProcessed` | Number   | No       | Count of processed records       |
| `recordsError`     | Number   | No       | Count of error records           |
| `duration`         | Number   | No       | Execution time in ms             |
| `dataVersion`      | String   | Yes      | Semantic version (e.g., "5.1.0") |
| `errorLog`         | String   | No       | Error details                    |

---

## Relationships & Join Patterns

### Taxa → Occurrences

- **Type**: One-to-Many
- **Join**: Via `taxonID` field in Occurrence
- **Query Pattern**:
  ```javascript
  db.occurrences.aggregate([
    { $match: { taxonID: ObjectId('...') } },
    {
      $lookup: {
        from: 'taxa',
        localField: 'taxonID',
        foreignField: '_id',
        as: 'taxa'
      }
    }
  ])
  ```

### Taxa → ThreatStatus

- **Type**: One-to-One
- **Join**: Via `taxonID` field in ThreatStatus
- **Denormalization**: threatStatus field in both Taxa and Occurrence

### Taxa → InvasiveStatus

- **Type**: One-to-One
- **Join**: Via `taxonID` field in InvasiveStatus
- **Denormalization**: invasiveStatus field in both Taxa and Occurrence

### Occurrence → ConservationUnit

- **Type**: Many-to-Many
- **Join**: Spatial intersection (point in polygon)
- **Query Pattern**:
  ```javascript
  db.conservation_units.findOne({
    geometry: { $geoIntersects: { $geometry: occurrenceGeometry } }
  })
  ```

---

## Data Quality Constraints

### Spatial Quality

- All occurrences MUST have valid coordinates within Brazil
- Coordinates must not be at country centroids (filter out uncertainty centers)
- Coordinates must match declared state/province

### Temporal Quality

- eventDate must be valid ISO 8601 or DwC format
- eventDate must not be in the future
- eventDate should be within 5 years for relevance filtering

### Taxonomic Quality

- scientificName must follow ICBN/ICZN conventions
- Family, Genus, Species must be consistent with current taxonomy
- Avoid common names in scientificName field

---

## Critical Attributes Summary

**For Dashboard Filters**:

- `Taxa.threatStatus`, `Taxa.invasiveStatus`, `Occurrence.stateCode`

**For API Queries**:

- `Occurrence.taxonID`, `Occurrence.decimalLatitude`, `Occurrence.decimalLongitude`
- `Taxa.scientificName`, `Taxa.family`, `Taxa.kingdom`

**For ChatBB Context**:

- `Taxa.scientificName`, `Occurrence.stateProvince`, `ConservationUnit.name`
- `ThreatStatus.threatLevel`, `InvasiveStatus.ecosystemImpact`

---

**Status**: Data model complete, ready for API contract definitions
