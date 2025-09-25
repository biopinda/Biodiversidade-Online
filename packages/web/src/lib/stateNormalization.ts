/**
 * Utilidades para harmonização de nomes de estados brasileiros.
 *
 * Estratégia:
 *  - Normalizamos a entrada (trim + lowercase)
 *  - Procuramos em um dicionário que contém abreviações, nomes completos com e sem acento
 *  - Para MongoDB, geramos uma expressão ($let + $switch) que aplica a mesma lógica no servidor
 */

// Mapeamento canônico. Chaves SEMPRE lowercase já normalizadas.
export const stateMapping: Record<string, string> = Object.freeze({
  // Abreviações oficiais
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

  // Nomes completos (com acento)
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

  // Nomes completos (sem acento)
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

/** Normaliza uma string para chave de lookup (trim + lowercase). */
function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

/**
 * Normaliza um nome de estado no lado do aplicativo.
 * Retorna nome canônico ou null se vazio/não mapeado.
 */
export function normalizeStateName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const key = normalizeKey(trimmed)
  return stateMapping[key] ?? null
}

/**
 * Gera expressão de agregação MongoDB que aplica a mesma lógica no servidor.
 * Uso: { $addFields: { normalizedState: createStateNormalizationExpression() } }
 */
export function createStateNormalizationExpression() {
  const branches = Object.entries(stateMapping).map(([key, canonical]) => ({
    case: { $eq: ['$$normalized', key] },
    then: canonical
  }))

  return {
    $let: {
      vars: {
        normalized: {
          $toLower: { $trim: { input: '$stateProvince' } }
        }
      },
      in: {
        $switch: {
          branches,
          default: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$stateProvince', null] },
                  { $eq: [{ $trim: { input: '$stateProvince' } }, ''] },
                  { $not: { $ifNull: ['$stateProvince', false] } }
                ]
              },
              then: null,
              else: '$stateProvince'
            }
          }
        }
      }
    }
  }
}

/** Pequeno helper para debug manual dentro de Node se necessário. */
export function debugNormalizeSamples(samples: string[]) {
  return samples.map((s) => ({ input: s, output: normalizeStateName(s) }))
}
