import { type Collection, MongoClient } from 'mongodb'
import { createStateNormalizationExpression } from './stateNormalization'

// Debug environment variables
console.log('🔍 Debug env vars:', {
  nodeEnv: typeof process !== 'undefined' ? process.env.NODE_ENV : 'undefined',
  mongoFromProcess:
    typeof process !== 'undefined' ? process.env.MONGO_URI : 'undefined',
  mongoFromGlobal:
    typeof globalThis !== 'undefined' && globalThis.process?.env?.MONGO_URI,
  importMetaEnv:
    typeof import.meta !== 'undefined'
      ? import.meta.env?.MONGO_URI
      : 'undefined'
})

function getMongoUrl(): string {
  // Try different ways to get MONGO_URI
  const url =
    (typeof process !== 'undefined' && process.env.MONGO_URI) ??
    (typeof globalThis !== 'undefined' && globalThis.process?.env?.MONGO_URI) ??
    (typeof import.meta !== 'undefined' && import.meta.env?.MONGO_URI)

  console.log('🔗 Using MongoDB URL:', url ? 'Found' : 'Not found')

  if (!url) {
    console.error('❌ MONGO_URI environment variable is not defined')
    throw new Error(
      'Please define the MONGO_URI environment variable inside .env.local'
    )
  }

  return url
}

// Create client lazily to avoid connection issues at module load time
let client: MongoClient | null = null

function getClient(): MongoClient {
  if (!client) {
    const url = getMongoUrl()
    client = new MongoClient(url, {
      // Add connection options to improve reliability
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true
    })
  }
  return client
}

function connectClientWithTimeout(timeout = 5000) {
  return new Promise((resolve) => {
    const client = getClient()
    const timeoutTimer = setTimeout(() => {
      console.warn('⚠️  MongoDB connection timeout after', timeout, 'ms')
      resolve(false)
    }, timeout)
    client
      .connect()
      .then(
        () => {
          console.log('✅ MongoDB connected successfully')
          resolve(true)
        },
        (error) => {
          console.error('❌ MongoDB connection failed:', error.message)
          resolve(false)
        }
      )
      .finally(() => {
        clearTimeout(timeoutTimer)
      })
  })
}

export async function getCollection(dbName: string, collection: string) {
  try {
    if (!(await connectClientWithTimeout())) {
      console.warn(
        `⚠️  Could not connect to MongoDB for ${dbName}.${collection}`
      )
      return null
    }
    const client = getClient()
    return client.db(dbName).collection(collection) as Collection
  } catch (error) {
    console.error(`❌ Error getting collection ${dbName}.${collection}:`, error)
    return null
  }
}

export async function listTaxa(
  filter: Record<string, unknown> = {},
  _projection: Record<string, unknown> = {}
) {
  try {
    const taxa = await getCollection('dwc2json', 'taxa')
    if (!taxa) {
      console.warn('⚠️  Taxa collection not available')
      return []
    }
    return await taxa
      .find(filter)
      // .project(projection)
      .sort({ scientificName: 1 })
      .toArray()
  } catch (error) {
    console.error('❌ Error listing taxa:', error)
    return []
  }
}

export async function listOccurrences(
  filter: Record<string, unknown> = {},
  _projection: Record<string, unknown> = {}
) {
  try {
    const occurrences = await getCollection('dwc2json', 'ocorrencias')
    if (!occurrences) {
      console.warn('⚠️  Occurrences collection not available')
      return []
    }
    return await occurrences
      .find(filter)
      // .project(projection)
      .toArray()
  } catch (error) {
    console.error('❌ Error listing occurrences:', error)
    return []
  }
}

export async function listTaxaPaginated(
  filter: Record<string, unknown> = {},
  page = 0,
  _projection: Record<string, unknown> = {}
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  const total = await taxa.countDocuments(filter)
  const totalPages = Math.ceil(total / 50)
  const data = await taxa
    .find(filter)
    // .project(projection)
    .sort({ scientificName: 1 })
    .skip(page * 50)
    .limit(50)
    .toArray()
  return {
    data,
    total,
    totalPages
  }
}

export async function countTaxa(filter: Record<string, unknown> = {}) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  return await taxa.countDocuments(filter)
}

export interface TaxaFilter {
  [key: string]: string | RegExp
}

