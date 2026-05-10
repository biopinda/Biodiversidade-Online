import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import {
  getInvasiveCountPerKingdom,
  getInvasiveTopFamilies,
  getInvasiveTopOrders,
  getOccurrenceCountPerKingdom,
  getTaxaCountPerFamilyByKingdom,
  getTaxaCountPerKingdom,
  getTaxaCountPerOrderByKingdom,
  getThreatenedCategoriesPerKingdom,
  getThreatenedCountPerKingdom,
  getTopCollectionsByKingdom
} from '../lib/mongo'

// Carregar variáveis de ambiente
config()

interface DashboardData {
  occurrences: {
    plantae: number | null
    fungi: number | null
    animalia: number | null
  }
  taxa: {
    plantae: number | null
    fungi: number | null
    animalia: number | null
  }
  threatened: {
    counts: {
      plantae: number | null
      fungi: number | null
      animalia: number | null
    }
    categories: {
      plantae: any[] | null
      fungi: any[] | null
      animalia: any[] | null
    }
  }
  invasive: {
    counts: {
      plantae: number | null
      fungi: number | null
      animalia: number | null
    }
    topOrders: any[] | null
    topFamilies: any[] | null
  }
  taxa_breakdown: {
    ordersAnimalia: any[] | null
    familiesPlantae: any[] | null
    ordersFungi: any[] | null
  }
  top_collections: {
    animalia: any[] | null
    plantae: any[] | null
    fungi: any[] | null
  }
  lastUpdated: string
}

export async function generateDashboardCache(): Promise<DashboardData> {
  console.log('Iniciando geração do cache do dashboard...')

  try {
    const [
      // Occurrences data
      occurrencesPlantae,
      occurrencesFungi,
      occurrencesAnimalia,
      // Taxa data
      taxaPlantae,
      taxaFungi,
      taxaAnimalia,
      // Threatened species data
      threatenedPlantae,
      threatenedFungi,
      threatenedAnimalia,
      // Threatened categories data
      threatenedCategoriesPlantae,
      threatenedCategoriesFungi,
      threatenedCategoriesAnimalia,
      // Invasive species data
      invasivePlantae,
      invasiveFungi,
      invasiveAnimalia,
      // Invasive top rankings
      invasiveTopOrdersAnimalia,
      invasiveTopFamiliesPlantae,
      // Taxa breakdown data
      taxaOrdersAnimalia,
      taxaFamiliesPlantae,
      taxaOrdersFungi,
      // Top collections data
      topCollectionsAnimalia,
      topCollectionsPlantae,
      topCollectionsFungi
    ] = await Promise.all([
      getOccurrenceCountPerKingdom('Plantae'),
      getOccurrenceCountPerKingdom('Fungi'),
      getOccurrenceCountPerKingdom('Animalia'),
      getTaxaCountPerKingdom('Plantae'),
      getTaxaCountPerKingdom('Fungi'),
      getTaxaCountPerKingdom('Animalia'),
      getThreatenedCountPerKingdom('Plantae'),
      getThreatenedCountPerKingdom('Fungi'),
      getThreatenedCountPerKingdom('Animalia'),
      getThreatenedCategoriesPerKingdom('Plantae'),
      getThreatenedCategoriesPerKingdom('Fungi'),
      getThreatenedCategoriesPerKingdom('Animalia'),
      getInvasiveCountPerKingdom('Plantae'),
      getInvasiveCountPerKingdom('Fungi'),
      getInvasiveCountPerKingdom('Animalia'),
      getInvasiveTopOrders('Animalia'),
      getInvasiveTopFamilies('Plantae'),
      getTaxaCountPerOrderByKingdom('Animalia'),
      getTaxaCountPerFamilyByKingdom('Plantae'),
      getTaxaCountPerOrderByKingdom('Fungi'),
      getTopCollectionsByKingdom('Animalia'),
      getTopCollectionsByKingdom('Plantae'),
      getTopCollectionsByKingdom('Fungi')
    ])

    const dashboardData: DashboardData = {
      occurrences: {
        plantae: occurrencesPlantae,
        fungi: occurrencesFungi,
        animalia: occurrencesAnimalia
      },
      taxa: {
        plantae: taxaPlantae,
        fungi: taxaFungi,
        animalia: taxaAnimalia
      },
      threatened: {
        counts: {
          plantae: threatenedPlantae,
          fungi: threatenedFungi,
          animalia: threatenedAnimalia
        },
        categories: {
          plantae: threatenedCategoriesPlantae,
          fungi: threatenedCategoriesFungi,
          animalia: threatenedCategoriesAnimalia
        }
      },
      invasive: {
        counts: {
          plantae: invasivePlantae,
          fungi: invasiveFungi,
          animalia: invasiveAnimalia
        },
        topOrders: invasiveTopOrdersAnimalia,
        topFamilies: invasiveTopFamiliesPlantae
      },
      taxa_breakdown: {
        ordersAnimalia: taxaOrdersAnimalia,
        familiesPlantae: taxaFamiliesPlantae,
        ordersFungi: taxaOrdersFungi
      },
      top_collections: {
        animalia: topCollectionsAnimalia,
        plantae: topCollectionsPlantae,
        fungi: topCollectionsFungi
      },
      lastUpdated: new Date().toISOString()
    }

    console.log('Cache do dashboard gerado com sucesso!')
    return dashboardData
  } catch (error) {
    console.error('Erro ao gerar cache do dashboard:', error)
    throw error
  }
}

export async function saveDashboardCache(
  data: DashboardData,
  filePath: string
): Promise<void> {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Salvar dados no arquivo JSON
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    console.log(`Cache salvo em: ${filePath}`)
  } catch (error) {
    console.error('Erro ao salvar cache:', error)
    throw error
  }
}

export async function loadDashboardCache(
  filePath: string
): Promise<DashboardData | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.log('Arquivo de cache não encontrado:', filePath)
      return null
    }

    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data) as DashboardData
  } catch (error) {
    console.error('Erro ao carregar cache:', error)
    return null
  }
}

async function main() {
  try {
    console.log('=== JOB DE CACHE DO DASHBOARD ===')
    console.log(`Iniciado em: ${new Date().toISOString()}`)

    const cacheFilePath = path.join(
      process.cwd(),
      'cache',
      'dashboard-data.json'
    )

    const data = await generateDashboardCache()
    await saveDashboardCache(data, cacheFilePath)

    console.log(`Job finalizado com sucesso em: ${new Date().toISOString()}`)
  } catch (error) {
    console.error('Erro no job de cache do dashboard:', error)
    process.exit(1)
  }
}

// Executar o job sempre que for chamado
main()
