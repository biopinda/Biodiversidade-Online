/**
 * Admin CSV Upload Endpoint
 * POST /api/admin/upload-csv
 *
 * Receives a CSV file via multipart form and loads it into MongoDB,
 * replacing the existing collection.
 */

import { getSessionIdFromCookies, validateSession } from '@/lib/auth'
import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import Papa from 'papaparse'

const ALLOWED_COLLECTIONS = new Set([
  'faunaAmeacada',
  'plantaeAmeacada',
  'fungiAmeacada',
  'invasoras',
  'catalogoucs'
])

async function createIndexes(
  col: Awaited<ReturnType<typeof getMongoDatabase>> extends infer T
    ? T extends { collection: (...args: any[]) => infer C }
      ? C
      : never
    : never,
  name: string
): Promise<void> {
  switch (name) {
    case 'faunaAmeacada':
      await col.createIndex({ canonicalName: 1 })
      await col.createIndex({ threatStatus: 1 })
      break
    case 'plantaeAmeacada':
      await col.createIndex({ 'Flora e Funga do Brasil ID': 1 })
      await col.createIndex({ 'Nome Científico': 1 })
      break
    case 'fungiAmeacada':
      await col.createIndex({ 'Flora e Funga do Brasil ID': 1 })
      await col.createIndex({ 'Nome Científico': 1 })
      break
    case 'invasoras':
      await col.createIndex({ scientific_name: 1 })
      break
    case 'catalogoucs':
      await col.createIndex({ 'Nome da UC': 1 })
      await col.createIndex({ UF: 1 })
      break
  }
}

export async function POST(context: APIContext): Promise<Response> {
  // Auth check
  const sessionId = getSessionIdFromCookies(
    context.request.headers.get('cookie')
  )
  if (!validateSession(sessionId)) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const formData = await context.request.formData()
    const collection = formData.get('collection') as string
    const file = formData.get('file') as File | null

    if (!collection || !ALLOWED_COLLECTIONS.has(collection)) {
      return new Response(
        JSON.stringify({ error: 'Coleção inválida ou não permitida' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Arquivo CSV não enviado' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const csvContent = await file.text()

    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ''
    })

    if (parsed.errors.length > 0) {
      console.warn('CSV parse warnings:', parsed.errors.slice(0, 5))
    }

    const records = parsed.data
    if (records.length === 0) {
      return new Response(JSON.stringify({ error: 'CSV sem registros' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const db = await getMongoDatabase()
    const col = db.collection(collection)

    // Drop existing data and reload
    await col.drop().catch(() => {
      // Collection may not exist yet — ignore error
    })
    await db.createCollection(collection)

    const result = await col.insertMany(records)
    await createIndexes(col as any, collection)

    return new Response(
      JSON.stringify({
        success: true,
        count: result.insertedCount,
        collection
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('CSV upload error:', error)
    return new Response(
      JSON.stringify({
        error: 'Erro ao processar CSV',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
