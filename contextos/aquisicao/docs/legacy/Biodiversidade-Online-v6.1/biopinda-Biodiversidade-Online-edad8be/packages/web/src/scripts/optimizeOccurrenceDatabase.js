/**
 * Script para otimizar o banco de dados para consultas de ocorrências por estado
 * Cria índices e views materializadas para melhorar performance
 */

import { MongoClient } from 'mongodb'

const url =
  process.env.MONGO_URI ||
  'mongodb://dwc2json:VLWQ8Bke65L52hfBM635@192.168.1.10:27017/?authSource=admin&authMechanism=DEFAULT'

const client = new MongoClient(url)

// Mapeamento de estados para normalização
const stateMapping = {
  // Norte
  AC: 'Acre',
  Acre: 'Acre',
  AP: 'Amapá',
  Amapá: 'Amapá',
  Amapa: 'Amapá',
  AM: 'Amazonas',
  Amazonas: 'Amazonas',
  PA: 'Pará',
  Pará: 'Pará',
  Para: 'Pará',
  RO: 'Rondônia',
  Rondônia: 'Rondônia',
  Rondonia: 'Rondônia',
  RR: 'Roraima',
  Roraima: 'Roraima',
  TO: 'Tocantins',
  Tocantins: 'Tocantins',

  // Nordeste
  AL: 'Alagoas',
  Alagoas: 'Alagoas',
  BA: 'Bahia',
  Bahia: 'Bahia',
  CE: 'Ceará',
  Ceará: 'Ceará',
  Ceara: 'Ceará',
  MA: 'Maranhão',
  Maranhão: 'Maranhão',
  Maranhao: 'Maranhão',
  PB: 'Paraíba',
  Paraíba: 'Paraíba',
  Paraiba: 'Paraíba',
  PE: 'Pernambuco',
  Pernambuco: 'Pernambuco',
  PI: 'Piauí',
  Piauí: 'Piauí',
  Piaui: 'Piauí',
  RN: 'Rio Grande do Norte',
  'Rio Grande do Norte': 'Rio Grande do Norte',
  SE: 'Sergipe',
  Sergipe: 'Sergipe',

  // Centro-Oeste
  GO: 'Goiás',
  Goiás: 'Goiás',
  Goias: 'Goiás',
  MT: 'Mato Grosso',
  'Mato Grosso': 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  'Mato Grosso do Sul': 'Mato Grosso do Sul',
  DF: 'Distrito Federal',
  'Distrito Federal': 'Distrito Federal',

  // Sudeste
  ES: 'Espírito Santo',
  'Espírito Santo': 'Espírito Santo',
  'Espirito Santo': 'Espírito Santo',
  MG: 'Minas Gerais',
  'Minas Gerais': 'Minas Gerais',
  RJ: 'Rio de Janeiro',
  'Rio de Janeiro': 'Rio de Janeiro',
  SP: 'São Paulo',
  'São Paulo': 'São Paulo',
  'Sao Paulo': 'São Paulo',

  // Sul
  PR: 'Paraná',
  Paraná: 'Paraná',
  Parana: 'Paraná',
  RS: 'Rio Grande do Sul',
  'Rio Grande do Sul': 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  'Santa Catarina': 'Santa Catarina'
}

async function createIndexes() {
  try {
    await client.connect()
    console.log('✅ Conectado ao MongoDB')

    const db = client.db('dwc2json')
    const ocorrencias = db.collection('ocorrencias')

    console.log('🔍 Verificando e criando índices para otimizar consultas...')

    // Verificar índices existentes
    const existingIndexes = await ocorrencias.listIndexes().toArray()
    const existingIndexNames = new Set(existingIndexes.map((idx) => idx.name))

    console.log('📋 Índices existentes:', existingIndexNames)

    // Criar índices apenas se não existirem
    const indexesToCreate = [
      {
        spec: {
          stateProvince: 1,
          kingdom: 1,
          phylum: 1,
          class: 1,
          order: 1,
          family: 1,
          genus: 1,
          specificEpithet: 1
        },
        options: {
          name: 'idx_taxonomy_state',
          background: true
        }
      },
      {
        spec: {
          stateProvince: 1
        },
        options: {
          name: 'idx_state_only',
          background: true
        }
      },
      {
        spec: {
          kingdom: 1,
          stateProvince: 1
        },
        options: {
          name: 'idx_kingdom_state',
          background: true
        }
      }
    ]

    for (const { spec, options } of indexesToCreate) {
      if (!existingIndexNames.has(options.name)) {
        try {
          await ocorrencias.createIndex(spec, options)
          console.log(`✅ Índice ${options.name} criado`)
        } catch (error) {
          console.warn(`⚠️ Erro criando índice ${options.name}:`, error.message)
        }
      } else {
        console.log(`📋 Índice ${options.name} já existe`)
      }
    }

    console.log('✅ Verificação de índices concluída')

    // Verificar se a view já existe
    const views = await db
      .listCollections({ name: 'occurrencesByState' })
      .toArray()

    if (views.length > 0) {
      console.log('📋 Removendo view existente...')
      await db.dropCollection('occurrencesByState')
    }

    console.log('🏗️ Criando view materializada para contagens por estado...')

    // Criar view materializada com contagens pré-calculadas
    await db.createCollection('occurrencesByState', {
      viewOn: 'ocorrencias',
      pipeline: [
        {
          $addFields: {
            normalizedState: {
              $switch: {
                branches: Object.entries(stateMapping).map(
                  ([input, output]) => ({
                    case: { $eq: ['$stateProvince', input] },
                    then: output
                  })
                ),
                default: {
                  $cond: {
                    if: {
                      $or: [
                        { $eq: ['$stateProvince', null] },
                        { $eq: ['$stateProvince', ''] },
                        { $not: { $ifNull: ['$stateProvince', false] } }
                      ]
                    },
                    then: null,
                    else: '$stateProvince'
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            normalizedState: { $exists: true, $nin: [null, ''] }
          }
        },
        {
          $group: {
            _id: {
              state: '$normalizedState',
              kingdom: '$kingdom',
              phylum: '$phylum',
              class: '$class',
              order: '$order',
              family: '$family',
              genus: '$genus',
              specificEpithet: '$specificEpithet'
            },
            count: { $sum: 1 }
          }
        }
      ]
    })

    console.log('✅ View materializada criada com sucesso')
  } catch (error) {
    console.error('❌ Erro durante otimização:', error)
  } finally {
    await client.close()
  }
}

async function createCacheCollection() {
  try {
    await client.connect()
    const db = client.db('dwc2json')

    // Criar coleção de cache com TTL de 1 hora
    try {
      await db.createCollection('occurrenceCache')
      await db.collection('occurrenceCache').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 3600 } // 1 hora
      )
      console.log('✅ Coleção de cache criada')
    } catch (error) {
      if (error.codeName !== 'NamespaceExists') {
        throw error
      }
      console.log('📋 Coleção de cache já existe')
    }
  } catch (error) {
    console.error('❌ Erro criando cache:', error)
  } finally {
    await client.close()
  }
}

async function main() {
  console.log('🚀 Iniciando otimização do banco de dados para ocorrências...')

  await createIndexes()
  await createCacheCollection()

  console.log('🎉 Otimização concluída!')
  console.log('💡 Dicas:')
  console.log(
    '   - Execute este script periodicamente para manter os índices atualizados'
  )
  console.log(
    '   - A view materializada melhora significativamente a performance'
  )
  console.log('   - O cache reduz consultas repetidas ao banco de dados')
}

main().catch(console.error)
