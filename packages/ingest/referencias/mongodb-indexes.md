# MongoDB Indexes for Original Data Preservation

## Overview

This document outlines the MongoDB indexes required for the original data preservation system. These indexes ensure optimal performance for data preservation, retrieval, and transformation operations.

## Core Collections

### 1. taxaOriginal Collection

Stores original taxonomic data from IPT sources before transformation.

**Required Indexes:**

```javascript
// Primary lookup by IPT and version
{ "iptId": 1, "ipt_version": 1 }

// Collection type filtering
{ "collection_type": 1 }

// Processing status queries
{ "processing_status.is_processed": 1 }

// Time-based queries for data management
{ "ingestion_metadata.timestamp": 1 }

// Combined index for efficient filtering
{ "collection_type": 1, "processing_status.is_processed": 1, "iptId": 1 }

// Record ID lookup for referencing
{ "ipt_record_id": 1, "iptId": 1 }
```

### 2. ocorrenciasOriginal Collection

Stores original occurrence data from IPT sources before transformation.

**Required Indexes:**

```javascript
// Primary lookup by IPT and version
{ "iptId": 1, "ipt_version": 1 }

// Collection type filtering
{ "collection_type": 1 }

// Processing status queries
{ "processing_status.is_processed": 1 }

// Time-based queries for data management
{ "ingestion_metadata.timestamp": 1 }

// Combined index for efficient filtering
{ "collection_type": 1, "processing_status.is_processed": 1, "iptId": 1 }

// Record ID lookup for referencing
{ "ipt_record_id": 1, "iptId": 1 }
```

### 3. taxa Collection (Enhanced)

Existing taxa collection with additional indexes for original data references.

**New Indexes for Preservation System:**

```javascript
// Reference to original data
{ "original_reference.original_id": 1 }

// IPT reference lookup
{ "original_reference.iptId": 1 }

// Transformation metadata queries
{ "transformation_metadata.timestamp": 1 }

// Pipeline version tracking
{ "transformation_metadata.pipeline_version": 1 }

// Fallback status queries
{ "transformation_metadata.fallback_applied": 1 }
```

### 4. ocorrencias Collection (Enhanced)

Existing occurrences collection with additional indexes for original data references.

**New Indexes for Preservation System:**

```javascript
// Reference to original data
{ "original_reference.original_id": 1 }

// IPT reference lookup
{ "original_reference.iptId": 1 }

// Transformation metadata queries
{ "transformation_metadata.timestamp": 1 }

// Pipeline version tracking
{ "transformation_metadata.pipeline_version": 1 }

// Fallback status queries
{ "transformation_metadata.fallback_applied": 1 }
```

### 5. processingLocks Collection

Manages concurrency control for data processing operations.

**Required Indexes:**

```javascript
// Primary lock lookup
{ "resource_type": 1, "is_locked": 1 }

// Lock expiration management
{ "lock_expires_at": 1 }

// Lock ownership queries
{ "locked_by": 1 }

// Lock cleanup operations
{ "is_locked": 1, "lock_expires_at": 1 }
```

### 6. ipts Collection (Enhanced)

Existing IPT tracking collection with enhanced processing control.

**New Indexes for Preservation System:**

```javascript
// Processing control queries
{ "processing_control.is_processing": 1 }

// Last ingestion tracking
{ "processing_control.last_ingestion_check": 1 }

// Version hash lookups
{ "processing_control.version_hash": 1 }

// Error tracking
{ "processing_control.last_error": 1 }

// Statistics queries
{ "statistics.fauna.total_documents": 1 }
{ "statistics.flora.total_documents": 1 }
{ "statistics.ocorrencias.total_documents": 1 }
```

## Index Creation Scripts

### MongoDB Shell Commands

