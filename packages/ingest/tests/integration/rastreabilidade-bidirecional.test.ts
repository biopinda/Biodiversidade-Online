import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { MongoClient, ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

describe('Integração: rastreabilidade bidirecional', () => {
  let mongod: MongoMemoryServer
  let client: MongoClient

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    client = new MongoClient(mongod.getUri())
    await client.connect()
  })

  afterAll(async () => {
    await client?.close()
    await mongod?.stop()
  })

  it('deve vincular documentos transformados aos originais e permitir consultas 2-way', async () => {
    const db = client.db('dwc2json-test')
    const { createPreservadorDadosOriginais } = await import(
      '../../src/lib/preservador-dados-originais.ts'
    )
    const {
      garantirRastreabilidadeBidirecional,
      obterOriginalReferencia,
      obterTransformadosRelacionados
    } = await import('../../src/lib/rastreabilidade.ts')

    const preservador = await createPreservadorDadosOriginais(db, {
      collectionName: 'taxaOriginal',
      collectionType: 'fauna'
    })

    const originalDoc = {
      _id: new ObjectId('000000000000000000000002'),
      iptId: 'ipt:fauna',
      ipt_record_id: 'rec-2',
      ipt_version: '1.1',
      collection_type: 'fauna' as const,
      original_data: {
        taxonID: 'dwc-2',
        scientificName: 'Panthera onca'
      },
      ingestion_metadata: {
        timestamp: new Date('2025-01-05T12:00:00Z'),
        source_ipt_url: 'https://ipt.example/fauna',
        processing_version: 'v1',
        dwca_version: '1.1.0'
      },
      processing_status: {
        is_processed: false
      }
    }

    await preservador.salvarDocumentos([originalDoc], {
      pipelineVersion: 'pipeline-fauna@1'
    })

    const transformedDoc = {
      _id: originalDoc._id,
      scientificName: 'Panthera onca',
      kingdom: 'Animalia',
      taxonID: 'dwc-2',
      canonicalName: 'Panthera onca'
    }

    await garantirRastreabilidadeBidirecional(db, {
      collectionName: 'taxa',
      originalId: originalDoc._id,
      transformed: transformedDoc,
      metadata: {
        pipelineVersion: 'pipeline-fauna@1',
        transformFunctions: ['normalizarTaxonomia']
      }
    })

    const original = await obterOriginalReferencia(db, {
      collectionName: 'taxa',
      transformedId: transformedDoc._id
    })

    expect(original?._id).toBe(originalDoc._id)
    expect(original?.original_data.scientificName).toBe('Panthera onca')

    const relacionados = await obterTransformadosRelacionados(db, {
      collectionName: 'taxa',
      originalId: originalDoc._id
    })

    expect(relacionados).toHaveLength(1)
    const relacionado = relacionados[0] as {
      _id?: ObjectId
      original_reference?: { original_id?: ObjectId }
    }

    expect(relacionado?._id).toBe(transformedDoc._id)
    expect(relacionado.original_reference?.original_id).toBe(originalDoc._id)
  })
})
