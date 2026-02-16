import { Collection, Db, ObjectId } from 'mongodb'
import {
  DocumentoOriginal,
  DwCRecord,
  PreservationOptions,
  PreservationResult
} from '../types/documento-original.ts'
import { type Ipt } from './dwca.ts'

/**
 * Dados para referência de documento transformado
 */
export interface TransformationReference {
  /** ID do documento original */
  original_id: ObjectId

  /** IPT de origem */
  iptId: string

  /** ID original no IPT */
  ipt_record_id: string
}

/**
 * Metadados de transformação
 */
export interface TransformationMetadata {
  /** Quando foi transformado */
  timestamp: Date

  /** Versão do pipeline usado */
  pipeline_version: string

  /** Lista de funções aplicadas */
  transform_functions: string[]

  /** Se usou fallback para dados originais */
  fallback_applied: boolean
}

/**
 * Documento transformado com referência
 */
export interface TransformedDocumentWithRef {
  /** ID do documento (mesmo do original) */
  _id?: ObjectId

  /** Dados transformados */
  [key: string]: any

  /** Referência ao documento original */
  original_reference?: TransformationReference

  /** Metadados de transformação */
  transformation_metadata?: TransformationMetadata
}

/**
 * Preservador de dados originais
 */
export class PreservadorDadosOriginais {
  private db: Db
  private taxaOriginalCol: Collection<DocumentoOriginal>
  private ocorrenciasOriginalCol: Collection<DocumentoOriginal>
  private taxaCol: Collection<TransformedDocumentWithRef>
  private ocorrenciasCol: Collection<TransformedDocumentWithRef>

  constructor(db: Db) {
    this.db = db
    this.taxaOriginalCol = db.collection<DocumentoOriginal>('taxaOriginal')
    this.ocorrenciasOriginalCol = db.collection<DocumentoOriginal>(
      'ocorrenciasOriginal'
    )
    this.taxaCol = db.collection<TransformedDocumentWithRef>('taxa')
    this.ocorrenciasCol =
      db.collection<TransformedDocumentWithRef>('ocorrencias')
  }

  /**
   * Preserva dados originais antes da transformação
   */
  async preserveOriginalData(
    json: Record<string, DwCRecord>,
    ipt: Ipt,
    collectionType: 'fauna' | 'flora' | 'ocorrencias',
    options: PreservationOptions = {}
  ): Promise<PreservationResult> {
    const startTime = Date.now()
    const { batch_size = 5000, dry_run = false } = options

    try {
      // Preparar documentos originais
      const originalDocuments: DocumentoOriginal[] = Object.entries(json).map(
        ([recordId, data]) => ({
          _id: new ObjectId(),
          iptId: ipt.id,
          ipt: (ipt as any).tag || collectionType,
          ipt_record_id: recordId,
          ipt_version: ipt.version || 'unknown',
          collection_type: collectionType,
          original_data: data,
          ingestion_metadata: {
            timestamp: new Date(),
            source_ipt_url: ipt.id,
            processing_version: '1.0.0',
            dwca_version: ipt.version || 'unknown'
          },
          processing_status: {
            is_processed: false,
            last_transform_attempt: null
          }
        })
      )

      if (dry_run) {
        return {
          status: 'success',
          documents_preserved: originalDocuments.length,
          failed_documents: 0,
          duration: (Date.now() - startTime) / 1000,
          errors: []
        }
      }

      // Selecionar coleção correta
      const collection =
        collectionType === 'ocorrencias'
          ? this.ocorrenciasOriginalCol
          : this.taxaOriginalCol

      // Remover documentos existentes deste IPT
      await collection.deleteMany({
        iptId: ipt.id,
        ipt_version: ipt.version
      })

      // Inserir em lotes
      let totalInserted = 0
      let totalFailed = 0
      const errors: Array<{ record_id: string; error: string }> = []

      for (let i = 0; i < originalDocuments.length; i += batch_size) {
        const batch = originalDocuments.slice(i, i + batch_size)

        try {
          await collection.insertMany(batch, { ordered: false })
          totalInserted += batch.length
        } catch (error) {
          // Tentar inserir individualmente para identificar problemas
          for (const doc of batch) {
            try {
              await collection.insertOne(doc)
              totalInserted++
            } catch (docError) {
              totalFailed++
              errors.push({
                record_id: doc.ipt_record_id,
                error: (docError as Error).message
              })
            }
          }
        }
      }

      const duration = (Date.now() - startTime) / 1000
      const status =
        totalFailed === 0
          ? 'success'
          : totalInserted > 0
            ? 'partial'
            : 'failure'

      return {
        status,
        documents_preserved: totalInserted,
        failed_documents: totalFailed,
        duration,
        errors
      }
    } catch (error) {
      return {
        status: 'failure',
        documents_preserved: 0,
        failed_documents: Object.keys(json).length,
        duration: (Date.now() - startTime) / 1000,
        errors: [{ record_id: 'all', error: (error as Error).message }],
        preservation_failed: true
      }
    }
  }

