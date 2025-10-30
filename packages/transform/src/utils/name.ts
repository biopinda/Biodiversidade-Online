const NON_ALNUM_REGEX = /[^a-zA-Z0-9]/g

export function buildFlatScientificName(value: string): string {
  return value.replace(NON_ALNUM_REGEX, '').toLocaleLowerCase()
}

export function normalizeNameKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return buildFlatScientificName(trimmed)
}