export async function countTaxaRegions(filter: TaxaFilter = {}) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null

  const matchStage: Record<string, unknown> = {
    taxonomicStatus: /NOME[_ ]ACEITO/
  }

  // Add all filters as case-insensitive regex
  Object.entries(filter).forEach(([key, value]) => {
    if (value) {
      if (key === 'genus' || key === 'specificEpithet') {
        matchStage[key] =
          value instanceof RegExp ? value : new RegExp(`^${value.trim()}$`, 'i')
      } else {
        matchStage[key] =
          value instanceof RegExp
            ? value
            : new RegExp(`\\b${value.trim()}\\b`, 'i')
      }
    }
  })

  const [result] = await taxa
    .aggregate([
      {
        $match: matchStage
      },
      {
        $facet: {
          total: [
            {
              $count: 'count'
            }
          ],
          byRegion: [
            {
              $unwind: {
                path: '$distribution.occurrence'
              }
            },
            {
              $group: {
                _id: '$distribution.occurrence',
                count: {
                  $count: {}
                }
              }
            }
          ]
        }
      }
    ])
    .toArray()

  if (!result) {
    return {
      total: 0,
      regions: []
    }
  }

  return {
    total: result.total[0]?.count || 0,
    regions: result.byRegion
  }
}

export async function getTaxonomicStatusPerKingdom(kingdom: string) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  return await taxa
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase()
        }
      },
      {
        $group: {
          _id: {
            $ifNull: ['$taxonomicStatus', '$nomenclaturalStatus']
          },
          count: {
            $count: {}
          }
        }
      }
    ])
    .toArray()
}

type Node = {
  name: string
}
type Leaf = Node & {
  type: 'url'
  url: string
}
type Branch = Node & {
  type: 'folder'
  children: Array<Leaf | Branch>
}

function splitNodeAlphabetically(node: Branch): Branch {
  const sortedChildren = node.children.sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '')
  )

  // If already small enough, return as is
  if (sortedChildren.length <= 20) {
    // Process children that are branches recursively
    const processedChildren = sortedChildren.map((child) => {
      if (child.type === 'folder') {
        return splitNodeAlphabetically(child as Branch)
      }
      return child
    })

    return {
      ...node,
      children: processedChildren
    }
  }

  const nGroups = Math.min(Math.ceil(sortedChildren.length / 20), 26)
  const lettersInEachGroup = Math.ceil(26 / nGroups)
  const groupNames = new Array(nGroups)
    .fill(0)
    .map(
      (_, i) =>
        `${String.fromCharCode(65 + i * lettersInEachGroup)} - ${String.fromCharCode(Math.min(65 + (i + 1) * lettersInEachGroup - 1, 90))}`
    )
  const groups: Branch[] = new Array(nGroups).fill(0).map((_, i) => ({
    name: groupNames[i]!,
    type: 'folder' as const,
    children: [] as Array<Leaf | Branch>
  }))

  const output: Branch = {
    ...node,
    children: groups
  }

  sortedChildren.forEach((child) => {
    const firstLetter = child.name?.charAt(0)?.toLowerCase() ?? 'z'
    const groupIndex = Math.floor(
      (firstLetter.charCodeAt(0) - 97) / lettersInEachGroup
    )

    // Make sure we have a valid group index
    if (groupIndex >= 0 && groupIndex < groups.length) {
      // Process the child if it's a branch before adding it to a group
      if (child.type === 'folder') {
        groups[groupIndex]?.children.push(
          splitNodeAlphabetically(child as Branch)
        )
      } else {
        groups[groupIndex]?.children.push(child)
      }
    }
  })

  return output
}

