import { getCollection } from './connection'

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
    // Kingdom Plantae está no documento plantaeAmeacada
    const flora = await getCollection('dwc2json', 'plantaeAmeacada')
    if (!flora) return null
    // Excluir categoria "NE"
    return await flora.countDocuments({
      'Categoria de Risco': { $ne: 'NE' }
    })
  } else if (kingdom.toLowerCase() === 'fungi') {
    // Kingdom Fungi está no documento fungiAmeacada
    const flora = await getCollection('dwc2json', 'fungiAmeacada')
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
    const flora = await getCollection('dwc2json', 'plantaeAmeacada')
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
    const flora = await getCollection('dwc2json', 'fungiAmeacada')
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
