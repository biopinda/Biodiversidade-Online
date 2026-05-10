import { Collection, Db, MongoClient, ObjectId } from 'mongodb'
import {
  BloqueioProcessamento,
  CleanupOptions,
  CleanupResult,
  ForceRemoveOptions,
  LockOptions,
  LockResult,
  LockStatus,
  ResourceType
} from '../types/bloqueio-processamento.ts'

/**
 * Gerenciador de bloqueios para controle de concorrência
 */
export class GerenciadorBloqueios {
  private db: Db
  private collection: Collection<BloqueioProcessamento>

  constructor(db: Db) {
    this.db = db
    this.collection = db.collection<BloqueioProcessamento>('processingLocks')
  }

  /**
   * Cria um novo lock para o recurso especificado
   */
  async createProcessingLock(
    resourceType: ResourceType,
    options: LockOptions
  ): Promise<LockResult> {
    try {
      // Verificar se já existe lock ativo
      const existingLock = await this.collection.findOne({
        resource_type: resourceType,
        is_locked: true
      })

      if (existingLock && !options.force_override) {
        // Verificar se não expirou
        if (existingLock.lock_expires_at > new Date()) {
          return {
            success: false,
            existing_lock: existingLock,
            error: `Resource ${resourceType} is already locked by ${existingLock.locked_by}`
          }
        } else {
          // Lock expirado, remover
          await this.collection.updateOne(
            { _id: existingLock._id },
            { $set: { is_locked: false } }
          )
        }
      }

      // Criar novo lock
      const lockDoc: BloqueioProcessamento = {
        _id: new ObjectId(),
        resource_type: resourceType,
        is_locked: true,
        locked_at: new Date(),
        locked_by: options.locked_by,
        lock_expires_at: new Date(Date.now() + options.estimated_duration),
        process_info: {
          estimated_duration: options.estimated_duration,
          workflow_run_id: options.process_info?.workflow_run_id,
          iptId: options.process_info?.iptId,
          progress_info: options.process_info?.progress_info,
          runner_id: options.process_info?.runner_id
        }
      }

      const result = await this.collection.insertOne(lockDoc)

      return {
        success: true,
        lock_id: result.insertedId
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create lock: ${(error as Error).message}`
      }
    }
  }

  /**
   * Verifica o status de um lock
   */
  async checkLockStatus(resourceType: ResourceType): Promise<LockStatus> {
    const lock = await this.collection.findOne({
      resource_type: resourceType,
      is_locked: true
    })

    if (!lock) {
      return {
        resource_type: resourceType,
        is_locked: false,
        is_expired: false
      }
    }

    const now = new Date()
    const isExpired = lock.lock_expires_at <= now
    const timeRemaining = Math.max(
      0,
      Math.floor((lock.lock_expires_at.getTime() - now.getTime()) / 1000)
    )

    return {
      resource_type: resourceType,
      is_locked: !isExpired,
      locked_by: lock.locked_by,
      locked_at: lock.locked_at,
      expires_at: lock.lock_expires_at,
      is_expired: isExpired,
      time_remaining: timeRemaining
    }
  }

  /**
   * Remove locks expirados
   */
  async cleanupExpiredLocks(
    options: CleanupOptions = {}
  ): Promise<CleanupResult> {
    try {
      const now = new Date()
      const query: any = {}

      if (options.force_all) {
        // Remover todos os locks
        query.is_locked = true
      } else if (options.older_than) {
        // Remover locks mais antigos que data especificada
        query.locked_at = { $lt: options.older_than }
      } else {
        // Remover apenas expirados
        query.lock_expires_at = { $lt: now }
        query.is_locked = true
      }

      if (options.resource_types && options.resource_types.length > 0) {
        query.resource_type = { $in: options.resource_types }
      }

      // Buscar locks que serão removidos para relatório
      const locksToRemove = await this.collection.find(query).toArray()

      if (options.dry_run) {
        return {
          expired_locks_removed: locksToRemove.length,
          active_locks: await this.collection.countDocuments({
            is_locked: true
          }),
          errors: [],
          removed_locks: locksToRemove.map((lock) => ({
            resource_type: lock.resource_type,
            locked_by: lock.locked_by,
            expired_duration: Math.floor(
              (now.getTime() - lock.lock_expires_at.getTime()) / 1000
            )
          }))
        }
      }

      // Atualizar locks para desbloqueados
      const updateResult = await this.collection.updateMany(query, {
        $set: { is_locked: false }
      })

      const activeLocks = await this.collection.countDocuments({
        is_locked: true
      })

      return {
        expired_locks_removed: updateResult.modifiedCount,
        active_locks: activeLocks,
        errors: [],
        removed_locks: locksToRemove.map((lock) => ({
          resource_type: lock.resource_type,
          locked_by: lock.locked_by,
          expired_duration: Math.floor(
            (now.getTime() - lock.lock_expires_at.getTime()) / 1000
          )
        }))
      }
    } catch (error) {
      return {
        expired_locks_removed: 0,
        active_locks: 0,
        errors: [`Failed to cleanup locks: ${(error as Error).message}`],
        removed_locks: []
      }
    }
  }

  /**
   * Remove lock forçadamente (para emergências)
   */
  async forceRemoveLock(
    resourceType: ResourceType,
    options: ForceRemoveOptions
  ): Promise<{
    success: boolean
    removed_lock?: BloqueioProcessamento
    error?: string
  }> {
    try {
      const lock = await this.collection.findOne({
        resource_type: resourceType,
        is_locked: true
      })

      if (!lock) {
        return {
          success: false,
          error: `No active lock found for resource ${resourceType}`
        }
      }

      await this.collection.updateOne(
        { _id: lock._id },
        { $set: { is_locked: false } }
      )

      // Registrar auditoria se solicitado
      if (options.audit_log) {
        await this.db.collection('lockAuditLog').insertOne({
          action: 'force_remove',
          resource_type: resourceType,
          original_lock: lock,
          removed_by: options.removed_by,
          reason: options.reason,
          timestamp: new Date()
        })
      }

      return {
        success: true,
        removed_lock: lock
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to force remove lock: ${(error as Error).message}`
      }
    }
  }

