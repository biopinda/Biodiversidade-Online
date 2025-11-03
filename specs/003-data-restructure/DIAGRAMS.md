# Architecture Diagrams

## Package Dependency Graph

```mermaid
graph TD
    A[packages/web<br/>Astro.js] --> B[MongoDB Collections]
    B --> C[taxa_ipt<br/>raw]
    B --> D[taxa<br/>transformed]
    B --> E[occurrences_ipt<br/>raw]
    B --> F[occurrences<br/>transformed]

    G[packages/ingest] --> H[flora.ts]
    G --> I[fauna.ts]
    G --> J[ocorrencia.ts]

    H --> K[transformTaxonRecord]
    I --> K
    J --> L[transformOccurrenceRecord]

    G --> M[packages/shared]
    N[packages/transform] --> M

    N --> K
    N --> L
    N --> O[transformTaxa.ts<br/>bulk CLI]
    N --> P[transformOccurrences.ts<br/>bulk CLI]

    M --> Q[deterministic-id.ts]
    M --> R[database.ts]
    M --> S[collections.ts]
    M --> T[metrics.ts]

    classDef package fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef collection fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef function fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px

    class A,G,M,N package
    class C,D,E,F collection
    class K,L,O,P function
```

## Data Flow: Integrated Ingestion

```mermaid
flowchart TD
    A[1. Download DwC-A from IPT<br/>e.g., https://ipt.jbrj.gov.br/.../flora_brasil] --> B[2. Extract and parse DwC-A<br/>- Extract ZIP<br/>- Parse meta.xml<br/>- Parse taxon.txt/occurrence.txt]

    B --> C[3. For each record]

    C --> D[3a. Generate deterministic _id<br/>using shared/utils/deterministic-id.ts<br/>taxa: _id = taxonID<br/>occur: _id = occurrenceID::iptId]

    D --> E[3b. Upsert RAW document to MongoDB<br/>db.taxa_ipt.updateOne({_id}, {$set: rawDoc})<br/>OR<br/>db.occurrences_ipt.updateOne(...)]

    E --> F[3c. TRANSFORM inline, same process<br/>import transformTaxonRecord from '@darwincore/transform'<br/><br/>const transformed = await transformTaxonRecord(rawDoc, db)<br/><br/>Applies:<br/>- Normalization canonicalName, etc.<br/>- Enrichment ameaça, invasoras, UCs<br/>- Filters taxonRank, country, etc.]

    F --> G[3d. Upsert TRANSFORMED document to MongoDB<br/>SAME _id as raw<br/>db.taxa.updateOne({_id}, {$set: transformed})<br/>OR<br/>db.occurrences.updateOne(...)]

    G --> H[Both collections updated in sync<br/>taxa_ipt ✓<br/>taxa ✓]

    classDef step fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef action fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef result fill:#e8f5e8,stroke:#388e3c,stroke-width:2px

    class A,B,C step
    class D,E,F,G action
    class H result
```

## Data Flow: Bulk Re-transformation

```mermaid
flowchart TD
    A[Trigger:<br/>- Version bump in packages/transform/package.json<br/>- Changes to packages/transform/src/**<br/>- Manual workflow_dispatch] --> B[1. Acquire lock<br/>MongoDB transform_status collection<br/>Prevents concurrent runs]

    B --> C[2. Read ALL documents from raw collection batched<br/>db.taxa_ipt.find()<br/>OR<br/>db.occurrences_ipt.find()]

    C --> D[3. For each batch]

    D --> E[3a. Transform each record<br/>const transformed = await transformTaxonRecord(rawDoc, db)<br/><br/>Uses SAME transformation logic as ingest]

    E --> F[3b. Bulk upsert to transformed collection<br/>db.taxa.bulkWrite([<br/>{ updateOne: {<br/>filter: { _id: doc._id },<br/>update: { $set: transformed },<br/>upsert: true<br/>}} ])]

    F --> G[3c. Record metrics<br/>- Records processed<br/>- Duration<br/>- Error rate]

    G --> H[4. Release lock<br/>Update transform_status collection]

    H --> I[All transformed data refreshed from raw data]

    classDef trigger fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef step fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef action fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef result fill:#e8f5e8,stroke:#388e3c,stroke-width:2px

    class A trigger
    class B,C,D step
    class E,F,G,H action
    class I result
```

## Workflow Execution Comparison

### OLD Architecture (v1)

```mermaid
flowchart TD
    A[Scheduled Cron or Manual] --> B[Workflow: update-mongodb-flora]

    B --> C[Job: ingest<br/>- Download DwC-A<br/>- Insert to taxa_ipt]

    C --> D[Workflow: transform-taxa<br/>workflow chaining]

    D --> E[Job: transform<br/>- Read taxa_ipt<br/>- Transform<br/>- Insert to taxa]

    classDef trigger fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef workflow fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef job fill:#e3f2fd,stroke:#1976d2,stroke-width:2px

    class A trigger
    class B,D workflow
    class C,E job
```

### NEW Architecture (v2)

```mermaid
flowchart TD
    A[Scheduled Cron or Manual] --> B[Workflow: update-mongodb-flora]

    B --> C[Job: ingest<br/>- Download DwC-A<br/>- Insert to taxa_ipt<br/>- Transform inline<br/>- Insert to taxa]

    C --> D[Total time: ~1x single job]

    E[Version Bump or Manual] --> F[Workflow: transform-taxa]

    F --> G[Job: retransform<br/>- Read ALL taxa_ipt<br/>- Re-transform ALL<br/>- Update ALL taxa]

    G --> H[Only runs when transform logic changes]

    classDef trigger fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef workflow fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef job fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef note fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class A,E trigger
    class B,F workflow
    class C,G job
    class D,H note
```

## Error Handling Flow

```mermaid
flowchart TD
    A[Processing record from DwC-A] --> B[Insert raw to *_ipt]

    B --> C[Transform record]

    C --> D{Success?}
    D -->|Yes| E[Insert to taxa or occurrences]
    D -->|No| F[Log error<br/>Continue with next record<br/>Raw preserved!]

    classDef process fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef success fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px

    class A,B,C process
    class E success
    class F error
```