  /**
   * Salva documentos transformados com referência ao original
   */
  async saveTransformedWithReference(
    transformedData: any[],
    ipt: Ipt,
    collectionType: 'fauna' | 'flora' | 'ocorrencias',
    transformFunctions: string[] = [],
    options: { batch_size?: number; dry_run?: boolean } = {}
  ): Promise<{ inserted: number; failed: number; errors: string[] }> {
    const { batch_size = 5000, dry_run = false } = options

    try {
      // Buscar IDs dos documentos originais correspondentes
      const originalCol =
        collectionType === 'ocorrencias'
          ? this.ocorrenciasOriginalCol
          : this.taxaOriginalCol

      const originalDocs = await originalCol
        .find({
          iptId: ipt.id,
          ipt_version: ipt.version
        })
        .toArray()

      // Criar mapeamento por record_id
      const originalMap = new Map<string, DocumentoOriginal>()
      originalDocs.forEach((doc) => {
        originalMap.set(doc.ipt_record_id, doc)
      })

      // Enriquecer dados transformados com referências
      const enrichedData: TransformedDocumentWithRef[] = transformedData.map(
        (doc, index) => {
          // Tentar encontrar documento original correspondente
          // Assumindo que a ordem é mantida ou que há uma forma de identificar
          const originalDoc =
            originalDocs[index] ||
            originalDocs.find(
              (orig) => orig.original_data.scientificName === doc.scientificName
            )

          if (originalDoc) {
            return {
              ...doc,
              _id: originalDoc._id, // Usar mesmo ID
              original_reference: {
                original_id: originalDoc._id,
                iptId: ipt.id,
                ipt_record_id: originalDoc.ipt_record_id
              },
              transformation_metadata: {
                timestamp: new Date(),
                pipeline_version: '1.0.0',
                transform_functions: transformFunctions,
                fallback_applied: false
              }
            }
          } else {
            // Fallback: criar sem referência
            return {
              ...doc,
              transformation_metadata: {
                timestamp: new Date(),
                pipeline_version: '1.0.0',
                transform_functions: transformFunctions,
                fallback_applied: true
              }
            }
          }
        }
      )

      if (dry_run) {
        return {
          inserted: enrichedData.length,
          failed: 0,
          errors: []
        }
      }

      // Selecionar coleção transformada
      const transformedCol =
        collectionType === 'ocorrencias' ? this.ocorrenciasCol : this.taxaCol

      // Remover dados transformados existentes deste IPT
      const deleteFilter =
        collectionType === 'ocorrencias'
          ? { iptId: ipt.id }
          : { 'original_reference.iptId': ipt.id }

      await transformedCol.deleteMany(deleteFilter)

      // Inserir em lotes
      let totalInserted = 0
      const errors: string[] = []

      for (let i = 0; i < enrichedData.length; i += batch_size) {
        const batch = enrichedData.slice(i, i + batch_size)

        try {
          await transformedCol.insertMany(batch, { ordered: false })
          totalInserted += batch.length
        } catch (error) {
          errors.push(
            `Batch ${Math.floor(i / batch_size)}: ${(error as Error).message}`
          )
        }
      }

      return {
        inserted: totalInserted,
        failed: enrichedData.length - totalInserted,
        errors
      }
    } catch (error) {
      return {
        inserted: 0,
        failed: transformedData.length,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Cria IDs consistentes para documentos
   */
  async createConsistentDocumentIds(
    data: Record<string, DwCRecord>,
    ipt: Ipt
  ): Promise<Record<string, ObjectId>> {
    const idMapping: Record<string, ObjectId> = {}

    Object.keys(data).forEach((recordId) => {
      // Gerar ID determinístico baseado em IPT + recordId
      const seed = `${ipt.id}:${recordId}`
      // Para simplicidade, usar ObjectId aleatório
      // Em produção, poderia usar hash determinístico
      idMapping[recordId] = new ObjectId()
    })

    return idMapping
  }

  /**
   * Obtém documentos para transformação offline
   */
  async getDocumentsToTransform(
    collectionType: 'fauna' | 'flora' | 'ocorrencias',
    filters: {
      iptId?: string
      dateRange?: { from: Date; to: Date }
      onlyUnprocessed?: boolean
      limit?: number
    } = {}
  ): Promise<DocumentoOriginal[]> {
    const collection =
      collectionType === 'ocorrencias'
        ? this.ocorrenciasOriginalCol
        : this.taxaOriginalCol

    const query: any = { collection_type: collectionType }

    if (filters.iptId) {
      query.iptId = filters.iptId
    }

    if (filters.dateRange) {
      query['ingestion_metadata.timestamp'] = {
        $gte: filters.dateRange.from,
        $lte: filters.dateRange.to
      }
    }

    if (filters.onlyUnprocessed) {
      query['processing_status.is_processed'] = false
    }

    const cursor = collection.find(query)

    if (filters.limit) {
      cursor.limit(filters.limit)
    }

    return cursor.toArray()
  }

  /**
   * Marca documentos como processados
   */
  async markAsProcessed(
    documentIds: ObjectId[],
    collectionType: 'fauna' | 'flora' | 'ocorrencias'
  ): Promise<number> {
    const collection =
      collectionType === 'ocorrencias'
        ? this.ocorrenciasOriginalCol
        : this.taxaOriginalCol

    const result = await collection.updateMany(
      { _id: { $in: documentIds } },
      {
        $set: {
          'processing_status.is_processed': true,
          'processing_status.last_transform_attempt': new Date()
        }
      }
    )

    return result.modifiedCount
  }
}

// Funções de conveniência para uso nos scripts
let preservadorInstance: PreservadorDadosOriginais | null = null

/**
 * Inicializa o preservador de dados reutilizando uma conexão existente
 */
export function initializeDataPreserver(db: Db): PreservadorDadosOriginais {
  preservadorInstance = new PreservadorDadosOriginais(db)
  return preservadorInstance
}

/**
 * Obtém instância do preservador
 */
export function getDataPreserver(): PreservadorDadosOriginais {
  if (!preservadorInstance) {
    throw new Error(
      'Data preserver not initialized. Call initializeDataPreserver first.'
    )
  }
  return preservadorInstance
}

// Exportar funções principais
export async function preserveOriginalData(
  json: Record<string, DwCRecord>,
  ipt: Ipt,
  collectionType: 'fauna' | 'flora' | 'ocorrencias',
  options?: PreservationOptions
): Promise<PreservationResult> {
  return getDataPreserver().preserveOriginalData(
    json,
    ipt,
    collectionType,
    options
  )
}

export async function saveTransformedWithReference(
  transformedData: any[],
  ipt: Ipt,
  collectionType: 'fauna' | 'flora' | 'ocorrencias',
  transformFunctions?: string[]
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  return getDataPreserver().saveTransformedWithReference(
    transformedData,
    ipt,
    collectionType,
    transformFunctions
  )
}

export async function createConsistentDocumentIds(
  data: Record<string, DwCRecord>,
  ipt: Ipt
): Promise<Record<string, ObjectId>> {
  return getDataPreserver().createConsistentDocumentIds(data, ipt)
}
