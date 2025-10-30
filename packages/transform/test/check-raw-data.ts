/**
 * Diagnostic script to check what's in the taxa_ipt collection
 */

import { getMongoDatabase } from '../src/lib/database'

async function checkRawData() {
  console.log('🔍 Checking taxa_ipt collection...\n')

  const db = await getMongoDatabase()
  const collection = db.collection('taxa_ipt')

  // Get total count
  const total = await collection.countDocuments()
  console.log(`Total documents: ${total}`)

  if (total === 0) {
    console.log('❌ No documents found in taxa_ipt collection!')
    console.log('   Have you run ingestion? Try:')
    console.log(
      '   bun run ingest:flora https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil'
    )
    process.exit(0)
  }

  // Get one sample document
  const sample = await collection.findOne()
  console.log('\nSample document structure:')
  console.log(
    'Keys:',
    Object.keys(sample || {})
      .slice(0, 20)
      .join(', ')
  )

  // Check taxonRank field
  console.log('\n📊 TaxonRank distribution:')
  const rankPipeline = [
    { $group: { _id: '$taxonRank', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]
  const ranks = await collection.aggregate(rankPipeline).toArray()

  if (ranks.length === 0) {
    console.log('❌ No taxonRank field found!')
    console.log('   Sample fields:', Object.keys(sample || {}).join(', '))
  } else {
    ranks.forEach((r) => {
      console.log(`  ${r._id}: ${r.count}`)
    })
  }

  // Check for ESPECIE, VARIEDADE, FORMA, SUB_ESPECIE
  console.log('\n🔍 Checking for expected rank values:')
  const expectedRanks = ['ESPECIE', 'VARIEDADE', 'FORMA', 'SUB_ESPECIE']
  for (const rank of expectedRanks) {
    const count = await collection.countDocuments({ taxonRank: rank })
    console.log(`  ${rank}: ${count}`)
  }

  // Check rawSource distribution
  console.log('\n📦 Source distribution:')
  const sourcePipeline = [
    { $group: { _id: '$rawSource', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]
  const sources = await collection.aggregate(sourcePipeline).toArray()
  sources.forEach((s) => {
    console.log(`  ${s._id}: ${s.count}`)
  })

  // Check _id format (should have P or A prefix now)
  console.log('\n🆔 Sample _id values:')
  const samples = await collection.find().limit(5).toArray()
  samples.forEach((s) => {
    console.log(`  ${s._id} (source: ${s.rawSource}, rank: ${s.taxonRank})`)
  })

  process.exit(0)
}

checkRawData().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
