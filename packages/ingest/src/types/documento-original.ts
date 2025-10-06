/**
 * Tipos para representar documentos originais armazenados nas coleções dedicadas
 * (`taxaOriginal` e `ocorrenciasOriginal`).
 *
 * Estes tipos refletem o modelo descrito em `specs/003-manter-dados-originais/data-model.md`.
 */
import type { ObjectId } from 'mongodb'

export type TipoColecaoOriginal = 'fauna' | 'flora' | 'ocorrencias'

export interface MetadadosIngestao {
  /** Momento em que o documento original foi persistido */
  timestamp: Date
  /** URL de origem do IPT (EML/DwC-A) */
  source_ipt_url: string
  /** Versão do script/responsável pela ingestão */
  processing_version: string
  /** Versão do arquivo DwC-A processado */
  dwca_version: string
}

export interface StatusProcessamento {
  /** Indica se o documento já passou por transformação */
  is_processed: boolean
  /** Data da última tentativa de transformação */
  last_transform_attempt?: Date
  /** Mensagem de erro na transformação (se aplicável) */
  transform_error?: string
  /** Versão do pipeline que gerou o documento transformado */
  pipeline_version?: string
}

export interface DocumentoOriginal<TDados = Record<string, unknown>> {
  /** Identificador único do documento original */
  _id: ObjectId
  /** Identificador do IPT (normalmente URL) */
  iptId: string
  /** Tag amigável do IPT (ex.: jabot, inpa) */
  ipt?: string
  /** Identificador do registro original no IPT */
  ipt_record_id: string
  /** Hash ou número de versão do IPT no momento da ingestão */
  ipt_version: string
  /** Tipo de coleção ao qual o registro pertence */
  collection_type: TipoColecaoOriginal
  /** Conteúdo bruto do registro Darwin Core */
  original_data: TDados
  /** Metadados de auditoria da ingestão */
  ingestion_metadata: MetadadosIngestao
  /** Status de processamento para pipelines offline */
  processing_status: StatusProcessamento
}
