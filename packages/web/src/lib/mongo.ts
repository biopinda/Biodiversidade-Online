import { type Collection, MongoClient } from 'mongodb'

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

const url =
  // Try different ways to get MONGO_URI
  (typeof process !== 'undefined' && process.env.MONGO_URI) ??
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.MONGO_URI) ??
  (typeof import.meta !== 'undefined' && import.meta.env?.MONGO_URI) ??
  // Fallback hardcoded for local development
  'mongodb://dwc2json:REDACTED_PASSWORD@192.168.1.10:27017/?authSource=admin&authMechanism=DEFAULT'

console.log('🔗 Using MongoDB URL:', url ? 'Found' : 'Not found')

if (!url) {
  console.error('❌ MONGO_URI environment variable is not defined')
  throw new Error(
    'Please define the MONGO_URI environment variable inside .env.local'
  )
}

// console.log('🔗 Connecting to MongoDB...')
const client = new MongoClient(url)

function connectClientWithTimeout(timeout = 5000) {
  return new Promise((resolve) => {
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

// State name harmonization mapping - comprehensive variations
const stateMapping: Record<string, string> = {
  // Norte
  AC: 'Acre',
  ACRE: 'Acre',
  Acre: 'Acre',
  acre: 'Acre',
  AP: 'Amapá',
  AMAPÁ: 'Amapá',
  AMAPA: 'Amapá',
  Amapá: 'Amapá',
  Amapa: 'Amapá',
  amapá: 'Amapá',
  amapa: 'Amapá',
  AM: 'Amazonas',
  AMAZONAS: 'Amazonas',
  Amazonas: 'Amazonas',
  amazonas: 'Amazonas',
  PA: 'Pará',
  PARÁ: 'Pará',
  PARA: 'Pará',
  Pará: 'Pará',
  Para: 'Pará',
  pará: 'Pará',
  para: 'Pará',
  RO: 'Rondônia',
  RONDÔNIA: 'Rondônia',
  RONDONIA: 'Rondônia',
  Rondônia: 'Rondônia',
  Rondonia: 'Rondônia',
  rondônia: 'Rondônia',
  rondonia: 'Rondônia',
  RR: 'Roraima',
  RORAIMA: 'Roraima',
  Roraima: 'Roraima',
  roraima: 'Roraima',
  TO: 'Tocantins',
  TOCANTINS: 'Tocantins',
  Tocantins: 'Tocantins',
  tocantins: 'Tocantins',

  // Nordeste
  AL: 'Alagoas',
  ALAGOAS: 'Alagoas',
  Alagoas: 'Alagoas',
  alagoas: 'Alagoas',
  BA: 'Bahia',
  BAHIA: 'Bahia',
  Bahia: 'Bahia',
  bahia: 'Bahia',
  CE: 'Ceará',
  CEARÁ: 'Ceará',
  CEARA: 'Ceará',
  Ceará: 'Ceará',
  Ceara: 'Ceará',
  ceará: 'Ceará',
  ceara: 'Ceará',
  MA: 'Maranhão',
  MARANHÃO: 'Maranhão',
  MARANHAO: 'Maranhão',
  Maranhão: 'Maranhão',
  Maranhao: 'Maranhão',
  maranhão: 'Maranhão',
  maranhao: 'Maranhão',
  PB: 'Paraíba',
  PARAÍBA: 'Paraíba',
  PARAIBA: 'Paraíba',
  Paraíba: 'Paraíba',
  Paraiba: 'Paraíba',
  paraíba: 'Paraíba',
  paraiba: 'Paraíba',
  PE: 'Pernambuco',
  PERNAMBUCO: 'Pernambuco',
  Pernambuco: 'Pernambuco',
  pernambuco: 'Pernambuco',
  PI: 'Piauí',
  PIAUÍ: 'Piauí',
  PIAUI: 'Piauí',
  Piauí: 'Piauí',
  Piaui: 'Piauí',
  piauí: 'Piauí',
  piaui: 'Piauí',
  RN: 'Rio Grande do Norte',
  'RIO GRANDE DO NORTE': 'Rio Grande do Norte',
  'Rio Grande do Norte': 'Rio Grande do Norte',
  'rio grande do norte': 'Rio Grande do Norte',
  'Rio grande do norte': 'Rio Grande do Norte',
  SE: 'Sergipe',
  SERGIPE: 'Sergipe',
  Sergipe: 'Sergipe',
  sergipe: 'Sergipe',

  // Centro-Oeste
  GO: 'Goiás',
  GOIÁS: 'Goiás',
  GOIAS: 'Goiás',
  Goiás: 'Goiás',
  Goias: 'Goiás',
  goiás: 'Goiás',
  goias: 'Goiás',
  MT: 'Mato Grosso',
  'MATO GROSSO': 'Mato Grosso',
  'Mato Grosso': 'Mato Grosso',
  'mato grosso': 'Mato Grosso',
  'Mato grosso': 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  'MATO GROSSO DO SUL': 'Mato Grosso do Sul',
  'Mato Grosso do Sul': 'Mato Grosso do Sul',
  'mato grosso do sul': 'Mato Grosso do Sul',
  'Mato grosso do sul': 'Mato Grosso do Sul',
  DF: 'Distrito Federal',
  'DISTRITO FEDERAL': 'Distrito Federal',
  'Distrito Federal': 'Distrito Federal',
  'distrito federal': 'Distrito Federal',
  'Distrito federal': 'Distrito Federal',

  // Sudeste
  ES: 'Espírito Santo',
  'ESPÍRITO SANTO': 'Espírito Santo',
  'ESPIRITO SANTO': 'Espírito Santo',
  'Espírito Santo': 'Espírito Santo',
  'Espirito Santo': 'Espírito Santo',
  'espírito santo': 'Espírito Santo',
  'espirito santo': 'Espírito Santo',
  'Espírito santo': 'Espírito Santo',
  'Espirito santo': 'Espírito Santo',
  MG: 'Minas Gerais',
  'MINAS GERAIS': 'Minas Gerais',
  'Minas Gerais': 'Minas Gerais',
  'minas gerais': 'Minas Gerais',
  'Minas gerais': 'Minas Gerais',
  RJ: 'Rio de Janeiro',
  'RIO DE JANEIRO': 'Rio de Janeiro',
  'Rio de Janeiro': 'Rio de Janeiro',
  'rio de janeiro': 'Rio de Janeiro',
  'Rio de janeiro': 'Rio de Janeiro',
  SP: 'São Paulo',
  'SÃO PAULO': 'São Paulo',
  'SAO PAULO': 'São Paulo',
  'São Paulo': 'São Paulo',
  'Sao Paulo': 'São Paulo',
  'são paulo': 'São Paulo',
  'sao paulo': 'São Paulo',
  'São paulo': 'São Paulo',
  'Sao paulo': 'São Paulo',

  // Sul
  PR: 'Paraná',
  PARANÁ: 'Paraná',
  PARANA: 'Paraná',
  Paraná: 'Paraná',
  Parana: 'Paraná',
  paraná: 'Paraná',
  parana: 'Paraná',
  RS: 'Rio Grande do Sul',
  'RIO GRANDE DO SUL': 'Rio Grande do Sul',
  'Rio Grande do Sul': 'Rio Grande do Sul',
  'rio grande do sul': 'Rio Grande do Sul',
  'Rio grande do sul': 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  'SANTA CATARINA': 'Santa Catarina',
  'Santa Catarina': 'Santa Catarina',
  'santa catarina': 'Santa Catarina',
  'Santa catarina': 'Santa Catarina'
}

function normalizeStateName(stateName: string): string {
  if (!stateName) return 'Unknown'
  const trimmed = stateName.trim()
  return stateMapping[trimmed] || trimmed
}

// MongoDB aggregation expression for state normalization
const createStateNormalizationExpression = () => {
  const conditions = Object.entries(stateMapping).map(([input, output]) => ({
    case: { $eq: ['$stateProvince', input] },
    then: output
  }))

  return {
    $switch: {
      branches: conditions,
      default: {
        $cond: {
          if: {
            $or: [
              { $eq: ['$stateProvince', null] },
              { $eq: ['$stateProvince', ''] },
              { $not: { $ifNull: ['$stateProvince', false] } }
            ]
          },
          then: null, // Will be filtered out
          else: '$stateProvince' // Keep original if not in mapping
        }
      }
    }
  }
}

export async function countOccurrenceRegions(filter: TaxaFilter = {}) {
  const startTime = Date.now()

  // Generate cache key based on filters
  const cacheKey = JSON.stringify(filter)
  const crypto = await import('crypto')
  const cacheKeyHash = crypto.createHash('md5').update(cacheKey).digest('hex')

  // Try to get from cache first
  const cache = await getCollection('dwc2json', 'occurrenceCache')
  if (cache) {
    const cached = await cache.findOne({ key: cacheKeyHash })
    if (cached && cached.data) {
      console.log(
        `⚡ Cache hit for occurrence query (${Date.now() - startTime}ms)`
      )
      return cached.data
    }
  }

  const occurrences = await getCollection('dwc2json', 'ocorrencias')
  if (!occurrences) return null

  // Build optimized match stage
  const matchStage: Record<string, unknown> = {}

  // Add all filters with optimized regex patterns
  Object.entries(filter).forEach(([key, value]) => {
    if (value && value.trim()) {
      const trimmedValue = value.trim()

      if (key === 'genus' || key === 'specificEpithet') {
        // Exact match for genus and specific epithet
        matchStage[key] = new RegExp(`^${trimmedValue}$`, 'i')
      } else {
        // Word boundary match for other taxonomic fields
        matchStage[key] = new RegExp(`\\b${trimmedValue}\\b`, 'i')
      }
    }
  })

  console.log('🔍 Optimized aggregation pipeline with filters:', matchStage)

  try {
    // Use optimized aggregation with timeout - process ALL records with stateProvince
    const pipeline = [
      // Match stage with index-friendly queries
      { $match: matchStage },

      {
        $facet: {
          total: [{ $count: 'count' }],
          byRegion: [
            // Use pre-computed normalized state expression
            {
              $addFields: {
                normalizedState: createStateNormalizationExpression()
              }
            },
            // Group by state
            {
              $group: {
                _id: '$normalizedState',
                count: { $sum: 1 }
              }
            },
            // Filter valid states
            {
              $match: {
                _id: { $exists: true, $nin: [null, '', 'Unknown'] }
              }
            },
            // Sort by count descending
            { $sort: { count: -1 } }
          ]
        }
      }
    ]

    const results = await occurrences
      .aggregate(pipeline, {
        maxTimeMS: 25000, // 25 second timeout
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
        console.warn('⚠️ Failed to cache result:', cacheError.message)
      }
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
    if (error.code === 50 || error.message.includes('timeout')) {
      console.log('⏰ Query timeout, attempting fallback...')

      try {
        // Fallback: just count total and get top 10 states
        const totalCount = await occurrences.countDocuments(matchStage, {
          maxTimeMS: 10000
        })

        const topStates = await occurrences
          .aggregate(
            [
              { $match: matchStage },
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
              { $sort: { count: -1 } },
              { $limit: 27 } // All Brazilian states
            ],
            { maxTimeMS: 15000 }
          )
          .toArray()

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

    throw error
  }
}
