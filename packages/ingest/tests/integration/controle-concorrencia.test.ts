import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { MongoClient } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

describe('Integração: controle de concorrência', () => {
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

  it('deve garantir lock exclusivo por tipo de recurso', async () => {
    const db = client.db('dwc2json-test')
    const { createGerenciadorBloqueios } = await import(
      '../../src/lib/gerenciador-bloqueios.ts'
    )

    const gerenciador = createGerenciadorBloqueios(
      db.collection('processingLocks')
    )

    const primeiroLock = await gerenciador.adquirir('fauna_ingestion', {
      owner: 'workflow-run#1',
      ttlSeconds: 60
    })
    expect(primeiroLock.obtido).toBe(true)

    const segundoLock = await gerenciador.adquirir('fauna_ingestion', {
      owner: 'workflow-run#2',
      ttlSeconds: 60
    })
    expect(segundoLock.obtido).toBe(false)
    if (!segundoLock.obtido) {
      expect(segundoLock.motivo).toMatch(/já está bloqueado/i)
    }

    await gerenciador.liberar('fauna_ingestion', { owner: 'workflow-run#1' })

    const terceiroLock = await gerenciador.adquirir('fauna_ingestion', {
      owner: 'workflow-run#2',
      ttlSeconds: 60
    })
    expect(terceiroLock.obtido).toBe(true)
  })
})
