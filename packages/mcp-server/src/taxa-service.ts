import { z } from 'zod'
import { getCollection } from './database.js'

/**
 * Schema para filtros de taxa
 */
export const TaxaFilterSchema = z.object({
  // Campos taxonômicos básicos
  scientificName: z.string().optional(),
  kingdom: z.string().optional(),
  phylum: z.string().optional(),
  class: z.string().optional(),
  order: z.string().optional(),
  family: z.string().optional(),
  genus: z.string().optional(),

  // Status taxonômico
  taxonomicStatus: z.string().optional(),

  // Localização
  stateProvince: z.string().optional(),
  country: z.string().optional(),

  // Paginação
  page: z.number().min(0).default(0),
  limit: z.number().min(1).max(100).default(50)
})

export type TaxaFilter = z.infer<typeof TaxaFilterSchema>

/**
 * Interface para documentos de taxa
 */
export interface TaxonDocument {
  _id?: string
  scientificName: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  specificEpithet?: string
  infraspecificEpithet?: string
  taxonRank?: string
  taxonomicStatus?: string
  acceptedNameUsage?: string
  parentNameUsage?: string
  stateProvince?: string
  country?: string
  vernacularname?: Array<{
    vernacularName: string
    language?: string
  }>
  reference?: Array<{
    bibliographicCitation: string
    identifier?: string
  }>
  occurrences?: Array<{
    decimalLatitude: number
    decimalLongitude: number
    eventDate?: string
    recordedBy?: string
  }>
}

/**
 * Resultado de consulta paginada de taxa
 */
export interface TaxaQueryResult {
  data: TaxonDocument[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Consulta taxa com filtros e paginação
 */
export async function queryTaxa(filters: TaxaFilter): Promise<TaxaQueryResult> {
  const collection = await getCollection('dwc2json', 'taxa')

  if (!collection) {
    throw new Error('Taxa collection not available')
  }

  // Construir filtro MongoDB
  const mongoFilter: Record<string, any> = {}

  // Filtros de texto com regex case-insensitive
  if (filters.scientificName) {
    mongoFilter.scientificName = new RegExp(filters.scientificName, 'i')
  }

  // Filtros exatos (case-insensitive)
  const exactFields = [
    'kingdom',
    'phylum',
    'class',
    'order',
    'family',
    'genus',
    'taxonomicStatus',
    'stateProvince',
    'country'
  ]
  for (const field of exactFields) {
    const value = filters[field as keyof TaxaFilter]
    if (value && typeof value === 'string') {
      mongoFilter[field] = new RegExp(`^${value}$`, 'i')
    }
  }

  try {
    // Contar total de documentos
    const total = await collection.countDocuments(mongoFilter)

    // Calcular paginação
    const totalPages = Math.ceil(total / filters.limit)

    // Buscar dados paginados
    const data = (await collection
      .find(mongoFilter)
      .sort({ scientificName: 1 })
      .skip(filters.page * filters.limit)
      .limit(filters.limit)
      .toArray()) as unknown as TaxonDocument[]

    return {
      data,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages
    }
  } catch (error) {
    console.error('❌ Error querying taxa:', error)
    throw new Error(
      `Failed to query taxa: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Obtém contagem de taxa por reino
 */
export async function getTaxaCountByKingdom(): Promise<Record<string, number>> {
  const collection = await getCollection('dwc2json', 'taxa')

  if (!collection) {
    throw new Error('Taxa collection not available')
  }

  try {
    const pipeline = [
      {
        $match: {
          kingdom: { $exists: true, $ne: null },
          taxonomicStatus: 'NOME_ACEITO'
        }
      },
      {
        $group: {
          _id: '$kingdom',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]

    const results = await collection.aggregate(pipeline).toArray()

    const counts: Record<string, number> = {}
    for (const result of results) {
      counts[result._id] = result.count
    }

    return counts
  } catch (error) {
    console.error('❌ Error getting taxa count by kingdom:', error)
    throw new Error(
      `Failed to get taxa count by kingdom: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
