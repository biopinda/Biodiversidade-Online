import type { Collection, FindOneAndUpdateOptions } from 'mongodb'
import type {
  BloqueioProcessamento,
  TipoRecursoProcessamento
} from '../types/bloqueio-processamento.ts'

type AcquireOptions = {
  owner: string
  ttlSeconds: number
  workflowRunId?: string
  iptId?: string
  estimatedDuration?: number
  progressInfo?: string
}

type AcquireResult =
  | { obtido: true; lock: BloqueioProcessamento }
  | { obtido: false; motivo: string; lock?: BloqueioProcessamento }

type ReleaseOptions = {
  owner?: string
}

type ReleaseResult = {
  liberado: boolean
}

type RenewOptions = {
  owner: string
  ttlSeconds: number
}

type RenewResult =
  | { renovado: true; lock: BloqueioProcessamento }
  | { renovado: false; motivo: string }

const sanitizeProcessInfo = (options: AcquireOptions) => {
  const processInfo: BloqueioProcessamento['process_info'] = {}
  if (options.workflowRunId) {
    processInfo.workflow_run_id = options.workflowRunId
  }
  if (options.iptId) {
    processInfo.iptId = options.iptId
  }
  if (options.estimatedDuration !== undefined) {
    processInfo.estimated_duration = options.estimatedDuration
  }
  if (options.progressInfo) {
    processInfo.progress_info = options.progressInfo
  }
  return Object.keys(processInfo).length > 0 ? processInfo : undefined
}

const defaultFindOneAndUpdateOptions: FindOneAndUpdateOptions = {
  upsert: true,
  returnDocument: 'after'
}

export const createGerenciadorBloqueios = (
  collection: Collection<BloqueioProcessamento>
) => {
  const adquirir = async (
    resourceType: TipoRecursoProcessamento,
    options: AcquireOptions
  ): Promise<AcquireResult> => {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + options.ttlSeconds * 1000)

    const currentLock = await collection.findOne({
      resource_type: resourceType
    })

    if (
      currentLock &&
      currentLock.is_locked === true &&
      currentLock.locked_by &&
      currentLock.locked_by !== options.owner &&
      currentLock.lock_expires_at &&
      currentLock.lock_expires_at > now
    ) {
      return {
        obtido: false,
        motivo: `Recurso já está bloqueado por ${currentLock.locked_by} até ${currentLock.lock_expires_at.toISOString()}`,
        lock: currentLock
      }
    }

    const filter = {
      resource_type: resourceType,
      $or: [
        { is_locked: { $ne: true } },
        { lock_expires_at: { $lte: now } },
        { locked_by: options.owner }
      ]
    }

    const processInfo = sanitizeProcessInfo(options)
    const unset: Record<string, unknown> = {}
    const set: Record<string, unknown> = {
      is_locked: true,
      locked_at: now,
      locked_by: options.owner,
      lock_expires_at: expiresAt
    }

    if (processInfo) {
      set.process_info = processInfo
    } else {
      unset.process_info = ''
    }

    const update: Record<string, unknown> = {
      $set: set,
      $setOnInsert: {
        resource_type: resourceType
      }
    }

    if (Object.keys(unset).length > 0) {
      update.$unset = unset
    }

    const result = await collection.findOneAndUpdate(
      filter,
      update,
      defaultFindOneAndUpdateOptions
    )

    if (result) {
      return { obtido: true, lock: result }
    }

    const current =
      currentLock ?? (await collection.findOne({ resource_type: resourceType }))
    return {
      obtido: false,
      motivo: current
        ? `Recurso já está bloqueado por ${current.locked_by} até ${current.lock_expires_at?.toISOString()}`
        : 'Recurso indisponível para bloqueio',
      lock: current ?? undefined
    }
  }

  const liberar = async (
    resourceType: TipoRecursoProcessamento,
    options: ReleaseOptions = {}
  ): Promise<ReleaseResult> => {
    const filter: Record<string, unknown> = {
      resource_type: resourceType
    }

    if (options.owner) {
      filter.locked_by = options.owner
    }

    const result = await collection.findOneAndUpdate(
      filter,
      {
        $set: {
          is_locked: false,
          locked_at: new Date(),
          lock_expires_at: new Date(0)
        },
        $unset: {
          locked_by: '',
          process_info: ''
        }
      },
      defaultFindOneAndUpdateOptions
    )

    return {
      liberado: Boolean(result && result.is_locked === false)
    }
  }

  const renovar = async (
    resourceType: TipoRecursoProcessamento,
    options: RenewOptions
  ): Promise<RenewResult> => {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + options.ttlSeconds * 1000)

    const result = await collection.findOneAndUpdate(
      {
        resource_type: resourceType,
        locked_by: options.owner,
        is_locked: true
      },
      {
        $set: {
          lock_expires_at: expiresAt,
          locked_at: now
        }
      },
      defaultFindOneAndUpdateOptions
    )

    if (!result) {
      return {
        renovado: false,
        motivo: 'Lock inexistente ou pertencente a outro processo'
      }
    }

    return {
      renovado: true,
      lock: result
    }
  }

  const listarAtivos = () => {
    return collection
      .find({ is_locked: true })
      .sort({ locked_at: -1 })
      .toArray()
  }

  return {
    adquirir,
    liberar,
    renovar,
    listarAtivos
  }
}

export type GerenciadorBloqueios = ReturnType<typeof createGerenciadorBloqueios>
export type {
  AcquireOptions,
  AcquireResult,
  ReleaseOptions,
  ReleaseResult,
  RenewOptions,
  RenewResult
}
