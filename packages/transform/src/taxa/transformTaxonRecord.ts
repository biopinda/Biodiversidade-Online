import type { Db } from 'mongodb'
import type {
  NormalizedTaxonDocument,
  RawTaxonDocument
} from './normalizeTaxon.js'
import { normalizeTaxon } from './normalizeTaxon.js'

/**
 * Transforma um registro de táxon bruto em formato normalizado
 *
 * Esta função é usada durante ingestão inline para transformação básica.
 * Enriquecimentos complexos (ameaça, invasoras, UCs) são aplicados via
 * scripts de enriquecimento standalone (enrich:ameacadas, enrich:invasoras, enrich:ucs)
 *
 * @param rawDoc - Documento bruto de táxon
 * @param db - Instância do banco de dados MongoDB (não usado na versão simplificada)
 * @returns Documento transformado para inserção em taxa (ou null se filtrado/inválido)
 */
export async function transformTaxonRecord(
  rawDoc: RawTaxonDocument,
  db?: Db
): Promise<NormalizedTaxonDocument | null> {
  // Normalização (canonicalName, flatScientificName, vernacularname, distribution)
  const normalized = normalizeTaxon(rawDoc)

  // Se normalização retornou null (ex: taxonRank inválido), filtrar
  if (!normalized) {
    return null
  }

  // _id já é preservado dentro de normalizeTaxon()
  // Nota: Enriquecimentos (ameaça, invasoras, UCs) são aplicados apenas
  // durante re-transformação em massa para melhor performance

  return normalized
}
