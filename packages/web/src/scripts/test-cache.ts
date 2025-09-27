import { countOccurrenceRegions } from '../lib/mongo'

async function testCache() {
  console.log('🧪 Testando cache de ocorrências...')

  try {
    console.log('1. Testando consulta sem filtros (deve usar cache)...')
    const start1 = Date.now()
    const result1 = await countOccurrenceRegions({})
    const time1 = Date.now() - start1

    console.log(`   ✅ Resultado: ${result1 ? 'OK' : 'FALHA'}`)
    console.log(`   ⏱️  Tempo: ${time1}ms`)
    console.log(`   📊 Total: ${result1?.total}`)
    console.log(`   🗺️  Regiões: ${result1?.regions?.length}`)

    console.log('\n2. Testando consulta com refresh (deve recriar cache)...')
    const start2 = Date.now()
    const result2 = await countOccurrenceRegions({}, true) // forceRefresh = true
    const time2 = Date.now() - start2

    console.log(`   ✅ Resultado: ${result2 ? 'OK' : 'FALHA'}`)
    console.log(`   ⏱️  Tempo: ${time2}ms`)
    console.log(`   📊 Total: ${result2?.total}`)
    console.log(`   🗺️  Regiões: ${result2?.regions?.length}`)

    console.log(
      '\n3. Testando consulta sem filtros novamente (deve usar cache)...'
    )
    const start3 = Date.now()
    const result3 = await countOccurrenceRegions({})
    const time3 = Date.now() - start3

    console.log(`   ✅ Resultado: ${result3 ? 'OK' : 'FALHA'}`)
    console.log(`   ⏱️  Tempo: ${time3}ms`)
    console.log(`   📊 Total: ${result3?.total}`)
    console.log(`   🗺️  Regiões: ${result3?.regions?.length}`)

    if (time1 < 1000 && time3 < 1000 && time2 > 5000) {
      console.log('\n🎉 Cache funcionando corretamente!')
      console.log('   - Consultas sem filtros são rápidas (usando cache)')
      console.log('   - Consulta com refresh é lenta (recria cache)')
    } else {
      console.log('\n⚠️  Cache pode não estar funcionando corretamente')
      console.log(`   - Tempo consulta 1: ${time1}ms (esperado: <1000ms)`)
      console.log(`   - Tempo consulta 2: ${time2}ms (esperado: >5000ms)`)
      console.log(`   - Tempo consulta 3: ${time3}ms (esperado: <1000ms)`)
    }
  } catch (error) {
    console.error('❌ Erro no teste:', error)
  }
}

testCache()
