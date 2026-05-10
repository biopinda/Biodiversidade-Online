import { ObjectId } from 'mongodb'

/**
 * Interface para documentos originais preservados sem transformação
 * Armazena dados IPT exatos conforme recebidos do DwC-A
 */
export interface DocumentoOriginal {
  /** ID único do documento */
  _id: ObjectId

  /** Identificador do IPT (corresponde ao campo iptId atual) */
  iptId: string

  /** Tag do IPT (ex: "inpa", "jabot", "speciesLink") */
  ipt: string

  /** ID do registro no IPT original */
  ipt_record_id: string

  /** Hash/versão do IPT no momento da ingestão */
  ipt_version: string

  /** Tipo de dados */
  collection_type: 'fauna' | 'flora' | 'ocorrencias'

  /** Dados originais exatos do DwC-A */
  original_data: DwCRecord

  /** Metadados de ingestão */
  ingestion_metadata: IngestionMetadata

  /** Status de processamento */
  processing_status: ProcessingStatus
}

/**
 * Estrutura Darwin Core preservada
 */
export interface DwCRecord {
  scientificName?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  specificEpithet?: string
  taxonRank?: string
  taxonomicStatus?: string
  distribution?: any[] | any
  vernacularname?: any[]
  higherClassification?: string
  resourcerelationship?: any[]
  speciesprofile?: any[]

  // Campos de ocorrências
  decimalLatitude?: string | number
  decimalLongitude?: string | number
  eventDate?: string | Date
  recordedBy?: string
  locality?: string
  country?: string
  stateProvince?: string
  county?: string
  institutionCode?: string
  collectionCode?: string
  catalogNumber?: string
  basisOfRecord?: string

  // Outros campos Darwin Core
  [key: string]: any
}

/**
 * Metadados de ingestão
 */
export interface IngestionMetadata {
  /** Quando foi ingerido */
  timestamp: Date

  /** URL do IPT fonte */
  source_ipt_url: string

  /** Versão do script de ingestão */
  processing_version: string

  /** Versão do arquivo DwC-A */
  dwca_version: string
}

/**
 * Status de processamento
 */
export interface ProcessingStatus {
  /** Se foi transformado */
  is_processed: boolean

  /** Última tentativa de transformação */
  last_transform_attempt: Date | null

  /** Erro na transformação (se houver) */
  transform_error?: string
}

/**
 * Interface para opções de preservação
 */
export interface PreservationOptions {
  /** Forçar preservação mesmo se versão não mudou */
  force_preservation?: boolean

  /** Falhar se preservação der erro */
  fail_on_preservation_error?: boolean

  /** Tamanho do lote para inserção */
  batch_size?: number

  /** Apenas simular, não persistir */
  dry_run?: boolean
}

/**
 * Resultado da preservação de dados
 */
export interface PreservationResult {
  /** Status da operação */
  status: 'success' | 'failure' | 'partial'

  /** Número de documentos preservados */
  documents_preserved: number

  /** Número de documentos que falharam */
  failed_documents: number

  /** Duração da operação em segundos */
  duration: number

  /** Erros encontrados */
  errors: Array<{
    record_id: string
    error: string
  }>

  /** Se preservação falhou mas não quebrou fluxo */
  preservation_failed?: boolean
}
