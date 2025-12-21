/**
 * Conservation Units Loader
 * Loads data from ICMBio and state environmental agencies
 */

import { MongoClient } from 'mongodb'
import { logger } from '@/lib/logger'

export interface ConservationUnit {
  _id?: string
  name: string
  designationType: string
  managementStatus?: string
  geometry?: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][][] | number[][][]
  }
  area?: number
  jurisdiction?: string
  jurisdictionCode?: string
  managingAgency?: string
  creationDate?: Date
  lastUpdated: Date
}

export interface ICMBioUCResponse {
  nome: string
  tipo: string
  categoria: string
  areaKm2: number
  esfera: string
  órgãoGestor: string
  dataCriação?: string
  geometria?: {
    type: string
    coordinates: number[][][][]
  }
}

export async function loadConservationUnits(
  client: MongoClient,
  dbName: string
): Promise<void> {
  const db = client.db(dbName)
  const collection = db.collection<ConservationUnit>('conservation_units')

  try {
    logger.info('Starting conservation units load', {}, 'icmbio')

    // Create spatial index for geographic queries
    await collection.createIndex({ 'geometry': '2dsphere' })
    await collection.createIndex({ 'jurisdictionCode': 1 })
    await collection.createIndex({ 'designationType': 1 })

    // Load from ICMBio and state agencies
    const ucData = await fetchICMBioConservationUnits()

    if (ucData.length === 0) {
      logger.warn('No conservation units data from ICMBio', {}, 'icmbio')
      return
    }

    // Batch insert/update conservation units
    const bulkOps = ucData.map((item) => ({
      updateOne: {
        filter: { name: item.name },
        update: {
          $set: {
            name: item.name,
            designationType: item.tipo,
            managementStatus: mapStatus(item.categoria),
            area: item.areaKm2,
            jurisdiction: mapJurisdiction(item.esfera),
            jurisdictionCode: extractStateCode(item.esfera),
            managingAgency: item.órgãoGestor,
            creationDate: item.dataCriação
              ? new Date(item.dataCriação)
              : undefined,
            geometry: item.geometria || undefined,
            lastUpdated: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps)
      logger.info('Conservation units loaded', {
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        total: bulkOps.length
      })
    }
  } catch (error) {
    logger.error(
      'Error loading conservation units',
      error instanceof Error ? error : new Error(String(error)),
      { source: 'icmbio' }
    )
    throw error
  }
}

/**
 * Fetch conservation units from ICMBio and state agencies
 * This is a mock implementation - replace with actual API/data integration
 */
async function fetchICMBioConservationUnits(): Promise<ICMBioUCResponse[]> {
  try {
    // Mock data for demonstration
    // In production, fetch from: https://www.icmbio.gov.br/portal/unidades-de-conservacao
    return [
      {
        nome: 'Parque Nacional da Amazônia',
        tipo: 'National Park',
        categoria: 'IUCN II',
        areaKm2: 3300,
        esfera: 'Federal',
        órgãoGestor: 'ICMBio',
        dataCriação: '1974-02-28',
        geometria: undefined
      },
      {
        nome: 'Reserva Biológica do Cuieiras',
        tipo: 'Biological Reserve',
        categoria: 'IUCN Ia',
        areaKm2: 881,
        esfera: 'Federal',
        órgãoGestor: 'ICMBio',
        dataCriação: '1989-11-20',
        geometria: undefined
      },
      {
        nome: 'Parque Estadual da Serra da Canastra',
        tipo: 'State Park',
        categoria: 'IUCN II',
        areaKm2: 715,
        esfera: 'State - MG',
        órgãoGestor: 'Instituto Estadual de Florestas',
        dataCriação: '1972-04-12',
        geometria: undefined
      }
    ]
  } catch (error) {
    logger.warn('Failed to fetch from ICMBio, using fallback', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

/**
 * Map UC category codes to management status
 */
function mapStatus(categoria: string): string {
  const statusMap: Record<string, string> = {
    'IUCN Ia': 'Strict Protection',
    'IUCN Ib': 'Wilderness Area',
    'IUCN II': 'National/State Park',
    'IUCN III': 'Natural Monument',
    'IUCN IV': 'Habitat Management',
    'IUCN V': 'Protected Landscape',
    'IUCN VI': 'Managed Use'
  }
  return statusMap[categoria] || 'Protected Area'
}

/**
 * Map Brazilian administrative units to jurisdiction string
 */
function mapJurisdiction(esfera: string): string {
  if (esfera.includes('Federal')) return 'Federal'
  if (esfera.includes('State')) return 'State'
  if (esfera.includes('Municipal')) return 'Municipal'
  if (esfera.includes('Private')) return 'Private'
  return 'Unknown'
}

/**
 * Extract state code from jurisdiction string (e.g., "State - MG" → "31")
 */
function extractStateCode(esfera: string): string {
  const stateCodeMap: Record<string, string> = {
    AC: '12', // Acre
    AL: '27', // Alagoas
    AP: '16', // Amapá
    AM: '13', // Amazonas
    BA: '29', // Bahia
    CE: '23', // Ceará
    DF: '53', // Distrito Federal
    ES: '32', // Espírito Santo
    GO: '52', // Goiás
    MA: '21', // Maranhão
    MT: '51', // Mato Grosso
    MS: '50', // Mato Grosso do Sul
    MG: '31', // Minas Gerais
    PA: '15', // Pará
    PB: '25', // Paraíba
    PR: '41', // Paraná
    PE: '26', // Pernambuco
    PI: '22', // Piauí
    RJ: '33', // Rio de Janeiro
    RN: '24', // Rio Grande do Norte
    RS: '43', // Rio Grande do Sul
    RO: '11', // Rondônia
    RR: '14', // Roraima
    SC: '42', // Santa Catarina
    SP: '35', // São Paulo
    SE: '28', // Sergipe
    TO: '17' // Tocantins
  }

  // Extract state abbreviation from string like "State - MG"
  const match = esfera.match(/[A-Z]{2}/)
  if (match) {
    return stateCodeMap[match[0]] || ''
  }

  return ''
}
