/**
 * Enriquecimento de ocorrências com dados de Unidades de Conservação
 * Atualiza a coleção `ocorrencias` in-place com conservationUnits
 *
 * TODO: Implementar matching geoespacial no futuro.
 * Atualmente faz matching por nome/ID.
 */

import cliProgress from 'cli-progress'
import type { AnyBulkWriteOperation } from 'mongodb'
import { closeMongoClients, getMongoDatabase } from '../lib/database'
import type { ConservationUnitEntry } from '../taxa/enrichTaxon'
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

function extractConservationUnitName(doc: MongoDoc): string | null {
  const candidates = [
    doc.ucName,
    doc['Nome da UC'],
    doc.nomeUC,
    doc.nome_uc,
    doc.nome,
    doc.name
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

async function buildUCIndex(
  db: Awaited<ReturnType<typeof getMongoDatabase>>
): Promise<IndexedLookup<ConservationUnitEntry>> {
  const lookup = createLookup<ConservationUnitEntry>()
  const collection = db.collection<MongoDoc>('catalogoucs')
  const count = await collection.estimatedDocumentCount()

  if (count === 0) {
    console.log("  Coleção 'catalogoucs' vazia ou inexistente.")
    return lookup
  }

  const docs = await materializeCollection(collection)
  console.log(`  catalogoucs: ${docs.length} documentos carregados`)

  for (const doc of docs) {
    const ucName = extractConservationUnitName(doc)
    if (!ucName) continue

    const ids = collectDocumentIds(doc)
    const names = collectDocumentNames(doc)
    if (!ids.length && !names.length) continue

    addToLookup(lookup, ids, names, { ucName })
  }

  return lookup
}

function gatherCandidateIds(occurrence: MongoDoc): string[] {
  const ids = new Set<string>()
  if (typeof occurrence._id === 'string') ids.add(occurrence._id)
  if (typeof occurrence.occurrenceID === 'string')
    ids.add(occurrence.occurrenceID)
  return Array.from(ids)
}

function gatherCandidateNames(occurrence: MongoDoc): string[] {
  const names = new Set<string>()
  if (typeof occurrence.canonicalName === 'string') {
    const normalized = normalizeNameKey(occurrence.canonicalName)
    if (normalized) names.add(normalized)
  }
  if (typeof occurrence.scientificName === 'string') {
    const normalized = normalizeNameKey(occurrence.scientificName)
    if (normalized) names.add(normalized)
  }
  if (typeof occurrence.flatScientificName === 'string') {
    names.add(occurrence.flatScientificName.toLocaleLowerCase())
  }
  return Array.from(names)
}

async function main() {
  console.log(
    '=== Enriquecimento de ocorrências com Unidades de Conservação ==='
  )

  const db = await getMongoDatabase()

  console.log('Construindo índice de Unidades de Conservação...')
  const ucIndex = await buildUCIndex(db)
  console.log(
    `Índice construído: ${ucIndex.byId.size} IDs, ${ucIndex.byFlatName.size} nomes`
  )

  const occurrencesCollection = db.collection<MongoDoc>('occurrences')
  const totalCount = await occurrencesCollection.estimatedDocumentCount()
  console.log(`Total de ocorrências a processar: ${totalCount}`)

  const progressBar = new cliProgress.SingleBar(
    {
      format: 'UCs |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    },
    cliProgress.Presets.shades_classic
  )
  progressBar.start(totalCount, 0)

  const cursor = occurrencesCollection
    .find({})
    .addCursorFlag('noCursorTimeout', true)
    .batchSize(10000)

  let processed = 0
  let enriched = 0
  let cleared = 0
  let bulkOps: AnyBulkWriteOperation<MongoDoc>[] = []

  for await (const occurrence of cursor) {
    processed++

    const ids = gatherCandidateIds(occurrence)
    const names = gatherCandidateNames(occurrence)
    const matches = gatherLookupMatches(ucIndex, ids, names)

    const hadConservationUnits = Array.isArray(occurrence.conservationUnits)

    if (matches.length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: occurrence._id },
          update: { $set: { conservationUnits: matches } }
        }
      })
      enriched++
    } else if (hadConservationUnits) {
      bulkOps.push({
        updateOne: {
          filter: { _id: occurrence._id },
          update: { $unset: { conservationUnits: '' } }
        }
      })
      cleared++
    }

    if (bulkOps.length >= BATCH_SIZE) {
      await occurrencesCollection.bulkWrite(bulkOps, { ordered: false })
      bulkOps = []
      progressBar.update(processed)
    }
  }

  if (bulkOps.length > 0) {
    await occurrencesCollection.bulkWrite(bulkOps, { ordered: false })
  }

  progressBar.update(totalCount)
  progressBar.stop()

  console.log(`\nResultado:`)
  console.log(`  Processadas: ${processed}`)
  console.log(`  Enriquecidas com conservationUnits: ${enriched}`)
  console.log(`  conservationUnits removido: ${cleared}`)
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