export async function getTree() {
  const taxaCollection = await getCollection('dwc2json', 'taxa')
  const taxa = await taxaCollection
    ?.find(
      {
        taxonomicStatus: 'NOME_ACEITO'
      },
      {
        projection: {
          _id: 0,
          kingdom: 1,
          phylum: 1,
          class: 1,
          order: 1,
          family: 1,
          genus: 1,
          specificEpithet: 1,
          scientificName: 1,
          taxonID: 1
        }
      }
    )
    .toArray()
  const tree = taxa?.reduce(
    (acc, taxon) => {
      let kingdomIndex = acc.children.findIndex(
        (child) => child.name === taxon.kingdom
      )
      if (kingdomIndex === -1) {
        kingdomIndex = acc.children.length
        acc.children.push({
          name: taxon.kingdom,
          type: 'folder',
          children: []
        } as Branch)
      }
      const kingdom = acc.children[kingdomIndex] as Branch
      let phylumIndex = kingdom.children.findIndex(
        (child) => child.name === taxon.phylum
      )
      if (phylumIndex === -1) {
        phylumIndex = kingdom.children.length
        kingdom.children.push({
          name: taxon.phylum,
          type: 'folder',
          children: []
        } as Branch)
      }
      const phylum = kingdom.children[phylumIndex] as Branch
      let classIndex = phylum.children.findIndex(
        (child) => child.name === taxon.class
      )
      if (classIndex === -1) {
        classIndex = phylum.children.length
        phylum.children.push({
          name: taxon.class,
          type: 'folder',
          children: []
        } as Branch)
      }
      const classNode = phylum.children[classIndex] as Branch
      let orderIndex = classNode.children.findIndex(
        (child) => child.name === taxon.order
      )
      if (orderIndex === -1) {
        orderIndex = classNode.children.length
        classNode.children.push({
          name: taxon.order,
          type: 'folder',
          children: []
        } as Branch)
      }
      const orderNode = classNode.children[orderIndex] as Branch
      let familyIndex = orderNode.children.findIndex(
        (child) => child.name === taxon.family
      )
      if (familyIndex === -1) {
        familyIndex = orderNode.children.length
        orderNode.children.push({
          name: taxon.family,
          type: 'folder',
          children: []
        } as Branch)
      }
      const family = orderNode.children[familyIndex] as Branch
      let genusIndex = family.children.findIndex(
        (child) => child.name === taxon.genus
      )
      if (genusIndex === -1) {
        genusIndex = family.children.length
        family.children.push({
          name: taxon.genus,
          type: 'folder',
          children: []
        } as Branch)
      }
      const genus = family.children[genusIndex] as Branch
      genus.children.push({
        name: taxon.scientificName,
        type: 'url',
        url: `/taxon/${taxon.kingdom.slice(0, 1)}${taxon.taxonID}`
      } as Leaf)
      return acc
    },
    { name: 'Árvore da vida', type: 'folder', children: [] } as Branch
  )

  // Apply splitNodeAlphabetically to the entire tree
  // This will recursively process all branches
  return tree ? splitNodeAlphabetically(tree) : null
}

export async function getFamilyPerKingdom(kingdom: string) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  return await taxa
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          taxonomicStatus: 'NOME_ACEITO',
          taxonRank: 'ESPECIE'
        }
      },
      {
        $addFields: {
          family: {
            $cond: {
              if: { $eq: ['$higherClassification', 'Algas'] },
              then: { $concat: ['[Algae]: ', '$class'] },
              else: '$family'
            }
          }
        }
      },
      {
        $group: {
          // _id: kingdom.toLocaleLowerCase() === 'fungi' ? '$phylum' : '$family',
          _id: '$family',
          count: {
            $count: {}
          }
        }
      }
    ])
    .toArray()
}

export async function getOccurrenceCountPerKingdom(kingdom: string) {
  const occurrences = await getCollection('dwc2json', 'ocorrencias')
  if (!occurrences) return null

  const result = await occurrences.countDocuments({
    kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase()
  })

  return result
}

export async function getTaxaCountPerKingdom(kingdom: string) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null

  const result = await taxa.countDocuments({
    kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
    taxonomicStatus: 'NOME_ACEITO'
  })

  return result
}

export async function getThreatenedCountPerKingdom(kingdom: string) {
  if (kingdom.toLowerCase() === 'animalia') {
    // Kingdom Animalia está no documento faunaAmeacada
    const fauna = await getCollection('dwc2json', 'faunaAmeacada')
    if (!fauna) return null
    // Excluir categoria "Não Avaliada (NE)"
    return await fauna.countDocuments({
      threatStatus: { $ne: 'Não Avaliada (NE)' }
    })
  } else if (kingdom.toLowerCase() === 'plantae') {
    // Kingdom Plantae está no documento cncfloraPlantae
    const flora = await getCollection('dwc2json', 'cncfloraPlantae')
    if (!flora) return null
    // Excluir categoria "NE"
    return await flora.countDocuments({
      'Categoria de Risco': { $ne: 'NE' }
    })
  } else if (kingdom.toLowerCase() === 'fungi') {
    // Kingdom Fungi está no documento cncfloraFungi
    const flora = await getCollection('dwc2json', 'cncfloraFungi')
    if (!flora) return null
    // Excluir categoria "NE"
    return await flora.countDocuments({
      'Categoria de Risco': { $ne: 'NE' }
    })
  }

  return null
}

