# Transform Orchestrator - Visual Architecture

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Transform Handler                           │
│  (transformTaxa.ts / transformOccurrences.ts)                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Reads raw documents from MongoDB
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Pipeline Orchestrator                          │
│              (lib/orchestrator.ts)                              │
│                                                                 │
│  executeTransformPipeline(pipeline, rawDocument)                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Executes steps sequentially
                     │
                     ▼
        ┌────────────────────────────┐
        │  Step 1: validate-and-clone │
        └─────────────┬──────────────┘
                     │ ✓ Pass document to next step
                     ▼
        ┌────────────────────────────┐
        │  Step 2: filter-by-rank    │
        └─────────────┬──────────────┘
                     │ ✓ Pass document to next step
                     ▼
        ┌────────────────────────────┐
        │  Step 3: build-canonical   │
        └─────────────┬──────────────┘
                     │ ✓ Pass document to next step
                     ▼
        ┌────────────────────────────┐
        │  Step 4: normalize-kingdom │
        └─────────────┬──────────────┘
                     │ ✓ Pass document to next step
                     ▼
                   ...
                     │
                     ▼
        ┌────────────────────────────┐
        │  Step N: final-transform   │
        └─────────────┬──────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Transform Result                              │
│                                                                 │
│  {                                                              │
│    success: true,                                               │
│    document: { ...normalized... },                              │
│    failedAt: undefined,                                         │
│    error: undefined                                             │
│  }                                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Write to target collection
                     ▼
              [MongoDB: taxa / occurrences]
```

## Failure Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                  Pipeline Orchestrator                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Step 1: validate-and-clone │
        └─────────────┬──────────────┘
                     │ ✓
                     ▼
        ┌────────────────────────────┐
        │  Step 2: filter-by-rank    │
        └─────────────┬──────────────┘
                     │ ✗ returns null
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Transform Result                              │
│                                                                 │
│  {                                                              │
│    success: false,                                              │
│    document: null,                                              │
│    failedAt: "filter-by-rank",  ← Exact step identified        │
│    error: undefined                                             │
│  }                                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Log error with step name
                     ▼
        metrics.addError('normalization:filter-by-rank')
```

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: CLI & Registration                                    │
│  - runTransform.ts                                              │
│  - transformTaxa.ts, transformOccurrences.ts                    │
│  - register.ts                                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Transform Handlers                                    │
│  - taxa/transformTaxa.ts                                        │
│  - occurrences/transformOccurrences.ts                          │
│  - Enrichment (enrichTaxon, enrichOccurrence)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Pipeline Orchestrator                                 │
│  - lib/orchestrator.ts                                          │
│    • executeTransformPipeline()                                 │
│    • createTransformPipeline()                                  │
│    • createTransformStep()                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Pipelines                                             │
│  - taxa/transforms/pipeline.ts                                  │
│  - occurrences/transforms/pipeline.ts                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Composes
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: Atomic Transform Functions                            │
│  - taxa/transforms/index.ts (11 functions)                      │
│  - occurrences/transforms/index.ts (12 functions)               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Example (Taxa)

```
Raw Document:
{
  _id: "123",
  taxonRank: "ESPECIE",
  kingdom: "Plantae",
  genus: "Araucaria",
  specificEpithet: "angustifolia"
}

        │
        ▼ Step 1: validate-and-clone

{
  _id: "123",
  taxonRank: "ESPECIE",
  kingdom: "Plantae",
  genus: "Araucaria",
  specificEpithet: "angustifolia"
}

        │
        ▼ Step 2: filter-by-rank

(rank is "ESPECIE" → in whitelist → pass)

        │
        ▼ Step 3: build-canonical-name

{
  ...
  canonicalName: "Araucaria angustifolia"
}

        │
        ▼ Step 4: build-flat-scientific-name

{
  ...
  flatScientificName: "araucariaangustifolia"
}

        │
        ▼ ... more steps ...
        │
        ▼ Final Result

Normalized Document:
{
  _id: "123",
  taxonRank: "ESPECIE",
  kingdom: "Plantae",
  genus: "Araucaria",
  specificEpithet: "angustifolia",
  canonicalName: "Araucaria angustifolia",
  flatScientificName: "araucariaangustifolia",
  higherClassification: "...",
  vernacularname: [...],
  distribution: {...}
}
```

## Key Design Principles

### 1. Pure Functions

Each atomic transform is a pure function:

- Same input → Same output
- No side effects
- No external dependencies
- Independently testable

### 2. Sequential Execution

Steps execute in order:

- Each step receives output of previous step
- Early exit on failure (for required steps)
- Continue on null (for optional steps)

### 3. Error Transparency

Detailed error information:

- Step name where failure occurred
- Error object if exception thrown
- Success/failure status
- Final document state

### 4. Composability

Transforms can be:

- Reordered in pipeline
- Shared across pipelines
- Combined into larger transforms
- Used independently

### 5. Single Responsibility

Each transform does one thing:

- validateAndClone: Validate + clone
- buildCanonicalName: Build name only
- normalizeKingdom: Normalize kingdom only
- No mixing of concerns

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────┐
│  Single-Pass Processing                                         │
│                                                                 │
│  Raw Document                                                   │
│       │                                                         │
│       ├─▶ Transform 1 ────▶ (modified doc)                      │
│       │                          │                              │
│       ├─▶ Transform 2 ◀──────────┘                              │
│       │        │                                                │
│       ├─▶ Transform 3 ◀─────┘                                   │
│       │        │                                                │
│       └─▶ ... Final                                             │
│                                                                 │
│  No backtracking, no re-processing, linear flow                 │
└─────────────────────────────────────────────────────────────────┘

Time Complexity: O(n) where n = number of steps
Space Complexity: O(1) - single document, mutated in place
```

## Comparison: Before vs After

### Before (Monolithic)

```
normalizeTaxon(raw)
  ├─ validate (lines 1-10)
  ├─ clone (lines 11-15)
  ├─ filter rank (lines 16-20)
  ├─ build names (lines 21-40)
  ├─ normalize kingdom (lines 41-50)
  ├─ vernacular (lines 51-70)
  ├─ distribution (lines 71-120)
  ├─ species profile (lines 121-140)
  ├─ resource relation (lines 141-160)
  └─ return (lines 161-165)

Total: 300+ lines in one function
Testing: Test entire function or nothing
Debugging: console.log everywhere
Errors: "normalization failed" (no detail)
```

### After (Atomic + Orchestrator)

```
Pipeline: taxa-normalization
  ├─ Step 1: validate-and-clone (function: 8 lines)
  ├─ Step 2: filter-by-taxon-rank (function: 6 lines)
  ├─ Step 3: build-canonical-name (function: 15 lines)
  ├─ Step 4: build-flat-scientific-name (function: 12 lines)
  ├─ Step 5: normalize-higher-classification (function: 8 lines)
  ├─ Step 6: normalize-kingdom (function: 12 lines)
  ├─ Step 7: normalize-vernacular-names (function: 28 lines)
  ├─ Step 8: extract-distribution (function: 18 lines)
  ├─ Step 9: normalize-species-profile (function: 18 lines)
  ├─ Step 10: convert-resource-relationship (function: 30 lines)
  └─ Step 11: force-animalia-kingdom (function: 6 lines)

Total: 11 small functions (~15 lines each)
Testing: Test each function independently
Debugging: Know exact step that failed
Errors: "normalization:filter-by-taxon-rank" (exact step)
```