```javascript
// Connect to database
use dwc2json

// taxaOriginal indexes
db.taxaOriginal.createIndex({ "iptId": 1, "ipt_version": 1 }, { name: "iptId_version" })
db.taxaOriginal.createIndex({ "collection_type": 1 }, { name: "collection_type" })
db.taxaOriginal.createIndex({ "processing_status.is_processed": 1 }, { name: "processing_status" })
db.taxaOriginal.createIndex({ "ingestion_metadata.timestamp": 1 }, { name: "ingestion_timestamp" })
db.taxaOriginal.createIndex({
  "collection_type": 1,
  "processing_status.is_processed": 1,
  "iptId": 1
}, { name: "collection_processing_ipt" })
db.taxaOriginal.createIndex({ "ipt_record_id": 1, "iptId": 1 }, { name: "record_lookup" })

// ocorrenciasOriginal indexes
db.ocorrenciasOriginal.createIndex({ "iptId": 1, "ipt_version": 1 }, { name: "iptId_version" })
db.ocorrenciasOriginal.createIndex({ "collection_type": 1 }, { name: "collection_type" })
db.ocorrenciasOriginal.createIndex({ "processing_status.is_processed": 1 }, { name: "processing_status" })
db.ocorrenciasOriginal.createIndex({ "ingestion_metadata.timestamp": 1 }, { name: "ingestion_timestamp" })
db.ocorrenciasOriginal.createIndex({
  "collection_type": 1,
  "processing_status.is_processed": 1,
  "iptId": 1
}, { name: "collection_processing_ipt" })
db.ocorrenciasOriginal.createIndex({ "ipt_record_id": 1, "iptId": 1 }, { name: "record_lookup" })

// Enhanced taxa indexes
db.taxa.createIndex({ "original_reference.original_id": 1 }, { name: "original_reference" })
db.taxa.createIndex({ "original_reference.iptId": 1 }, { name: "original_ipt_reference" })
db.taxa.createIndex({ "transformation_metadata.timestamp": 1 }, { name: "transform_timestamp" })
db.taxa.createIndex({ "transformation_metadata.pipeline_version": 1 }, { name: "pipeline_version" })
db.taxa.createIndex({ "transformation_metadata.fallback_applied": 1 }, { name: "fallback_status" })

// Enhanced ocorrencias indexes
db.ocorrencias.createIndex({ "original_reference.original_id": 1 }, { name: "original_reference" })
db.ocorrencias.createIndex({ "original_reference.iptId": 1 }, { name: "original_ipt_reference" })
db.ocorrencias.createIndex({ "transformation_metadata.timestamp": 1 }, { name: "transform_timestamp" })
db.ocorrencias.createIndex({ "transformation_metadata.pipeline_version": 1 }, { name: "pipeline_version" })
db.ocorrencias.createIndex({ "transformation_metadata.fallback_applied": 1 }, { name: "fallback_status" })

// processingLocks indexes
db.processingLocks.createIndex({ "resource_type": 1, "is_locked": 1 }, { name: "resource_lock_status" })
db.processingLocks.createIndex({ "lock_expires_at": 1 }, { name: "lock_expiration" })
db.processingLocks.createIndex({ "locked_by": 1 }, { name: "lock_owner" })
db.processingLocks.createIndex({ "is_locked": 1, "lock_expires_at": 1 }, { name: "cleanup_query" })

// Enhanced ipts indexes
db.ipts.createIndex({ "processing_control.is_processing": 1 }, { name: "processing_status" })
db.ipts.createIndex({ "processing_control.last_ingestion_check": 1 }, { name: "last_check" })
db.ipts.createIndex({ "processing_control.version_hash": 1 }, { name: "version_hash" })
db.ipts.createIndex({ "processing_control.last_error": 1 }, { name: "error_tracking" })
```

### TypeScript Index Creation Function