export async function getThreatenedCategoriesPerKingdom(kingdom: string) {
  if (kingdom.toLowerCase() === 'animalia') {
    const fauna = await getCollection('dwc2json', 'faunaAmeacada')
    if (!fauna) return null
    return await fauna
      .aggregate([
        {
          $match: { threatStatus: { $ne: 'Não Avaliada (NE)' } }
        },
        {
          $group: {
            _id: '$threatStatus',
            count: { $count: {} }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray()
  } else if (kingdom.toLowerCase() === 'plantae') {
    const flora = await getCollection('dwc2json', 'cncfloraPlantae')
    if (!flora) return null

    return await flora
      .aggregate([
        {
          $match: {
            'Categoria de Risco': { $exists: true, $ne: null, $nin: ['NE'] }
          }
        },
        {
          $group: {
            _id: '$Categoria de Risco',
            count: { $count: {} }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray()
  } else if (kingdom.toLowerCase() === 'fungi') {
    const flora = await getCollection('dwc2json', 'cncfloraFungi')
    if (!flora) return null

    return await flora
      .aggregate([
        {
          $match: {
            'Categoria de Risco': { $exists: true, $ne: null, $nin: ['NE'] }
          }
        },
        {
          $group: {
            _id: '$Categoria de Risco',
            count: { $count: {} }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray()
  }

  return null
}

export async function getInvasiveCountPerKingdom(kingdom: string) {
  const invasive = await getCollection('dwc2json', 'invasoras')
  if (!invasive) return null

  const result = await invasive.countDocuments({
    kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase()
  })

  return result
}

export async function getInvasiveTopOrders(kingdom: string, limit = 10) {
  const invasive = await getCollection('dwc2json', 'invasoras')
  if (!invasive) return null

  // The invasoras collection uses 'oorder' field for taxonomic order
  const result = await invasive
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          oorder: { $exists: true, $ne: null, $not: { $eq: '' } }
        }
      },
      {
        $group: {
          _id: '$oorder',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      }
    ])
    .toArray()

  return result
}

export async function getInvasiveTopFamilies(kingdom: string, limit = 10) {
  const invasive = await getCollection('dwc2json', 'invasoras')
  if (!invasive) return null

  const result = await invasive
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          family: { $exists: true, $ne: null, $not: { $eq: '' } }
        }
      },
      {
        $group: {
          _id: '$family',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      }
    ])
    .toArray()

  return result
}

export async function getTaxaCountPerOrderByKingdom(
  kingdom: string,
  limit = 10
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null

  const result = await taxa
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          taxonomicStatus: 'NOME_ACEITO',
          order: { $exists: true, $ne: null, $not: { $eq: '' } }
        }
      },
      {
        $group: {
          _id: '$order',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      }
    ])
    .toArray()

  return result
}

export async function getTaxaCountPerFamilyByKingdom(
  kingdom: string,
  limit = 10
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null

  const result = await taxa
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          taxonomicStatus: 'NOME_ACEITO',
          family: { $exists: true, $ne: null, $not: { $eq: '' } }
        }
      },
      {
        $addFields: {
          family: {
            $cond: {
              if: { $eq: ['$higherClassification', 'Algas'] },
              then: { $concat: ['[Algae]: ', '$class'] },
              else: '$family'
            }
          }
        }
      },
      {
        $group: {
          _id: '$family',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      }
    ])
    .toArray()

  return result
}

export async function getTopCollectionsByKingdom(kingdom: string, limit = 10) {
  const occurrences = await getCollection('dwc2json', 'ocorrencias')
  if (!occurrences) return null

  const result = await occurrences
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          rightsHolder: { $exists: true, $ne: null, $not: { $eq: '' } }
        }
      },
      {
        $group: {
          _id: '$rightsHolder',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      }
    ])
    .toArray()

  return result
}

