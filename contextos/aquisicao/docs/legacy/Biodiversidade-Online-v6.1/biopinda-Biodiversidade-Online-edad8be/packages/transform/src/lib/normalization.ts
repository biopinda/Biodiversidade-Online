export const stateMapping: Record<string, string> = Object.freeze({
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
  amapá: 'Amapá',
  amazonas: 'Amazonas',
  pará: 'Pará',
  rondônia: 'Rondônia',
  roraima: 'Roraima',
  tocantins: 'Tocantins',
  alagoas: 'Alagoas',
  bahia: 'Bahia',
  ceará: 'Ceará',
  maranhão: 'Maranhão',
  paraíba: 'Paraíba',
  pernambuco: 'Pernambuco',
  piauí: 'Piauí',
  'rio grande do norte': 'Rio Grande do Norte',
  sergipe: 'Sergipe',
  goiás: 'Goiás',
  'mato grosso': 'Mato Grosso',
  'mato grosso do sul': 'Mato Grosso do Sul',
  'distrito federal': 'Distrito Federal',
  'espírito santo': 'Espírito Santo',
  'minas gerais': 'Minas Gerais',
  'rio de janeiro': 'Rio de Janeiro',
  'são paulo': 'São Paulo',
  paraná: 'Paraná',
  'rio grande do sul': 'Rio Grande do Sul',
  'santa catarina': 'Santa Catarina',
  amapa: 'Amapá',
  para: 'Pará',
  rondonia: 'Rondônia',
  goias: 'Goiás',
  maranhao: 'Maranhão',
  paraiba: 'Paraíba',
  piaui: 'Piauí',
  'espirito santo': 'Espírito Santo',
  'sao paulo': 'São Paulo',
  parana: 'Paraná',
  ceara: 'Ceará'
})

export const countryMapping: Record<string, string> = Object.freeze({
  brasil: 'Brasil',
  brazil: 'Brasil',
  'brasil ': 'Brasil',
  'brazil ': 'Brasil',
  BRASIL: 'Brasil',
  BRAZIL: 'Brasil',
  'BRASIL ': 'Brasil',
  'BRAZIL ': 'Brasil'
})

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeStateName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const key = normalizeKey(trimmed)
  return stateMapping[key] ?? null
}

export function normalizeCountryName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const key = normalizeKey(trimmed)
  return countryMapping[key] ?? null
}