```typescript
import { MongoClient, Db } from 'mongodb'

export async function createPreservationIndexes(db: Db): Promise<void> {
  console.log('Creating preservation system indexes...')

  // taxaOriginal indexes
  await db.collection('taxaOriginal').createIndexes([
    { key: { iptId: 1, ipt_version: 1 }, name: 'iptId_version' },
    { key: { collection_type: 1 }, name: 'collection_type' },
    { key: { 'processing_status.is_processed': 1 }, name: 'processing_status' },
    { key: { 'ingestion_metadata.timestamp': 1 }, name: 'ingestion_timestamp' },
    {
      key: {
        collection_type: 1,
        'processing_status.is_processed': 1,
        iptId: 1
      },
      name: 'collection_processing_ipt'
    },
    { key: { ipt_record_id: 1, iptId: 1 }, name: 'record_lookup' }
  ])

  // ocorrenciasOriginal indexes
  await db.collection('ocorrenciasOriginal').createIndexes([
    { key: { iptId: 1, ipt_version: 1 }, name: 'iptId_version' },
    { key: { collection_type: 1 }, name: 'collection_type' },
    { key: { 'processing_status.is_processed': 1 }, name: 'processing_status' },
    { key: { 'ingestion_metadata.timestamp': 1 }, name: 'ingestion_timestamp' },
    {
      key: {
        collection_type: 1,
        'processing_status.is_processed': 1,
        iptId: 1
      },
      name: 'collection_processing_ipt'
    },
    { key: { ipt_record_id: 1, iptId: 1 }, name: 'record_lookup' }
  ])

  // Enhanced taxa indexes
  await db.collection('taxa').createIndexes([
    {
      key: { 'original_reference.original_id': 1 },
      name: 'original_reference'
    },
    { key: { 'original_reference.iptId': 1 }, name: 'original_ipt_reference' },
    {
      key: { 'transformation_metadata.timestamp': 1 },
      name: 'transform_timestamp'
    },
    {
      key: { 'transformation_metadata.pipeline_version': 1 },
      name: 'pipeline_version'
    },
    {
      key: { 'transformation_metadata.fallback_applied': 1 },
      name: 'fallback_status'
    }
  ])

  // Enhanced ocorrencias indexes
  await db.collection('ocorrencias').createIndexes([
    {
      key: { 'original_reference.original_id': 1 },
      name: 'original_reference'
    },
    { key: { 'original_reference.iptId': 1 }, name: 'original_ipt_reference' },
    {
      key: { 'transformation_metadata.timestamp': 1 },
      name: 'transform_timestamp'
    },
    {
      key: { 'transformation_metadata.pipeline_version': 1 },
      name: 'pipeline_version'
    },
    {
      key: { 'transformation_metadata.fallback_applied': 1 },
      name: 'fallback_status'
    }
  ])

  // processingLocks indexes
  await db.collection('processingLocks').createIndexes([
    { key: { resource_type: 1, is_locked: 1 }, name: 'resource_lock_status' },
    { key: { lock_expires_at: 1 }, name: 'lock_expiration' },
    { key: { locked_by: 1 }, name: 'lock_owner' },
    { key: { is_locked: 1, lock_expires_at: 1 }, name: 'cleanup_query' }
  ])

  // Enhanced ipts indexes
  await db.collection('ipts').createIndexes([
    {
      key: { 'processing_control.is_processing': 1 },
      name: 'processing_status'
    },
    {
      key: { 'processing_control.last_ingestion_check': 1 },
      name: 'last_check'
    },
    { key: { 'processing_control.version_hash': 1 }, name: 'version_hash' },
    { key: { 'processing_control.last_error': 1 }, name: 'error_tracking' }
  ])

  console.log('Preservation system indexes created successfully')
}
```

## Performance Considerations

### Query Patterns

1. **Original Data Retrieval**: Frequently queries by `iptId`, `collection_type`, and `processing_status`
2. **Reference Lookups**: Links transformed documents to original data via `original_reference`
3. **Time-based Queries**: Filter by ingestion timestamp for data management
4. **Lock Management**: Quick lookup and cleanup of processing locks

### Index Maintenance

- Indexes should be created during system initialization
- Monitor index usage with `db.collection.getIndexStats()`
- Consider compound index order based on query selectivity
- Regular cleanup of expired locks to maintain performance

### Storage Impact

- Original data collections will roughly double storage requirements
- Indexes add approximately 10-15% additional storage overhead
- Plan for gradual growth as historical data accumulates

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Index Hit Ratios**: Ensure queries are using indexes effectively
2. **Lock Cleanup**: Monitor expired lock cleanup frequency
3. **Original Data Growth**: Track storage usage over time
4. **Query Performance**: Monitor average query execution times

### Recommended Alerts

- Lock table size exceeds threshold (indicates cleanup issues)
- Query performance degradation on original data collections
- High fallback rates in transformation metadata
- Unusual growth patterns in original data storage