export async function getTaxon(
  kingdom: 'Plantae' | 'Fungi' | 'Animalia',
  id: string,
  includeOccurrences = false
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  return includeOccurrences
    ? (
        await taxa
          .aggregate([
            {
              $match: {
                kingdom,
                taxonID: id
              }
            },
            {
              $lookup: {
                from: 'ocorrencias',
                localField: 'scientificName',
                foreignField: 'scientificName',
                as: 'occurrences'
              }
            }
          ])
          .toArray()
      )[0]
    : await taxa.findOne({ kingdom, taxonID: id })
}

// Funções para o Calendário Fenológico

export async function getCalFenoData(filter: Record<string, any> = {}) {
  try {
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) {
      console.warn('⚠️  calFeno view not available')
      return []
    }

    // A view calFeno já filtra plantas com dados de floração
    const baseFilter = {
      ...filter
    }

    return await calFeno.find(baseFilter).toArray()
  } catch (error) {
    console.error('❌ Error querying phenological data:', error)
    return []
  }
}

export async function getCalFenoFamilies() {
  try {
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) return []

    const families = await calFeno.distinct('family', {})
    return families.filter((f) => f && f.trim() !== '').sort()
  } catch (error) {
    console.error('❌ Error getting families:', error)
    return []
  }
}

export async function getCalFenoGenera(family: string) {
  try {
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) return []

    const genera = await calFeno.distinct('genus', {
      family: family
    })
    return genera.filter((g) => g && g.trim() !== '').sort()
  } catch (error) {
    console.error('❌ Error getting genera:', error)
    return []
  }
}

export async function getCalFenoSpecies(family: string, genus: string) {
  try {
    const calFeno = await getCollection('dwc2json', 'calFeno')
    if (!calFeno) return []

    const species = await calFeno.distinct('canonicalName', {
      family: family,
      genus: genus
    })
    return species.filter((s) => s && s.trim() !== '').sort()
  } catch (error) {
    console.error('❌ Error getting species:', error)
    return []
  }
}

export function generatePhenologicalHeatmap(occurrences: any[]) {
  const monthCounts = Array(12).fill(0)

  occurrences.forEach((occ) => {
    const month = parseInt(occ.month)
    if (month >= 1 && month <= 12) {
      monthCounts[month - 1] += 1
    }
  })

  const maxCount = Math.max(...monthCounts)

  return monthCounts.map((count, index) => ({
    month: index + 1,
    monthName: [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez'
    ][index],
    count,
    intensity: maxCount > 0 ? count / maxCount : 0
  }))
}

// Harmonização de estados movida para util: stateNormalization.ts

