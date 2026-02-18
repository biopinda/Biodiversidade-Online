import { readFileSync } from 'fs'
import Papa from 'papaparse'
import { closeMongoClients, getMongoDatabase } from '../lib/database'

const COLLECTION_NAME = 'fungiAmeacada'

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Uso: bun run load:fungi-ameacada -- <caminho-do-csv>')
    process.exit(1)
  }

  console.log(
    `Carregando dados de ${csvPath} para coleção '${COLLECTION_NAME}'...`
  )

  const csvContent = readFileSync(csvPath, 'utf-8')
  const { data, errors } = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    delimiter: ''
  })

  if (errors.length > 0) {
    console.warn(`${errors.length} erros ao parsear CSV:`, errors.slice(0, 5))
  }

  if (data.length === 0) {
    console.error('Nenhum registro encontrado no CSV.')
    process.exit(1)
  }

  console.log(`${data.length} registros parseados do CSV`)

  const db = await getMongoDatabase()
  const collection = db.collection(COLLECTION_NAME)

  await collection.drop().catch(() => {})
  await db.createCollection(COLLECTION_NAME)

  const result = await collection.insertMany(data)
  console.log(`${result.insertedCount} documentos inseridos`)

  await collection.createIndex({ 'Flora e Funga do Brasil ID': 1 })
  await collection.createIndex({ 'Nome Científico': 1 })

  console.log('Indexes criados com sucesso')
  console.log(`Carga de '${COLLECTION_NAME}' concluída.`)
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
