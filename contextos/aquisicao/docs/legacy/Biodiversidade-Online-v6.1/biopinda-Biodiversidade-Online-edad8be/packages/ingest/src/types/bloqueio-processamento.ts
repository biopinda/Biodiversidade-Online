import { ObjectId } from 'mongodb'

/**
 * Interface para bloqueios de processamento
 * Controla concorrência de ingestão e transformação
 */
export interface BloqueioProcessamento {
  /** ID único do bloqueio */
  _id: ObjectId

  /** Tipo de recurso sendo processado */
  resource_type: ResourceType

  /** Estado do lock */
  is_locked: boolean

  /** Quando foi criado o lock */
  locked_at: Date

  /** Identificador do processo/workflow */
  locked_by: string

  /** Expiração automática do lock */
  lock_expires_at: Date

  /** Metadados do processo */
  process_info: ProcessInfo
}

/**
 * Tipos de recursos que podem ser bloqueados
 */
export type ResourceType =
  | 'fauna_ingestion'
  | 'flora_ingestion'
  | 'ocorrencias_ingestion'
  | 'fauna_transformation'
  | 'flora_transformation'
  | 'ocorrencias_transformation'

/**
 * Informações do processo que criou o lock
 */
export interface ProcessInfo {
  /** ID do GitHub Actions run */
  workflow_run_id?: string

  /** IPT sendo processado (se aplicável) */
  iptId?: string

  /** Duração estimada (ms) */
  estimated_duration: number

  /** Informações de progresso */
  progress_info?: string

  /** Hostname ou identificador do runner */
  runner_id?: string
}

/**
 * Opções para criação de lock
 */
export interface LockOptions {
  /** Identificador do processo */
  locked_by: string

  /** Duração estimada em milissegundos */
  estimated_duration: number

  /** Informações adicionais do processo */
  process_info?: Partial<ProcessInfo>

  /** Forçar criação mesmo se já existe */
  force_override?: boolean
}

/**
 * Resultado da criação de lock
 */
export interface LockResult {
  /** Se a operação foi bem-sucedida */
  success: boolean

  /** ID do lock criado */
  lock_id?: ObjectId

  /** Lock existente (se falhou por duplicação) */
  existing_lock?: BloqueioProcessamento

  /** Mensagem de erro */
  error?: string
}

/**
 * Status de um lock existente
 */
export interface LockStatus {
  /** Tipo de recurso */
  resource_type: string

  /** Se está bloqueado */
  is_locked: boolean

  /** Quem criou o lock */
  locked_by?: string

  /** Quando foi criado */
  locked_at?: Date

  /** Quando expira */
  expires_at?: Date

  /** Se já expirou */
  is_expired: boolean

  /** Tempo restante em segundos */
  time_remaining?: number
}

/**
 * Resultado da limpeza de locks
 */
export interface CleanupResult {
  /** Número de locks expirados removidos */
  expired_locks_removed: number

  /** Número de locks ainda ativos */
  active_locks: number

  /** Erros encontrados */
  errors: string[]

  /** Detalhes dos locks removidos */
  removed_locks: Array<{
    resource_type: string
    locked_by: string
    expired_duration: number // em segundos
  }>
}

/**
 * Opções para limpeza de locks
 */
export interface CleanupOptions {
  /** Forçar limpeza de todos os locks */
  force_all?: boolean

  /** Remover locks mais antigos que esta data */
  older_than?: Date

  /** Remover locks específicos por tipo */
  resource_types?: ResourceType[]

  /** Apenas simular limpeza */
  dry_run?: boolean
}

/**
 * Opções para remoção forçada de lock
 */
export interface ForceRemoveOptions {
  /** Motivo da remoção */
  reason: string

  /** Quem está removendo */
  removed_by: string

  /** Se deve registrar no log de auditoria */
  audit_log?: boolean
}