export async function countOccurrenceRegions(
  filter: TaxaFilter = {},
  forceRefresh = false
) {
  const startTime = Date.now()

  // Generate cache key based on filters
  const cacheKey = JSON.stringify(filter)
  const crypto = await import('crypto')
  const cacheKeyHash = crypto.createHash('md5').update(cacheKey).digest('hex')

  // Get cache collection reference
  const cache = await getCollection('dwc2json', 'occurrenceCache')

  // Try to get from cache first (unless force refresh is requested)
  if (!forceRefresh && cache) {
    try {
      const cached = await cache.findOne({ key: cacheKeyHash })
      if (cached && cached.data) {
        console.log(
          `⚡ Cache hit for occurrence query (${Date.now() - startTime}ms)`
        )
        return cached.data
      }
    } catch (cacheError) {
      console.warn(
        '⚠️ Failed to read from cache, proceeding with database query:',
        cacheError
      )
    }
  }

  const occurrences = await getCollection('dwc2json', 'ocorrencias')
  if (!occurrences) return null

  // Build optimized match stage
  const matchStage: Record<string, unknown> = {}

  // Add all filters with optimized regex patterns
  Object.entries(filter).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      const trimmedValue = value.trim()

      if (key === 'genus' || key === 'specificEpithet') {
        // Exact match for genus and specific epithet
        matchStage[key] = new RegExp(`^${trimmedValue}$`, 'i')
      } else {
        // Word boundary match for other taxonomic fields
        matchStage[key] = new RegExp(`\\b${trimmedValue}\\b`, 'i')
      }
    } else if (value instanceof RegExp) {
      matchStage[key] = value
    }
  })

  console.log('🔍 Optimized aggregation pipeline with filters:', matchStage)

  try {
    // Use statistical sampling only when no filters are applied (dashboard view)
    // When filters are applied, use full aggregation for accuracy
    const useStatisticalSampling = Object.keys(matchStage).length === 0

    let pipeline

    if (useStatisticalSampling) {
      // Use optimized aggregation for dashboard queries
      pipeline = [
        {
          $match: {
            $and: [
              {
                country: {
                  $in: [
                    'Brasil',
                    'brasil',
                    'BRASIL',
                    'Brazil',
                    'brazil',
                    'BRAZIL'
                  ]
                }
              },
              createBrazilianStateFilter()
            ]
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byRegion: [
              {
                $addFields: {
                  normalizedState: createStateNormalizationExpression()
                }
              },
              {
                $group: {
                  _id: '$normalizedState',
                  count: { $sum: 1 }
                }
              },
              {
                $match: {
                  _id: { $exists: true, $nin: [null, '', 'Unknown'] }
                }
              },
              { $sort: { count: -1 } }
            ]
          }
        }
      ]
    } else {
      // Use optimized aggregation for filtered queries
      pipeline = [
        {
          $match: {
            $and: [
              matchStage,
              {
                country: {
                  $in: [
                    'Brasil',
                    'brasil',
                    'BRASIL',
                    'Brazil',
                    'brazil',
                    'BRAZIL'
                  ]
                }
              },
              createBrazilianStateFilter()
            ]
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byRegion: [
              {
                $addFields: {
                  normalizedState: createStateNormalizationExpression()
                }
              },
              {
                $group: {
                  _id: '$normalizedState',
                  count: { $sum: 1 }
                }
              },
              {
                $match: {
                  _id: { $exists: true, $nin: [null, '', 'Unknown'] }
                }
              },
              { $sort: { count: -1 } }
            ]
          }
        }
      ]
    }

    console.log(
      `🔍 Using ${useStatisticalSampling ? 'statistical sampling' : 'full aggregation'} strategy`
    )

    const results = await occurrences
      .aggregate(pipeline, {
        maxTimeMS: 120000,
        allowDiskUse: true // Allow disk usage for large datasets
      })
      .toArray()

    const result = results[0]
    if (!result) {
      console.warn('⚠️ No result from aggregation pipeline')
      return { total: 0, regions: [] }
    }

    const total = result.total[0]?.count || 0
    const regions = result.byRegion || []

    const responseData = { total, regions }

    // Cache the result for future requests
    if (cache) {
      try {
        await cache.replaceOne(
          { key: cacheKeyHash },
          {
            key: cacheKeyHash,
            data: responseData,
            createdAt: new Date(),
            filters: filter
          },
          { upsert: true }
        )
        console.log('💾 Result cached successfully')
      } catch (cacheError) {
        if (
          cacheError &&
          typeof cacheError === 'object' &&
          'message' in cacheError
        ) {
          console.warn(
            '⚠️ Failed to cache result:',
            (cacheError as { message?: string }).message
          )
        } else {
          console.warn('⚠️ Failed to cache result:', cacheError)
        }
      }
    } else {
      console.warn('⚠️ Cache collection not available, skipping cache write')
    }

    const queryTime = Date.now() - startTime
    console.log(
      `✅ Optimized aggregation completed: ${total} total, ${regions.length} regions (${queryTime}ms)`
    )

    return responseData
  } catch (error) {
    const queryTime = Date.now() - startTime
    console.error(`❌ Aggregation error (${queryTime}ms):`, error)

    // If timeout, try a simpler query
    if (
      typeof error === 'object' &&
      error !== null &&
      ('code' in error || 'message' in error)
    ) {
      const err = error as { code?: number; message?: string }
      if (err.code === 50 || (err.message && err.message.includes('timeout'))) {
        console.log('⏰ Query timeout, attempting fallback...')

        try {
          console.log('🚀 Attempting ultra-fast fallback with sampling...')

          // Ultra-fast fallback: use small sample for quick results
          const sampleSize =
            Object.keys(matchStage).length === 0 ? 50000 : 10000

          const fallbackPipeline = [
            {
              $match: {
                country: {
                  $in: [
                    'Brasil',
                    'brasil',
                    'BRASIL',
                    'Brazil',
                    'brazil',
                    'BRAZIL'
                  ]
                },
                stateProvince: { $exists: true, $nin: [null, '', 'Unknown'] }
              }
            },
            { $sample: { size: sampleSize } },
            {
              $facet: {
                total: [
                  { $count: 'sampleCount' },
                  {
                    $project: {
                      count: {
                        $multiply: [
                          '$sampleCount',
                          220 // More conservative estimate for fallback
                        ]
                      }
                    }
                  }
                ],
                byRegion: [
                  {
                    $addFields: {
                      normalizedState: createStateNormalizationExpression()
                    }
                  },
                  {
                    $group: {
                      _id: '$normalizedState',
                      count: { $sum: 1 }
                    }
                  },
                  {
                    $match: {
                      _id: { $exists: true, $nin: [null, '', 'Unknown'] }
                    }
                  },
                  {
                    $project: {
                      _id: 1,
                      count: {
                        $multiply: [
                          '$count',
                          220 // More conservative estimate for fallback
                        ]
                      }
                    }
                  },
                  { $sort: { count: -1 } },
                  { $limit: 27 }
                ]
              }
            }
          ]

          const fallbackResults = await occurrences
            .aggregate(fallbackPipeline, { maxTimeMS: 8000 })
            .toArray()

          const fallbackResult = fallbackResults[0]
          const totalCount = fallbackResult?.total[0]?.count || 0
          const topStates = fallbackResult?.byRegion || []

          const fallbackData = {
            total: totalCount,
            regions: topStates
          }

          console.log(
            `⚡ Fallback query completed: ${totalCount} total, ${topStates.length} regions`
          )
          return fallbackData
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError)
          throw new Error(
            'Consulta demorou muito para responder. Tente filtros mais específicos.'
          )
        }
      }
    }

    throw error
  }
}

