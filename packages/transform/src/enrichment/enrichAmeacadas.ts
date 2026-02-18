/**
 * Enriquecimento de taxa com dados de espécies ameaçadas
 * Atualiza a coleção `taxa` in-place com threatStatus das 3 coleções de ameaçadas
 */

import cliProgress from 'cli-progress'
import type { AnyBulkWriteOperation } from 'mongodb'
import { closeMongoClients, getMongoDatabase } from '../lib/database'
import type { ThreatStatusEntry } from '../taxa/enrichTaxon'
import {
  addToLookup,
  collectDocumentIds,
  collectDocumentNames,
  createLookup,
  gatherLookupMatches,
  type IndexedLookup,
  materializeCollection
} from '../utils/lookup'
import { normalizeNameKey } from '../utils/name'

type MongoDoc = Record<string, unknown>

type ThreatSource = 'fungiAmeacada' | 'plantaeAmeacada' | 'faunaAmeacada'

const THREAT_SOURCES: Array<{
  collection: string
  source: ThreatSource
}> = [
  { collection: 'faunaAmeacada', source: 'faunaAmeacada' },
  { collection: 'fungiAmeacada', source: 'fungiAmeacada' },
  { collection: 'plantaeAmeacada', source: 'plantaeAmeacada' }
]

const BATCH_SIZE = 2000

function extractCategory(doc: MongoDoc): string | undefined {
  return (
    (typeof doc.category === 'string' && doc.category.trim()) ||
    (typeof doc.categoria === 'string' && doc.categoria?.toString().trim()) ||
    (typeof doc.categoryNational === 'string' &&
      doc.categoryNational?.toString().trim()) ||
    (typeof doc.categoria_nacional === 'string' &&
      doc.categoria_nacional?.toString().trim()) ||
    (typeof doc['Categoria de Risco'] === 'string' &&
      (doc['Categoria de Risco'] as string).trim()) ||
    (typeof doc.threatStatus === 'string' &&
      (doc.threatStatus as string).trim()) ||
    (typeof doc.status === 'string' && doc.status.trim()) ||
    undefined
  )
}

async function buildThreatIndex(
  db: Awaited<ReturnType<typeof getMongoDatabase>>
): Promise<IndexedLookup<ThreatStatusEntry>> {
  const lookup = createLookup<ThreatStatusEntry>()

  for (const { collection: collectionName, source } of THREAT_SOURCES) {
    const collection = db.collection<MongoDoc>(collectionName)
    const count = await collection.estimatedDocumentCount()

    if (count === 0) {
      console.log(
        `  Coleção '${collectionName}' vazia ou inexistente, pulando.`
      )
      continue
    }

    const docs = await materializeCollection(collection)
    console.log(`  ${collectionName}: ${docs.length} documentos carregados`)

    for (const doc of docs) {
      const ids = collectDocumentIds(doc)
      const names = collectDocumentNames(doc)
      if (!ids.length && !names.length) continue

      const category = extractCategory(doc)
      addToLookup(lookup, ids, names, {
        source,
        category: category ?? undefined
      })
    }
  }

  return lookup
}

function gatherCandidateIds(taxon: MongoDoc): string[] {
  const ids = new Set<string>()
  if (typeof taxon._id === 'string') ids.add(taxon._id)
  if (typeof taxon.taxonID === 'string') ids.add(taxon.taxonID)
  return Array.from(ids)
}

function gatherCandidateNames(taxon: MongoDoc): string[] {
  const names = new Set<string>()
  if (typeof taxon.canonicalName === 'string') {
    const normalized = normalizeNameKey(taxon.canonicalName)
    if (normalized) names.add(normalized)
  }
  if (typeof taxon.scientificName === 'string') {
    const normalized = normalizeNameKey(taxon.scientificName)
    if (normalized) names.add(normalized)
  }
  if (typeof taxon.flatScientificName === 'string') {
    names.add(taxon.flatScientificName.toLocaleLowerCase())
  }
  return Array.from(names)
}

async function main() {
  console.log('=== Enriquecimento de taxa com dados de espécies ameaçadas ===')

  const db = await getMongoDatabase()

  console.log('Construindo índice de espécies ameaçadas...')
  const threatIndex = await buildThreatIndex(db)
  console.log(
    `Índice construído: ${threatIndex.byId.size} IDs, ${threatIndex.byFlatName.size} nomes`
  )

  const taxaCollection = db.collection<MongoDoc>('taxa')
  const totalCount = await taxaCollection.estimatedDocumentCount()
  console.log(`Total de taxa a processar: ${totalCount}`)

  const progressBar = new cliProgress.SingleBar(
    {
      format: 'Ameaçadas |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    },
    cliProgress.Presets.shades_classic
  )
  progressBar.start(totalCount, 0)

  const cursor = taxaCollection
    .find({})
    .addCursorFlag('noCursorTimeout', true)
    .batchSize(10000)

  let processed = 0
  let enriched = 0
  let cleared = 0
  let bulkOps: AnyBulkWriteOperation<MongoDoc>[] = []

  for await (const taxon of cursor) {
    processed++

    const ids = gatherCandidateIds(taxon)
    const names = gatherCandidateNames(taxon)
    const matches = gatherLookupMatches(threatIndex, ids, names)

    const hadThreatStatus = Array.isArray(taxon.threatStatus)

    if (matches.length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: taxon._id },
          update: { $set: { threatStatus: matches } }
        }
      })
      enriched++
    } else if (hadThreatStatus) {
      bulkOps.push({
        updateOne: {
          filter: { _id: taxon._id },
          update: { $unset: { threatStatus: '' } }
        }
      })
      cleared++
    }

    if (bulkOps.length >= BATCH_SIZE) {
      await taxaCollection.bulkWrite(bulkOps, { ordered: false })
      bulkOps = []
      progressBar.update(processed)
    }
  }

  if (bulkOps.length > 0) {
    await taxaCollection.bulkWrite(bulkOps, { ordered: false })
  }

  progressBar.update(totalCount)
  progressBar.stop()

  console.log(`\nResultado:`)
  console.log(`  Processados: ${processed}`)
  console.log(`  Enriquecidos com threatStatus: ${enriched}`)
  console.log(`  threatStatus removido: ${cleared}`)
  console.log(`  Sem alteração: ${processed - enriched - cleared}`)
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error('Erro fatal:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await closeMongoClients().catch(() => undefined)
    })
}
