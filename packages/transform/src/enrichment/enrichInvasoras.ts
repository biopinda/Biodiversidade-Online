/**
 * Enriquecimento de taxa com dados de espécies invasoras
 * Atualiza a coleção `taxa` in-place com invasiveStatus
 */

import cliProgress from 'cli-progress'
import type { AnyBulkWriteOperation } from 'mongodb'
import { closeMongoClients, getMongoDatabase } from '../lib/database'
import type { InvasiveStatusEntry } from '../taxa/enrichTaxon'
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

const BATCH_SIZE = 2000

function extractInvasiveNote(doc: MongoDoc): string | undefined {
  return (
    (typeof doc.notes === 'string' && doc.notes.trim()) ||
    (typeof doc.observacao === 'string' && doc.observacao?.toString().trim()) ||
    undefined
  )
}

async function buildInvasiveIndex(
  db: Awaited<ReturnType<typeof getMongoDatabase>>
): Promise<IndexedLookup<InvasiveStatusEntry>> {
  const lookup = createLookup<InvasiveStatusEntry>()
  const collection = db.collection<MongoDoc>('invasoras')
  const count = await collection.estimatedDocumentCount()

  if (count === 0) {
    console.log("  Coleção 'invasoras' vazia ou inexistente.")
    return lookup
  }

  const docs = await materializeCollection(collection)
  console.log(`  invasoras: ${docs.length} documentos carregados`)

  for (const doc of docs) {
    const ids = collectDocumentIds(doc)
    const names = collectDocumentNames(doc)
    if (!ids.length && !names.length) continue

    const note = extractInvasiveNote(doc)
    addToLookup(lookup, ids, names, {
      source: 'invasoras',
      isInvasive: true,
      notes: note
    })
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
  console.log('=== Enriquecimento de taxa com dados de espécies invasoras ===')

  const db = await getMongoDatabase()

  console.log('Construindo índice de espécies invasoras...')
  const invasiveIndex = await buildInvasiveIndex(db)
  console.log(
    `Índice construído: ${invasiveIndex.byId.size} IDs, ${invasiveIndex.byFlatName.size} nomes`
  )

  const taxaCollection = db.collection<MongoDoc>('taxa')
  const totalCount = await taxaCollection.estimatedDocumentCount()
  console.log(`Total de taxa a processar: ${totalCount}`)

  const progressBar = new cliProgress.SingleBar(
    {
      format: 'Invasoras |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
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
    const matches = gatherLookupMatches(invasiveIndex, ids, names)

    const hadInvasiveStatus = taxon.invasiveStatus != null

    if (matches.length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: taxon._id },
          update: {
            $set: {
              invasiveStatus: {
                ...matches[0],
                isInvasive: true
              }
            }
          }
        }
      })
      enriched++
    } else if (hadInvasiveStatus) {
      bulkOps.push({
        updateOne: {
          filter: { _id: taxon._id },
          update: { $unset: { invasiveStatus: '' } }
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
  console.log(`  Enriquecidos com invasiveStatus: ${enriched}`)
  console.log(`  invasiveStatus removido: ${cleared}`)
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
