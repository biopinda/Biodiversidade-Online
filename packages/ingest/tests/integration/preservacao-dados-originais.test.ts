import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { MongoClient, ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

describe('Integração: preservação de dados originais', () => {
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

  it('deve armazenar originais, listar pendentes e marcar como processados', async () => {
    const db = client.db('dwc2json-test')
    const { createPreservadorDadosOriginais } = await import(
      '../../src/lib/preservador-dados-originais.ts'
    )

    const preservador = await createPreservadorDadosOriginais(db, {
      collectionName: 'taxaOriginal',
      collectionType: 'fauna'
    })

    const documentos = [
      {
        _id: new ObjectId('000000000000000000000001'),
        iptId: 'ipt:fauna',
        ipt_record_id: 'rec-1',
        ipt_version: '1.0',
        collection_type: 'fauna' as const,
        original_data: {
          taxonID: 'dwc-1',
          scientificName: 'Tamandua tetradactyla'
        },
        ingestion_metadata: {
          timestamp: new Date('2025-01-01T10:00:00Z'),
          source_ipt_url: 'https://ipt.example/fauna',
          processing_version: 'v1',
          dwca_version: '1.0.0'
        },
        processing_status: {
          is_processed: false
        }
      }
    ]

    const resultado = await preservador.salvarDocumentos(documentos, {
      pipelineVersion: 'pipeline-fauna@1'
    })

    expect(resultado.inseridos).toBe(1)
    expect(resultado.atualizados).toBe(0)

    const pendentes = await preservador.listarPendentes({
      iptId: 'ipt:fauna',
      limit: 10
    })

    expect(pendentes).toHaveLength(1)
    expect(pendentes[0].processing_status?.is_processed).toBe(false)

    await preservador.marcarComoProcessados({
      documentos: pendentes.map((doc: { _id: ObjectId }) => ({
        _id: doc._id,
        pipelineVersion: 'pipeline-fauna@1'
      }))
    })

    const pendentesDepois = await preservador.listarPendentes({
      iptId: 'ipt:fauna',
      limit: 10
    })

    expect(pendentesDepois).toHaveLength(0)
  })
})
