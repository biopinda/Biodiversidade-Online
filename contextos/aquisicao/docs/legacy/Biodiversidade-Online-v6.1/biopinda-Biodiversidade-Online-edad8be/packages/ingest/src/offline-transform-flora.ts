import { MongoClient } from 'mongodb'
import { processaFlora } from './flora.ts'
import {
  PreservadorDadosOriginais,
  TransformedDocumentWithRef
} from './lib/preservador-dados-originais.ts'
import { DocumentoOriginal } from './types/documento-original.ts'

/**
 * Script para transformação offline de flora
 * Processa dados preservados sem necessidade de re-download
 */

interface OfflineTransformOptions {
  /** Filtrar por IPT específico */
  iptId?: string

  /** Processar apenas dados não processados */
  onlyUnprocessed?: boolean

  /** Tamanho do lote para processamento */
  batchSize?: number

  /** Executar em modo dry-run (não salvar) */
  dryRun?: boolean

  /** Limite de documentos para processar */
  limit?: number

  /** Data de início para filtro de tempo */
  fromDate?: Date

  /** Data de fim para filtro de tempo */
  toDate?: Date
}

interface TransformationStats {
  totalDocuments: number
  transformedDocuments: number
  failedDocuments: number
  skippedDocuments: number
  errors: Array<{ document_id: string; error: string }>
  duration: number
}

/**
 * Transforma dados de flora offline usando dados preservados
 */
export async function transformFloraOffline(
  mongoUri: string,
  options: OfflineTransformOptions = {}
): Promise<TransformationStats> {
  const startTime = Date.now()
  const {
    iptId,
    onlyUnprocessed = true,
    batchSize = 1000,
    dryRun = false,
    limit,
    fromDate,
    toDate
  } = options

  const client = new MongoClient(mongoUri)
  await client.connect()

  try {
    const preservador = new PreservadorDadosOriginais(client.db('dwc2json'))

    // Construir filtros
    const filters: any = {}
    if (iptId) filters.iptId = iptId
    if (fromDate || toDate) {
      filters.dateRange = {}
      if (fromDate) filters.dateRange.from = fromDate
      if (toDate) filters.dateRange.to = toDate
    }
    if (limit) filters.limit = limit
    if (onlyUnprocessed) filters.onlyUnprocessed = true

    console.log('Buscando documentos originais para transformação...')
    const originalDocuments = await preservador.getDocumentsToTransform(
      'flora',
      filters
    )

    if (originalDocuments.length === 0) {
      console.log('Nenhum documento encontrado para transformação')
      return {
        totalDocuments: 0,
        transformedDocuments: 0,
        failedDocuments: 0,
        skippedDocuments: 0,
        errors: [],
        duration: (Date.now() - startTime) / 1000
      }
    }

    console.log(
      `Encontrados ${originalDocuments.length} documentos para transformar`
    )

    const stats: TransformationStats = {
      totalDocuments: originalDocuments.length,
      transformedDocuments: 0,
      failedDocuments: 0,
      skippedDocuments: 0,
      errors: [],
      duration: 0
    }

    // Processar em lotes
    for (let i = 0; i < originalDocuments.length; i += batchSize) {
      const batch = originalDocuments.slice(i, i + batchSize)
      console.log(
        `Processando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(originalDocuments.length / batchSize)}`
      )

      // Agrupar por IPT para transformação eficiente
      const iptGroups = new Map<string, DocumentoOriginal[]>()
      for (const doc of batch) {
        if (!iptGroups.has(doc.iptId)) {
          iptGroups.set(doc.iptId, [])
        }
        iptGroups.get(doc.iptId)!.push(doc)
      }

      // Transformar cada grupo de IPT
      for (const [currentIptId, iptDocs] of iptGroups) {
        try {
          // Converter documentos para formato esperado pela função processaFlora
          const floraJson: Record<string, any> = {}
          iptDocs.forEach((doc: DocumentoOriginal, index: number) => {
            floraJson[`${doc.iptId}_${index}`] = doc.original_data
          })

          // Aplicar transformações
          const transformedData = processaFlora(floraJson)
          const transformedArray = Object.values(transformedData)

          if (!dryRun) {
            // Salvar dados transformados
            const collection = client
              .db('dwc2json')
              .collection<TransformedDocumentWithRef>('taxa')

            // Preparar documentos com referências
            const documentsToSave = transformedArray.map(
              (transformed: any, index: number) => {
                const originalDoc = iptDocs[index % iptDocs.length]
                return {
                  ...(transformed as object),
                  _id: originalDoc._id,
                  original_reference: {
                    original_id: originalDoc._id,
                    iptId: originalDoc.iptId,
                    ipt_record_id: originalDoc.ipt_record_id
                  },
                  transformation_metadata: {
                    timestamp: new Date(),
                    pipeline_version: '1.0.0-offline',
                    transform_functions: [
                      'processaFlora',
                      'transformFloraOffline'
                    ],
                    fallback_applied: false
                  }
                }
              }
            )

            // Substituir documentos existentes
            for (const doc of documentsToSave) {
              await collection.replaceOne({ _id: doc._id }, doc, {
                upsert: true
              })
            }

            // Marcar como processados
            const processedIds = iptDocs.map(
              (doc: DocumentoOriginal) => doc._id
            )
            await preservador.markAsProcessed(processedIds, 'flora')
          }

          stats.transformedDocuments += iptDocs.length
          console.log(
            `Transformados ${iptDocs.length} documentos para IPT ${currentIptId}`
          )
        } catch (error) {
          console.error(`Erro ao transformar IPT ${currentIptId}:`, error)

          for (const doc of iptDocs) {
            stats.failedDocuments++
            stats.errors.push({
              document_id: doc._id.toString(),
              error: (error as Error).message
            })
          }
        }
      }
    }

    stats.duration = (Date.now() - startTime) / 1000

    console.log('Transformação concluída:')
    console.log(`- Total: ${stats.totalDocuments}`)
    console.log(`- Transformados: ${stats.transformedDocuments}`)
    console.log(`- Falhas: ${stats.failedDocuments}`)
    console.log(`- Duração: ${stats.duration.toFixed(2)}s`)

    return stats
  } finally {
    await client.close()
  }
}

