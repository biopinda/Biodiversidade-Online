import fs from 'fs'
import { MongoClient } from 'mongodb'
import path from 'path'
import { fileURLToPath } from 'url'

const BRAZIL_VARIANTS = ['brasil', 'brazil', 'br', 'bra']

const stateMapping: Record<string, string> = {
  ac: 'Acre',
  ap: 'Amapá',
  am: 'Amazonas',
  pa: 'Pará',
  ro: 'Rondônia',
  rr: 'Roraima',
  to: 'Tocantins',
  al: 'Alagoas',
  ba: 'Bahia',
  ce: 'Ceará',
  ma: 'Maranhão',
  pb: 'Paraíba',
  pe: 'Pernambuco',
  pi: 'Piauí',
  rn: 'Rio Grande do Norte',
  se: 'Sergipe',
  go: 'Goiás',
  mt: 'Mato Grosso',
  ms: 'Mato Grosso do Sul',
  df: 'Distrito Federal',
  es: 'Espírito Santo',
  mg: 'Minas Gerais',
  rj: 'Rio de Janeiro',
  sp: 'São Paulo',
  pr: 'Paraná',
  rs: 'Rio Grande do Sul',
  sc: 'Santa Catarina',
  acre: 'Acre',
  amapa: 'Amapá',
  amazonas: 'Amazonas',
  para: 'Pará',
  rondonia: 'Rondônia',
  roraima: 'Roraima',
  tocantins: 'Tocantins',
  alagoas: 'Alagoas',
  bahia: 'Bahia',
  ceara: 'Ceará',
  maranhao: 'Maranhão',
  paraiba: 'Paraíba',
  pernambuco: 'Pernambuco',
  piaui: 'Piauí',
  'rio grande do norte': 'Rio Grande do Norte',
  sergipe: 'Sergipe',
  goias: 'Goiás',
  'mato grosso': 'Mato Grosso',
  'mato grosso do sul': 'Mato Grosso do Sul',
  'distrito federal': 'Distrito Federal',
  'espirito santo': 'Espírito Santo',
  'minas gerais': 'Minas Gerais',
  'rio de janeiro': 'Rio de Janeiro',
  'sao paulo': 'São Paulo',
  parana: 'Paraná',
  'rio grande do sul': 'Rio Grande do Sul',
  'santa catarina': 'Santa Catarina'
}

function normalizeString(s: string): string {
  // remove diacritics, punctuation, normalize spaces and lowercase
  const noDiacritics = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const cleaned = noDiacritics.replace(/[^a-zA-Z0-9\s]/g, ' ')
  return cleaned.replace(/\s+/g, ' ').trim().toLowerCase()
}

// prepare normalized mapping keys for substring matching
const preparedMapping = Object.entries(stateMapping).map(([k, v]) => ({
  key: k,
  canonical: v,
  normKey: normalizeString(k),
  normCanonical: normalizeString(v)
}))

function normalizeStateName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const rawNorm = normalizeString(trimmed)
  if (!rawNorm) return null

  // Exact match first (on prepared keys)
  for (const item of preparedMapping) {
    if (rawNorm === item.normKey || rawNorm === item.normCanonical)
      return item.canonical
  }

  // Substring match: pick the longest matching mapping key present in rawNorm
  let best: { canonical: string; len: number } | null = null
  for (const item of preparedMapping) {
    if (item.normKey && rawNorm.includes(item.normKey)) {
      const len = item.normKey.length
      if (!best || len > best.len) best = { canonical: item.canonical, len }
    }
    if (item.normCanonical && rawNorm.includes(item.normCanonical)) {
      const len = item.normCanonical.length
      if (!best || len > best.len) best = { canonical: item.canonical, len }
    }
  }
  if (best) return best.canonical

  // Try to match two-letter state code like 'sp' or uppercase variants
  const twoLetter = trimmed.match(/\b([A-Za-z]{2})\b/)
  if (twoLetter) {
    const code = twoLetter[1].toLowerCase()
    if (stateMapping[code]) return stateMapping[code]
  }

  return null
}

export default async function exportMapCache(): Promise<string> {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('MONGO_URI não definido. Abortando export-map-cache.')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri)
  try {
    await client.connect()
    const db = client.db('dwc2json')
    const occurrences = db.collection('occurrences')

    // Match occurrences where country or countryCode indicates Brazil.
    // We use a case-insensitive match by lowercasing the country field in aggregation.
    const pipeline = [
      {
        $addFields: {
          _countryLower: { $toLower: { $ifNull: ['$country', ''] } },
          _countryCode: { $ifNull: ['$countryCode', ''] }
        }
      },
      {
        $match: {
          $or: [
            { _countryLower: { $in: BRAZIL_VARIANTS } },
            { _countryLower: 'brasil' },
            { _countryCode: { $in: ['BR', 'br'] } }
          ],
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

    const items = await occurrences
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray()

    const normalized: Record<string, number> = {}
    let total = 0
    for (const it of items) {
      const raw = it._id
      const count =
        typeof it.count === 'number'
          ? it.count
          : parseInt(String(it.count)) || 0
      const norm = normalizeStateName(raw) || String(raw || 'Unknown')
      normalized[norm] = (normalized[norm] || 0) + count
      total += count
    }

    // Consolidate into official 27 states list plus 'Outros'
    const OFFICIAL_STATES = new Set([
      'Acre',
      'Alagoas',
      'Amapá',
      'Amazonas',
      'Bahia',
      'Ceará',
      'Distrito Federal',
      'Espírito Santo',
      'Goiás',
      'Maranhão',
      'Mato Grosso',
      'Mato Grosso do Sul',
      'Minas Gerais',
      'Paraná',
      'Paraíba',
      'Pará',
      'Pernambuco',
      'Piauí',
      'Rio de Janeiro',
      'Rio Grande do Norte',
      'Rio Grande do Sul',
      'Rondônia',
      'Roraima',
      'Santa Catarina',
      'São Paulo',
      'Sergipe',
      'Tocantins'
    ])

    const officialCounts: Record<string, number> = {}
    let othersTotal = 0
    for (const [name, cnt] of Object.entries(normalized)) {
      if (OFFICIAL_STATES.has(name)) {
        officialCounts[name] = (officialCounts[name] || 0) + cnt
      } else {
        othersTotal += cnt
      }
    }

    const regions = Object.entries(officialCounts)
      .map(([k, v]) => ({ _id: k, count: v }))
      .sort((a, b) => b.count - a.count)

    if (othersTotal > 0) {
      regions.push({ _id: 'Outros', count: othersTotal })
    }

    const output = {
      generatedAt: new Date().toISOString(),
      total,
      regions
    }

    const __filename = fileURLToPath(import.meta.url)
    const scriptDir = path.dirname(__filename)
    const repoRoot = path.resolve(scriptDir, '../../..')
    const webCacheDir = path.join(repoRoot, 'packages', 'web', 'cache')
    const outPath = path.join(webCacheDir, 'map-initial-load.json')

    fs.mkdirSync(webCacheDir, { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8')

    console.log('Arquivo gerado:', outPath)
    return outPath
  } finally {
    await client.close()
  }
}

if (import.meta.main) {
  exportMapCache().catch((err) => {
    console.error('Erro no exportMapCache:', err)
    process.exit(2)
  })
}