  /**
   * Cria lock específico para IPT (mais granular)
   */
  async createIptLock(
    iptId: string,
    resourceType: ResourceType,
    options: Omit<LockOptions, 'process_info'> & {
      process_info?: Partial<LockOptions['process_info']>
    }
  ): Promise<LockResult> {
    // Usar resource type específico para IPT
    const iptResourceType = `${resourceType}_${iptId}` as ResourceType

    return this.createProcessingLock(iptResourceType, {
      ...options,
      process_info: {
        ...options.process_info,
        iptId
      }
    })
  }

  /**
   * Lista todos os locks ativos
   */
  async listActiveLocks(): Promise<LockStatus[]> {
    const locks = await this.collection.find({ is_locked: true }).toArray()
    const now = new Date()

    return locks.map((lock) => {
      const isExpired = lock.lock_expires_at <= now
      const timeRemaining = Math.max(
        0,
        Math.floor((lock.lock_expires_at.getTime() - now.getTime()) / 1000)
      )

      return {
        resource_type: lock.resource_type,
        is_locked: !isExpired,
        locked_by: lock.locked_by,
        locked_at: lock.locked_at,
        expires_at: lock.lock_expires_at,
        is_expired: isExpired,
        time_remaining: timeRemaining
      }
    })
  }
}

// Funções de conveniência para uso nos scripts
let gerenciadorInstance: GerenciadorBloqueios | null = null

/**
 * Inicializa o gerenciador de bloqueios
 */
export async function initializeLockManager(
  mongoUri: string
): Promise<GerenciadorBloqueios> {
  const client = new MongoClient(mongoUri)
  await client.connect()
  const db = client.db('dwc2json')

  gerenciadorInstance = new GerenciadorBloqueios(db)
  return gerenciadorInstance
}

/**
 * Obtém instância do gerenciador (deve ser inicializado primeiro)
 */
export function getLockManager(): GerenciadorBloqueios {
  if (!gerenciadorInstance) {
    throw new Error(
      'Lock manager not initialized. Call initializeLockManager first.'
    )
  }
  return gerenciadorInstance
}

// Exportar funções para uso direto
export async function createProcessingLock(
  resourceType: ResourceType,
  options: LockOptions
): Promise<LockResult> {
  return getLockManager().createProcessingLock(resourceType, options)
}

export async function checkLockStatus(
  resourceType: ResourceType
): Promise<LockStatus> {
  return getLockManager().checkLockStatus(resourceType)
}

export async function cleanupExpiredLocks(
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  return getLockManager().cleanupExpiredLocks(options)
}

export async function forceRemoveLock(
  resourceType: ResourceType,
  options: ForceRemoveOptions
): Promise<{
  success: boolean
  removed_lock?: BloqueioProcessamento
  error?: string
}> {
  return getLockManager().forceRemoveLock(resourceType, options)
}

export async function createIptLock(
  iptId: string,
  resourceType: ResourceType,
  options: LockOptions
): Promise<LockResult> {
  return getLockManager().createIptLock(iptId, resourceType, options)
}
