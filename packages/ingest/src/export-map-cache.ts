#!/usr/bin/env bun
import { MongoClient } from 'mongodb'
import fs from 'fs'
import path from 'path'

// Pequena lista de variantes de 'Brasil' a serem aceitas
const BRAZIL_VARIANTS = [
  'Brasil',
  'brasil',
  'BRASIL',
  'Brazil',
  'brazil',
  'BRAZIL',
  'BR'
]

// Mapeamento simples para normalizar nomes de estado (caso básico)
// Mantido leve para evitar dependência cruzada entre pacotes
const STATE_NORMALIZATION: Record<string, string> = {
  saoPaulo: 'São Paulo',
  'são paulo': 'São Paulo',
  'sao paulo': 'São Paulo',
  's.paulo': 'São Paulo',
  'minas gerais': 'Minas Gerais',
  minasgerais: 'Minas Gerais',
  'rio de janeiro': 'Rio de Janeiro',
  'rio grande do sul': 'Rio Grande do Sul',
  'rio grande do norte': 'Rio Grande do Norte',
  'distrito federal': 'Distrito Federal'
}

function normalizeState(value: unknown): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  const key = s.toLowerCase()
  // quick exact mapping
  if (STATE_NORMALIZATION[key]) return STATE_NORMALIZATION[key]
  // title-case fallback
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(' ')
}

async function main() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('MONGO_URI não definido. Abortando export-map-cache.')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri)
  try {
    await client.connect()
    console.log('Conectado ao MongoDB para gerar map cache')
    const db = client.db('dwc2json')
    const occurrences = db.collection('ocorrencias')

    // Agregação leve: filtra por variações de 'Brasil' e conta por stateProvince
    const pipeline = [
      {
        $match: {
          country: { $in: BRAZIL_VARIANTS },
          stateProvince: { $exists: true, $nin: [null, '', 'Unknown'] }
        }
      },
      {
        $group: {
          _id: '$stateProvince',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]

    const cursor = occurrences.aggregate(pipeline, { allowDiskUse: true })
    const items = await cursor.toArray()

    // Normaliza nomes e soma counts por estado normalizado
    const normalized: Record<string, number> = {}
    let total = 0
    for (const it of items) {
      const raw = it._id
      const count =
        typeof it.count === 'number' ? it.count : parseInt(it.count) || 0
      const norm = normalizeState(raw) || 'Unknown'
      if (!normalized[norm]) normalized[norm] = 0
      normalized[norm] += count
      total += count
    }

    // Convert to sorted array
    const regions = Object.entries(normalized)
      .map(([k, v]) => ({ _id: k, count: v }))
      .sort((a, b) => b.count - a.count)

    const output = {
      generatedAt: new Date().toISOString(),
      total,
      regions
    }

    const webCacheDir = path.join(process.cwd(), '..', 'web', 'cache')
    const outPath = path.join(webCacheDir, 'map-initial-load.json')

    // Garantir diretório
    fs.mkdirSync(webCacheDir, { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8')

    console.log('Arquivo gerado:', outPath)
  } catch (error) {
    console.error('Erro ao gerar map cache:', error)
    process.exitCode = 2
  } finally {
    await client.close()
  }
}

if (require.main === module) {
  main()
}
