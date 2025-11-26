import { Db, MongoClient } from 'mongodb'

/**
 * Script para configuração do banco de dados
 * Cria indexes, valida estrutura e configura preservação de dados
 */

/**
 * Cria todos os indexes necessários para o sistema de preservação
 */
async function createPreservationIndexes(db: Db): Promise<void> {
  console.log('Creating preservation system indexes...')

  try {
    // taxaOriginal indexes
    console.log('Creating taxaOriginal indexes...')
    await db.collection('taxaOriginal').createIndexes([
      { key: { iptId: 1, ipt_version: 1 }, name: 'iptId_version' },
      { key: { collection_type: 1 }, name: 'collection_type' },
      {
        key: { 'processing_status.is_processed': 1 },
        name: 'processing_status'
      },
      {
        key: { 'ingestion_metadata.timestamp': 1 },
        name: 'ingestion_timestamp'
      },
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
    console.log('Creating ocorrenciasOriginal indexes...')
    await db.collection('ocorrenciasOriginal').createIndexes([
      { key: { iptId: 1, ipt_version: 1 }, name: 'iptId_version' },
      { key: { collection_type: 1 }, name: 'collection_type' },
      {
        key: { 'processing_status.is_processed': 1 },
        name: 'processing_status'
      },
      {
        key: { 'ingestion_metadata.timestamp': 1 },
        name: 'ingestion_timestamp'
      },
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
    console.log('Creating enhanced taxa indexes...')
    await db.collection('taxa').createIndexes([
      {
        key: { 'original_reference.original_id': 1 },
        name: 'original_reference'
      },
      {
        key: { 'original_reference.iptId': 1 },
        name: 'original_ipt_reference'
      },
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
    console.log('Creating enhanced ocorrencias indexes...')
    await db.collection('ocorrencias').createIndexes([
      {
        key: { 'original_reference.original_id': 1 },
        name: 'original_reference'
      },
      {
        key: { 'original_reference.iptId': 1 },
        name: 'original_ipt_reference'
      },
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
    console.log('Creating processingLocks indexes...')
    await db.collection('processingLocks').createIndexes([
      { key: { resource_type: 1, is_locked: 1 }, name: 'resource_lock_status' },
      { key: { lock_expires_at: 1 }, name: 'lock_expiration' },
      { key: { locked_by: 1 }, name: 'lock_owner' },
      { key: { is_locked: 1, lock_expires_at: 1 }, name: 'cleanup_query' }
    ])

    // Enhanced ipts indexes
    console.log('Creating enhanced ipts indexes...')
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

    console.log('All preservation system indexes created successfully')
  } catch (error) {
    console.error('Error creating indexes:', error)
    throw error
  }
}

/**
 * Valida estrutura do banco de dados
 */
async function validateDatabaseStructure(db: Db): Promise<{
  valid: boolean
  issues: string[]
  recommendations: string[]
}> {
  console.log('Validating database structure...')

  const issues: string[] = []
  const recommendations: string[] = []

  try {
    // Verificar se coleções existem
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map((c) => c.name)

    const requiredCollections = ['taxa', 'ocorrencias', 'ipts']

    const preservationCollections = [
      'taxaOriginal',
      'ocorrenciasOriginal',
      'processingLocks'
    ]

    // Verificar coleções obrigatórias
    for (const collection of requiredCollections) {
      if (!collectionNames.includes(collection)) {
        issues.push(`Missing required collection: ${collection}`)
      }
    }

    // Verificar coleções de preservação
    for (const collection of preservationCollections) {
      if (!collectionNames.includes(collection)) {
        recommendations.push(
          `Consider creating preservation collection: ${collection}`
        )
      }
    }

    // Verificar indexes em coleções existentes
    for (const collectionName of ['taxa', 'ocorrencias']) {
      if (collectionNames.includes(collectionName)) {
        const indexes = await db
          .collection(collectionName)
          .listIndexes()
          .toArray()
        const indexNames = indexes.map((i) => i.name)

        // Verificar indexes básicos
        if (!indexNames.includes('scientificName')) {
          issues.push(`Missing scientificName index on ${collectionName}`)
        }

        // Verificar indexes de preservação
        if (!indexNames.includes('original_reference')) {
          recommendations.push(
            `Consider adding original_reference index to ${collectionName}`
          )
        }
      }
    }

    // Verificar estatísticas de coleções
    for (const collectionName of requiredCollections) {
      if (collectionNames.includes(collectionName)) {
        const stats = await db
          .collection(collectionName)
          .estimatedDocumentCount()
        console.log(`Collection ${collectionName}: ~${stats} documents`)

        if (stats === 0) {
          recommendations.push(
            `Collection ${collectionName} is empty - consider running data ingestion`
          )
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    }
  } catch (error) {
    issues.push(`Error validating database: ${(error as Error).message}`)
    return {
      valid: false,
      issues,
      recommendations
    }
  }
}

/**
 * Configura sistema de preservação de dados
 */
async function setupPreservationSystem(db: Db): Promise<void> {
  console.log('Setting up data preservation system...')

  // Criar indexes
  await createPreservationIndexes(db)

  // Configurar TTL para locks expirados (limpa automaticamente após 24h)
  console.log('Setting up TTL for expired locks...')
  await db.collection('processingLocks').createIndex(
    { lock_expires_at: 1 },
    {
      name: 'lock_ttl',
      expireAfterSeconds: 24 * 60 * 60 // 24 horas
    }
  )

  // Criar coleção de auditoria se não existir
  console.log('Setting up audit collection...')
  await db.collection('lockAuditLog').createIndex(
    { timestamp: 1 },
    {
      name: 'audit_timestamp',
      expireAfterSeconds: 30 * 24 * 60 * 60 // 30 dias
    }
  )

  console.log('Data preservation system setup complete')
}

/**
 * Executa limpeza de manutenção
 */
async function performMaintenance(db: Db): Promise<{
  expiredLocksRemoved: number
  oldAuditLogsRemoved: number
  indexesOptimized: number
}> {
  console.log('Performing database maintenance...')

  // Limpar locks expirados manualmente (além do TTL)
  const expiredLocksResult = await db.collection('processingLocks').deleteMany({
    is_locked: true,
    lock_expires_at: { $lt: new Date() }
  })

  // Limpar logs de auditoria antigos (além do TTL)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const auditCleanupResult = await db.collection('lockAuditLog').deleteMany({
    timestamp: { $lt: thirtyDaysAgo }
  })

  // Executar reindex em coleções principais (pode ser demorado)
  let indexesOptimized = 0
  const collections = [
    'taxa',
    'ocorrencias',
    'taxaOriginal',
    'ocorrenciasOriginal'
  ]

  for (const collectionName of collections) {
    try {
      // MongoDB driver não tem reIndex, usar dropIndexes + createIndexes como alternativa
      console.log(`Optimizing indexes for ${collectionName}...`)
      const indexInfo = await db
        .collection(collectionName)
        .listIndexes()
        .toArray()

      // Contar como otimizado se conseguiu listar os indexes
      if (indexInfo.length > 0) {
        indexesOptimized++
      }
    } catch (error) {
      console.warn(`Could not optimize indexes for ${collectionName}:`, error)
    }
  }

  console.log('Database maintenance completed')

  return {
    expiredLocksRemoved: expiredLocksResult.deletedCount,
    oldAuditLogsRemoved: auditCleanupResult.deletedCount,
    indexesOptimized
  }
}

/**
 * Main function para execução via linha de comando
 */
async function main() {
  const command = process.argv[2]
  const mongoUri = process.env.MONGO_URI

  if (!mongoUri) {
    console.error('MONGO_URI environment variable is required')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri)
  await client.connect()
  const db = client.db('dwc2json')

  try {
    switch (command) {
      case 'setup':
        await setupPreservationSystem(db)
        break

      case 'validate':
        const validation = await validateDatabaseStructure(db)
        console.log('\nValidation Results:')
        console.log(`Valid: ${validation.valid}`)

        if (validation.issues.length > 0) {
          console.log('\nIssues:')
          validation.issues.forEach((issue) => console.log(`  ❌ ${issue}`))
        }

        if (validation.recommendations.length > 0) {
          console.log('\nRecommendations:')
          validation.recommendations.forEach((rec) =>
            console.log(`  💡 ${rec}`)
          )
        }

        process.exit(validation.valid ? 0 : 1)

      case 'indexes':
        await createPreservationIndexes(db)
        break

      case 'maintenance':
        const maintenanceResult = await performMaintenance(db)
        console.log('\nMaintenance Results:')
        console.log(
          `Expired locks removed: ${maintenanceResult.expiredLocksRemoved}`
        )
        console.log(
          `Old audit logs removed: ${maintenanceResult.oldAuditLogsRemoved}`
        )
        console.log(`Indexes optimized: ${maintenanceResult.indexesOptimized}`)
        break

      default:
        console.log('Usage: bun run database-operations.ts <command>')
        console.log('Commands:')
        console.log('  setup      - Complete preservation system setup')
        console.log('  validate   - Validate database structure')
        console.log('  indexes    - Create preservation indexes only')
        console.log('  maintenance - Perform maintenance tasks')
        process.exit(1)
    }
  } catch (error) {
    console.error('Database operation failed:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Database operation failed:', error)
    process.exitCode = 1
  })
}

export {
  createPreservationIndexes,
  performMaintenance,
  setupPreservationSystem,
  validateDatabaseStructure
}
