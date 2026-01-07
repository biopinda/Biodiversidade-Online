/**
 * Execute all transformation pipelines sequentially
 * This script runs taxa and occurrences transformations in order
 */

import { TransformLockAcquisitionError } from '../lib/concurrency'
import { closeMongoClients } from '../lib/database'
import { runTransform } from './runTransform'

async function main() {
  console.log('='.repeat(60))
  console.log('🔄 Iniciando pipeline completo de transformação')
  console.log('='.repeat(60))

  const results: {
    pipeline: string
    status: 'success' | 'failed' | 'skipped'
    error?: unknown
  }[] = []

  // Execute taxa transformation
  try {
    console.log('\n📊 Executando transformação de Taxa...')
    const taxaResult = await runTransform('taxa', {
      runnerId: process.env.GITHUB_RUN_ID,
      version: process.env.TRANSFORM_VERSION
    })
    console.log(
      `✅ Taxa: ${taxaResult.metricsSnapshot.counters.processed} processados, ${taxaResult.metricsSnapshot.counters.failed} falhas`
    )
    results.push({ pipeline: 'taxa', status: 'success' })
  } catch (error) {
    if (error instanceof TransformLockAcquisitionError) {
      console.warn(
        '⏭️  Taxa: Transformação já em execução (lock ativo), pulando...'
      )
      results.push({ pipeline: 'taxa', status: 'skipped', error })
    } else {
      console.error('❌ Falha na transformação de Taxa:', error)
      results.push({ pipeline: 'taxa', status: 'failed', error })
    }
  }

  // Execute occurrences transformation
  try {
    console.log('\n🗺️  Executando transformação de Ocorrências...')
    const occResult = await runTransform('occurrences', {
      runnerId: process.env.GITHUB_RUN_ID,
      version: process.env.TRANSFORM_VERSION
    })
    console.log(
      `✅ Ocorrências: ${occResult.metricsSnapshot.counters.processed} processados, ${occResult.metricsSnapshot.counters.failed} falhas`
    )
    results.push({ pipeline: 'occurrences', status: 'success' })
  } catch (error) {
    if (error instanceof TransformLockAcquisitionError) {
      console.warn(
        '⏭️  Ocorrências: Transformação já em execução (lock ativo), pulando...'
      )
      results.push({ pipeline: 'occurrences', status: 'skipped', error })
    } else {
      console.error('❌ Falha na transformação de Ocorrências:', error)
      results.push({ pipeline: 'occurrences', status: 'failed', error })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📋 Resumo da Execução')
  console.log('='.repeat(60))

  const successful = results.filter((r) => r.status === 'success').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length

  results.forEach((result) => {
    const icon =
      result.status === 'success'
        ? '✅'
        : result.status === 'failed'
          ? '❌'
          : '⏭️ '
    console.log(`${icon} ${result.pipeline}: ${result.status}`)
  })

  console.log(
    `\nTotal: ${successful} sucesso(s), ${failed} falha(s), ${skipped} pulado(s)`
  )

  // Exit with error if any pipeline failed
  if (failed > 0) {
    console.error('\n⚠️  Algumas transformações falharam!')
    process.exitCode = 1
  } else if (successful === 0 && skipped > 0) {
    console.warn(
      '\n⚠️  Nenhuma transformação foi executada (todas puladas por lock)'
    )
    process.exitCode = 0 // Not an error, just info
  } else {
    console.log('\n✅ Todas as transformações foram concluídas com sucesso!')
  }
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error('💥 Erro fatal ao executar pipeline:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await closeMongoClients().catch(() => undefined)
    })
}
