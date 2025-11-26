import { describe, expect, it } from 'bun:test'

describe('Contrato do script transform-ocorrencias', () => {
  it('deve exportar funções main e getDocumentsToTransform que respeitem o contrato', async () => {
    const module = await import('../../src/scripts/transform-ocorrencias.ts')

    expect(typeof module.main).toBe('function')
    expect(typeof module.getDocumentsToTransform).toBe('function')

    await expect(module.main({ dry_run: true })).rejects.toThrow(/MONGO_URI/i)
    await expect(
      module.getDocumentsToTransform({ only_unprocessed: true })
    ).rejects.toThrow()
  })
})
