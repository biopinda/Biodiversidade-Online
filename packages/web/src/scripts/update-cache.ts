#!/usr/bin/env node

// Script para atualizar o cache taxonomico manualmente ou via cron job
import { generateCache } from '../lib/cache.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function updateCache() {
  try {
    console.log('🚀 Iniciando atualização do cache taxonomico...')
    const cache = await generateCache()
    console.log(`✅ Cache atualizado com sucesso!`)
    console.log(`   - ${cache.families.length} famílias`)
    console.log(`   - ${Object.keys(cache.genera).length} famílias com gêneros`)
    console.log(
      `   - ${Object.keys(cache.species).length} combinações família/gênero com espécies`
    )
    console.log(`   - Última atualização: ${cache.lastUpdated}`)
  } catch (error) {
    console.error('❌ Erro ao atualizar cache:', error)
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  updateCache()
}

export { updateCache }
