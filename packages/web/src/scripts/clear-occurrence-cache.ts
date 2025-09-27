import { config } from 'dotenv'
import { countOccurrenceRegions } from '@/lib/mongo'

// Carregar variáveis de ambiente
config()

async function clearOccurrenceCache() {
  console.log('🧹 Limpando cache de ocorrências...')

  try {
    // Importar MongoClient dinamicamente para evitar problemas de inicialização
    const { MongoClient } = await import('mongodb')

    const mongoUri = process.env.MONGO_URI
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required')
    }

    const client = new MongoClient(mongoUri)
    await client.connect()

    const db = client.db('dwc2json')
    const cacheCollection = db.collection('occurrenceCache')

    const result = await cacheCollection.deleteMany({})
    console.log(`✅ Removidos ${result.deletedCount} documentos do cache`)

    await client.close()
  } catch (error) {
    console.error('❌ Erro ao limpar cache:', error)
    throw error
  }
}

async function generateInitialOccurrenceCache() {
  console.log('🔄 Gerando cache inicial de ocorrências (sem filtros)...')

  try {
    const startTime = Date.now()
    const result = await countOccurrenceRegions({})

    if (!result) {
      throw new Error('Falha ao gerar cache de ocorrências')
    }

    const duration = Date.now() - startTime
    console.log(`✅ Cache inicial gerado em ${duration}ms`)
    console.log(`   - Total de ocorrências: ${result.total}`)
    console.log(`   - Regiões: ${result.regions.length}`)

    return result
  } catch (error) {
    console.error('❌ Erro ao gerar cache inicial:', error)
    throw error
  }
}

async function main() {
  try {
    console.log('🚀 Iniciando manutenção do cache de ocorrências...')

    // 1. Limpar cache antigo
    await clearOccurrenceCache()

    // 2. Gerar cache inicial
    await generateInitialOccurrenceCache()

    console.log('🎉 Manutenção do cache concluída com sucesso!')
    process.exit(0)
  } catch (error) {
    console.error('💥 Erro durante manutenção do cache:', error)
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (
  typeof process !== 'undefined' &&
  process.argv[1]?.endsWith('clear-occurrence-cache.ts')
) {
  main()
}

export { clearOccurrenceCache, generateInitialOccurrenceCache }