/**
 * Main function para execução via linha de comando
 */
async function main() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('MONGO_URI environment variable is required')
    process.exit(1)
  }

  // Parsing básico de argumentos
  const args = process.argv.slice(2)
  const options: OfflineTransformOptions = {}

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    const value = args[i + 1]

    switch (flag) {
      case '--ipt-id':
        options.iptId = value
        break
      case '--batch-size':
        options.batchSize = parseInt(value, 10)
        break
      case '--limit':
        options.limit = parseInt(value, 10)
        break
      case '--dry-run':
        options.dryRun = true
        i-- // Este flag não tem valor
        break
      case '--include-processed':
        options.onlyUnprocessed = false
        i-- // Este flag não tem valor
        break
      case '--from-date':
        options.fromDate = new Date(value)
        break
      case '--to-date':
        options.toDate = new Date(value)
        break
    }
  }

  console.log('Iniciando transformação offline de flora...')
  console.log('Opções:', options)

  try {
    const stats = await transformFloraOffline(mongoUri, options)

    if (stats.failedDocuments > 0) {
      console.error('Alguns documentos falharam na transformação:')
      stats.errors.slice(0, 10).forEach((err) => {
        console.error(`- ${err.document_id}: ${err.error}`)
      })
      if (stats.errors.length > 10) {
        console.error(`... e mais ${stats.errors.length - 10} erros`)
      }
    }

    process.exit(stats.failedDocuments > 0 ? 1 : 0)
  } catch (error) {
    console.error('Erro durante transformação offline:', error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Transformation failed:', error)
    process.exitCode = 1
  })
}

export { OfflineTransformOptions, TransformationStats }
