import { MongoClient } from 'mongodb'
import {
  PreservadorDadosOriginais,
  TransformedDocumentWithRef
} from './lib/preservador-dados-originais.ts'

/**
 * Script para restauração de dados de ocorrência
 * Reconstrói dados transformados a partir de dados originais preservados
 */

interface RestorationOptions {
  /** Filtrar por IPT específico */
  iptId?: string

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

  /** Sobrescrever dados existentes */
  overwrite?: boolean
}

interface RestorationStats {
  totalDocuments: number
  restoredDocuments: number
  failedDocuments: number
  skippedDocuments: number
  errors: Array<{ document_id: string; error: string }>
  duration: number
}

/**
 * Utilitários de transformação de ocorrências baseados na lógica original
 */
function transformOccurrenceData(originalData: any): any {
  const processedData = { ...originalData }

  // Converter campos numéricos (baseado na lógica original)
  function tryConvertToNumber(
    obj: Record<string, any>,
    propName: string,
    validator?: (num: number) => boolean
  ): void {
    if (obj[propName] && typeof obj[propName] === 'string') {
      const numValue = parseInt(obj[propName], 10)
      if (!isNaN(numValue) && (!validator || validator(numValue))) {
        obj[propName] = numValue
      }
    }
  }

  tryConvertToNumber(processedData, 'year', (num) => num > 0)
  tryConvertToNumber(processedData, 'month', (num) => num >= 1 && num <= 12)
  tryConvertToNumber(processedData, 'day', (num) => num >= 1 && num <= 31)

  // Processar geolocalização
  if (processedData.decimalLatitude && processedData.decimalLongitude) {
    const latitude = +processedData.decimalLatitude
    const longitude = +processedData.decimalLongitude
    if (
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      processedData.geoPoint = {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    }
  }

  // Calcular canonicalName
  const canonicalName = [
    processedData.genus,
    processedData.genericName,
    processedData.subgenus,
    processedData.infragenericEpithet,
    processedData.specificEpithet,
    processedData.infraspecificEpithet,
    processedData.cultivarEpiteth
  ]
    .filter(Boolean)
    .join(' ')

  // Processar data do evento
  if (processedData.eventDate && typeof processedData.eventDate === 'string') {
    try {
      const eventDateObj = new Date(processedData.eventDate)
      if (!isNaN(eventDateObj.getTime())) {
        if (!processedData.year) {
          processedData.year = eventDateObj.getFullYear()
        }
        if (!processedData.month) {
          processedData.month = eventDateObj.getMonth() + 1
        }
        if (!processedData.day) {
          processedData.day = eventDateObj.getDate()
        }
        processedData.eventDate = eventDateObj
      }
    } catch (_error) {
      // Se parsing falha, manter como string original
    }
  }

  return {
    canonicalName,
    flatScientificName: (processedData.scientificName ?? canonicalName)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase(),
    ...processedData
  }
}

/**
 * Restaura dados de ocorrência a partir de dados originais preservados
 */
export async function restoreOccurrenceData(
  mongoUri: string,
  options: RestorationOptions = {}
): Promise<RestorationStats> {
  const startTime = Date.now()
  const {
    iptId,
    batchSize = 1000,
    dryRun = false,
    limit,
    fromDate,
    toDate,
    overwrite = false
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

    console.log('Buscando documentos originais para restauração...')
    const originalDocuments = await preservador.getDocumentsToTransform(
      'ocorrencias',
      filters
    )

    if (originalDocuments.length === 0) {
      console.log('Nenhum documento encontrado para restauração')
      return {
        totalDocuments: 0,
        restoredDocuments: 0,
        failedDocuments: 0,
        skippedDocuments: 0,
        errors: [],
        duration: (Date.now() - startTime) / 1000
      }
    }

    console.log(
      `Encontrados ${originalDocuments.length} documentos para restaurar`
    )

    const stats: RestorationStats = {
      totalDocuments: originalDocuments.length,
      restoredDocuments: 0,
      failedDocuments: 0,
      skippedDocuments: 0,
      errors: [],
      duration: 0
    }

    // Obter coleção de ocorrências
    const collection = client
      .db('dwc2json')
      .collection<TransformedDocumentWithRef>('ocorrencias')

    // Processar em lotes
    for (let i = 0; i < originalDocuments.length; i += batchSize) {
      const batch = originalDocuments.slice(i, i + batchSize)
      console.log(
        `Processando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(originalDocuments.length / batchSize)}`
      )

      for (const originalDoc of batch) {
        try {
          // Verificar se documento já existe (se não estamos sobrescrevendo)
          if (!overwrite) {
            const existingDoc = await collection.findOne({
              _id: originalDoc._id
            })
            if (existingDoc) {
              stats.skippedDocuments++
              continue
            }
          }

          // Transformar dados originais
          const transformedData = transformOccurrenceData(
            originalDoc.original_data
          )

          // Adicionar metadados do IPT
          const restoredDocument = {
            ...transformedData,
            _id: originalDoc._id,
            iptId: originalDoc.iptId,
            ipt: originalDoc.ipt,
            original_reference: {
              original_id: originalDoc._id,
              iptId: originalDoc.iptId,
              ipt_record_id: originalDoc.ipt_record_id
            },
            transformation_metadata: {
              timestamp: new Date(),
              pipeline_version: '1.0.0-restore',
              transform_functions: [
                'restoreOccurrenceData',
                'transformOccurrenceData'
              ],
              fallback_applied: false
            }
          }

          if (!dryRun) {
            // Salvar documento restaurado
            await collection.replaceOne(
              { _id: originalDoc._id },
              restoredDocument,
              { upsert: true }
            )

            // Marcar como processado
            await preservador.markAsProcessed([originalDoc._id], 'ocorrencias')
          }

          stats.restoredDocuments++
        } catch (error) {
          console.error(
            `Erro ao restaurar documento ${originalDoc._id}:`,
            error
          )
          stats.failedDocuments++
          stats.errors.push({
            document_id: originalDoc._id.toString(),
            error: (error as Error).message
          })
        }
      }
    }

    stats.duration = (Date.now() - startTime) / 1000

    console.log('Restauração concluída:')
    console.log(`- Total: ${stats.totalDocuments}`)
    console.log(`- Restaurados: ${stats.restoredDocuments}`)
    console.log(`- Pulados: ${stats.skippedDocuments}`)
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
  const options: RestorationOptions = {}

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
      case '--overwrite':
        options.overwrite = true
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

  console.log('Iniciando restauração de dados de ocorrência...')
  console.log('Opções:', options)

  try {
    const stats = await restoreOccurrenceData(mongoUri, options)

    if (stats.failedDocuments > 0) {
      console.error('Alguns documentos falharam na restauração:')
      stats.errors.slice(0, 10).forEach((err) => {
        console.error(`- ${err.document_id}: ${err.error}`)
      })
      if (stats.errors.length > 10) {
        console.error(`... e mais ${stats.errors.length - 10} erros`)
      }
    }

    process.exit(stats.failedDocuments > 0 ? 1 : 0)
  } catch (error) {
    console.error('Erro durante restauração:', error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Restoration failed:', error)
    process.exitCode = 1
  })
}

export { RestorationOptions, RestorationStats }
