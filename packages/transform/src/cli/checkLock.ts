import {
  forceReleaseTransformLock,
  getTransformStatus,
  TransformProcessType,
  TransformStatusDocument
} from '../lib/concurrency'
import { closeMongoClients } from '../lib/database'

export interface CheckLockOptions {
  pipelines?: TransformProcessType[]
  force?: boolean
  reason?: string
}

export type LockStatusMap = Record<
  TransformProcessType,
  TransformStatusDocument | null
>

const ALL_PIPELINES: TransformProcessType[] = ['taxa', 'occurrences']

export async function checkTransformLocks(
  options: CheckLockOptions = {}
): Promise<LockStatusMap> {
  const pipelines =
    options.pipelines && options.pipelines.length > 0
      ? options.pipelines
      : ALL_PIPELINES
  const result: LockStatusMap = {
    taxa: null,
    occurrences: null
  }

  for (const pipeline of pipelines) {
    const currentStatus = await getTransformStatus(pipeline)
    result[pipeline] = currentStatus

    if (options.force && currentStatus) {
      const reason =
        options.reason ??
        `Unlock requested via CLI on ${new Date().toISOString()}`
      await forceReleaseTransformLock(pipeline, reason)
      result[pipeline] = await getTransformStatus(pipeline)
    }
  }

  return result
}

function parseCliArgs(argv: string[]): CheckLockOptions {
  const args = [...argv]
  const pipelines: TransformProcessType[] = []
  const options: CheckLockOptions = {}

  while (args.length > 0) {
    const token = args.shift()!
    switch (token) {
      case '--force':
        options.force = true
        break
      case '--reason':
        options.reason = args.shift() ?? ''
        break
      case '--all':
        pipelines.push(...ALL_PIPELINES)
        break
      case 'taxa':
      case 'occurrences':
        pipelines.push(token)
        break
      default:
        throw new Error(`Argumento desconhecido '${token}'.`)
    }
  }

  if (pipelines.length > 0) {
    options.pipelines = Array.from(new Set(pipelines))
  }

  return options
}

function logStatusMap(statusMap: LockStatusMap, forced: boolean): void {
  for (const pipeline of ALL_PIPELINES) {
    const status = statusMap[pipeline]
    if (!status) {
      console.log(`[transform:${pipeline}] Nenhum lock ativo.`)
      continue
    }
    console.log(
      `[transform:${pipeline}] status=${status.status} process_id=${status.process_id}`
    )
    console.log(
      `  started_at=${status.started_at?.toISOString?.() ?? status.started_at}`
    )
    console.log(
      `  updated_at=${status.updated_at?.toISOString?.() ?? status.updated_at}`
    )
    if (status.runner_id) {
      console.log(`  runner_id=${status.runner_id}`)
    }
    if (status.error_message) {
      console.log(`  error_message=${status.error_message}`)
    }
    if (status.forced) {
      console.log('  forced=true')
    }
    if (forced) {
      console.log('  Lock liberado (force=true).')
    }
  }
}

async function runCheckLockCli(): Promise<void> {
  try {
    const options = parseCliArgs(process.argv.slice(2))
    const statuses = await checkTransformLocks(options)
    logStatusMap(statuses, Boolean(options.force))
  } catch (error) {
    console.error('Erro ao verificar locks:', error)
    process.exitCode = 1
  } finally {
    await closeMongoClients().catch(() => undefined)
  }
}

let cliRegistered = false

export function registerCheckLockCli(): void {
  if (cliRegistered) {
    return
  }
  cliRegistered = true
  if (import.meta.main) {
    void runCheckLockCli()
  }
}

registerCheckLockCli()
