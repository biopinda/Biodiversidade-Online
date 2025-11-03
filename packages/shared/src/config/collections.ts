/**
 * Nomes de coleções MongoDB
 * Centralizado para evitar typos e facilitar manutenção
 */

// Coleções raw (dados brutos do DwC-A)
export const TAXA_RAW_COLLECTION = 'taxa_ipt'
export const OCCURRENCES_RAW_COLLECTION = 'occurrences_ipt'

// Coleções transformed (dados processados e enriquecidos)
export const TAXA_COLLECTION = 'taxa'
export const OCCURRENCES_COLLECTION = 'occurrences'

// Coleções auxiliares
export const TRANSFORM_STATUS_COLLECTION = 'transform_status'
export const PROCESS_METRICS_COLLECTION = 'process_metrics'

// Coleções de enriquecimento
export const CNC_FLORA_FUNGI_COLLECTION = 'cncfloraFungi'
export const CNC_FLORA_PLANTAE_COLLECTION = 'cncfloraPlantae'
export const FAUNA_AMEACADA_COLLECTION = 'faunaAmeacada'
export const INVASORAS_COLLECTION = 'invasoras'
export const UCS_COLLECTION = 'catalogoucs'
