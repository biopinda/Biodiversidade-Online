/**
 * Tipos relacionados ao controle de bloqueios de processamento.
 */
import type { ObjectId } from 'mongodb'

export type TipoRecursoProcessamento =
  | 'fauna_ingestion'
  | 'flora_ingestion'
  | 'ocorrencias_ingestion'
  | 'fauna_transformation'
  | 'flora_transformation'
  | 'ocorrencias_transformation'

export interface InformacoesProcesso {
  workflow_run_id?: string
  iptId?: string
  estimated_duration?: number
  progress_info?: string
}

export interface BloqueioProcessamento {
  _id: ObjectId
  resource_type: TipoRecursoProcessamento
  is_locked: boolean
  locked_at: Date
  locked_by?: string
  lock_expires_at: Date
  process_info?: InformacoesProcesso
}
