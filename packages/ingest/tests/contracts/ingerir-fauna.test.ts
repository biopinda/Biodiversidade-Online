import { describe, expect, it } from 'bun:test'

describe('Contrato do script ingest-fauna', () => {
  it('deve exportar funções main e checkIptVersion que respeitem o contrato', async () => {
    const module = await import('../../src/scripts/ingest-fauna.ts')

    expect(typeof module.main).toBe('function')
    expect(typeof module.checkIptVersion).toBe('function')

    await expect(module.main({ dry_run: true })).rejects.toThrow(/MONGO_URI/i)

    await expect(module.checkIptVersion('ipt:test')).rejects.toThrow()
  })
})
