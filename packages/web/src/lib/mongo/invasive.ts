import { getCollection } from './connection'

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
