import { getCollection } from './connection'

// Shared utilities used across multiple modules

export async function getTopCollectionsByKingdom(kingdom: string, limit = 10) {
  const occurrences = await getCollection('dwc2json', 'occurrences')
  if (!occurrences) return null

  const result = await occurrences
    .aggregate([
      {
        $match: {
          iptKingdoms:
            kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase(),
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

// Brazilian states validation utilities
export const validBrazilianStates = [
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

export const brazilianStateVariations = [
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
export function createBrazilianStateFilter() {
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
