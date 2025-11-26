import { describe, expect, it } from 'bun:test'

describe('Contrato do script ingest-ocorrencias', () => {
  it('deve exportar funções main e checkIptVersion que respeitem o contrato', async () => {
    const module = await import('../../src/scripts/ingest-ocorrencias.ts')

    expect(typeof module.main).toBe('function')
    expect(typeof module.checkIptVersion).toBe('function')

    await expect(
      module.main({ dry_run: true, ipt_urls: [], ipt_filter: undefined })
    ).rejects.toThrow(/MONGO_URI/i)

    await expect(module.checkIptVersion('ipt:test')).rejects.toThrow()
  })
})