// Lista de estados brasileiros válidos para filtragem
const validBrazilianStates = [
  'Acre',
  'Amapá',
  'Amazonas',
  'Pará',
  'Rondônia',
  'Roraima',
  'Tocantins',
  'Alagoas',
  'Bahia',
  'Ceará',
  'Maranhão',
  'Paraíba',
  'Pernambuco',
  'Piauí',
  'Rio Grande do Norte',
  'Sergipe',
  'Goiás',
  'Mato Grosso',
  'Mato Grosso do Sul',
  'Distrito Federal',
  'Espírito Santo',
  'Minas Gerais',
  'Rio de Janeiro',
  'São Paulo',
  'Paraná',
  'Rio Grande do Sul',
  'Santa Catarina'
]

// Lista de variações possíveis dos estados brasileiros (com/sempre acento)
const brazilianStateVariations = [
  // Abreviações oficiais
  'ac',
  'ap',
  'am',
  'pa',
  'ro',
  'rr',
  'to',
  'al',
  'ba',
  'ce',
  'ma',
  'pb',
  'pe',
  'pi',
  'rn',
  'se',
  'go',
  'mt',
  'ms',
  'df',
  'es',
  'mg',
  'rj',
  'sp',
  'pr',
  'rs',
  'sc',
  // Nomes completos (com acento)
  'acre',
  'amapá',
  'amazonas',
  'pará',
  'rondônia',
  'roraima',
  'tocantins',
  'alagoas',
  'bahia',
  'ceará',
  'maranhão',
  'paraíba',
  'pernambuco',
  'piauí',
  'rio grande do norte',
  'sergipe',
  'goiás',
  'mato grosso',
  'mato grosso do sul',
  'distrito federal',
  'espírito santo',
  'minas gerais',
  'rio de janeiro',
  'são paulo',
  'paraná',
  'rio grande do sul',
  'santa catarina',
  // Nomes completos (sem acento)
  'amapa',
  'para',
  'rondonia',
  'goias',
  'maranhao',
  'paraiba',
  'piaui',
  'espirito santo',
  'sao paulo',
  'parana',
  'ceara'
]

/**
 * Gera condição MongoDB para filtrar apenas ocorrências com stateProvince válido brasileiro
 */
function createBrazilianStateFilter() {
  return {
    $and: [
      { stateProvince: { $exists: true, $ne: null } },
      { stateProvince: { $ne: '' } },
      {
        $or: [
          // Estado já está na forma canônica
          { stateProvince: { $in: validBrazilianStates } },
          // Estado está em alguma variação conhecida (case insensitive)
          {
            $expr: {
              $in: [
                { $toLower: { $trim: { input: '$stateProvince' } } },
                brazilianStateVariations
              ]
            }
          }
        ]
      }
    ]
  }
}
