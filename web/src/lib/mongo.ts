import { type Collection, MongoClient } from 'mongodb'

const url =
  // @ts-ignore astro stuff
  import.meta.env.MONGO_URI ??
  // @ts-ignore ignore node stuff
  process.env.MONGO_URI
if (!url) {
  throw new Error(
    'Please define the MONGO_URI environment variable inside .env.local'
  )
}
const client = new MongoClient(url)

function connectClientWithTimeout(timeout = 5000) {
  return new Promise((resolve) => {
    const timeoutTimer = setTimeout(() => {
      resolve(false)
    }, timeout)
    client
      .connect()
      .then(
        () => {
          resolve(true)
        },
        () => {
          resolve(false)
        }
      )
      .finally(() => {
        clearTimeout(timeoutTimer)
      })
  })
}

async function getCollection(dbName: string, collection: string) {
  if (!(await connectClientWithTimeout())) {
    return null
  }
  return client.db(dbName).collection(collection) as Collection
}

export async function listTaxa(
  filter: Record<string, unknown> = {},
  _projection: Record<string, unknown> = {}
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  return await taxa
    .find(filter)
    // .project(projection)
    .sort({ scientificName: 1 })
    .toArray()
}

export async function listOccurrences(
  filter: Record<string, unknown> = {},
  _projection: Record<string, unknown> = {}
) {
  const occurrences = await getCollection('dwc2json', 'ocorrencias')
  if (!occurrences) return null
  return await occurrences
    .find(filter)
    // .project(projection)
    .toArray()
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
    const fauna = await getCollection('dwc2json', 'faunaAmeacada')
    if (!fauna) return null
    // Tenta diferentes variações do campo kingdom e conta todos se não encontrar
    const kingdomVariations = [
      kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
      kingdom.toUpperCase(),
      kingdom.toLowerCase()
    ]
    
    let count = 0
    for (const variation of kingdomVariations) {
      const result = await fauna.countDocuments({ kingdom: variation })
      if (result > 0) {
        count = result
        break
      }
    }
    
    // Se não encontrou por kingdom, conta todos os documentos
    if (count === 0) {
      count = await fauna.countDocuments({})
    }
    
    return count
  } else if (kingdom.toLowerCase() === 'plantae') {
    const flora = await getCollection('dwc2json', 'cncflora2022')
    if (!flora) return null
    
    // Tenta diferentes variações do campo kingdom e conta todos se não encontrar
    const kingdomVariations = [
      kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
      kingdom.toUpperCase(),
      kingdom.toLowerCase()
    ]
    
    let count = 0
    for (const variation of kingdomVariations) {
      const result = await flora.countDocuments({ kingdom: variation })
      if (result > 0) {
        count = result
        break
      }
    }
    
    // Se não encontrou por kingdom, conta todos os documentos
    if (count === 0) {
      count = await flora.countDocuments({})
    }
    
    return count
  } else if (kingdom.toLowerCase() === 'fungi') {
    // Assumindo que não há dados específicos para Fungi ameaçados
    return 0
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
