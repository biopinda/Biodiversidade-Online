import { type Collection, MongoClient } from 'mongodb'
import process from 'node:process'

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
  kingdom?: string
  family?: string
}

export async function countTaxaRegions(filter: TaxaFilter = {}) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null

  const matchStage: Record<string, unknown> = {
    taxonomicStatus: /NOME[_ ]ACEITO/
  }

  if (filter.kingdom) {
    matchStage.kingdom = new RegExp(filter.kingdom, 'i')
  }
  if (filter.family) {
    matchStage.family = new RegExp(filter.family, 'i')
  }

  return await taxa
    .aggregate([
      {
        $match: matchStage
      },
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
    ])
    .toArray()
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

export async function getFamilyPerKingdom(kingdom: string) {
  const taxa = await getCollection('dwc2json', 'taxa')
  if (!taxa) return null
  return await taxa
    .aggregate([
      {
        $match: {
          kingdom: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
          taxonomicStatus: /NOME[_ ]ACEITO/,
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
          _id: kingdom.toLocaleLowerCase() === 'fungi' ? '$phylum' : '$family',
          count: {
            $count: {}
          }
        }
      }
    ])
    .toArray()
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
