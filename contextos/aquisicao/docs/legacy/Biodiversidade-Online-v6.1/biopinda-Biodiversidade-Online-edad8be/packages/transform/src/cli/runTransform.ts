import {
  TransformLockAcquisitionError,
  TransformProcessType,
  TransformStatusDocument,
  withTransformLock
} from '../lib/concurrency'
import { closeMongoClients } from '../lib/database'
import {
  createTransformMetricsTracker,
  mergeTransformProcess,
  ProcessMetricsTracker
} from '../lib/metrics'

export interface TransformLogger {
  info(message: string, ...details: unknown[]): void
  warn(message: string, ...details: unknown[]): void
  error(message: string, ...details: unknown[]): void
}

export interface TransformCliOptions {
  force?: boolean
  forceAll?: boolean
  runnerId?: string
  version?: string
  resourceIdentifier?: string
  dryRun?: boolean
}

export interface TransformPipelineContext {
  pipeline: TransformProcessType
  lock: TransformStatusDocument
  metrics: ProcessMetricsTracker
  logger: TransformLogger
  options: TransformCliOptions & { runnerId?: string; version?: string }
}

export interface TransformPipelineResult {
  processed?: number
  inserted?: number
  updated?: number
  failed?: number
  errorSummary?: Record<string, number>
}

export type TransformPipelineHandler = (
  context: TransformPipelineContext
) => Promise<TransformPipelineResult | void>

export interface TransformRunSummary {
  pipeline: TransformProcessType
  metricsSnapshot: ReturnType<ProcessMetricsTracker['snapshot']>
  result?: TransformPipelineResult | void
}

interface ParsedCliArguments extends TransformCliOptions {
  pipeline: TransformProcessType
}

const pipelineHandlers = new Map<
  TransformProcessType,
  TransformPipelineHandler
>()
let cliRegistered = false

export function registerTransformPipeline(
  pipeline: TransformProcessType,
  handler: TransformPipelineHandler
): void {
  pipelineHandlers.set(pipeline, handler)
}

export function getRegisteredPipelines(): TransformProcessType[] {
  return [...pipelineHandlers.keys()]
}

function getPipelineHandler(
  pipeline: TransformProcessType
): TransformPipelineHandler {
  const handler = pipelineHandlers.get(pipeline)
  if (!handler) {
    throw new Error(`Nenhum pipeline registrado para '${pipeline}'.`)
  }
  return handler
}

function createLogger(pipeline: TransformProcessType): TransformLogger {
  const prefix = `[transform:${pipeline}]`
  return {
    info(message, ...details) {
      console.log(prefix, message, ...details)
    },
    warn(message, ...details) {
      console.warn(prefix, message, ...details)
    },
    error(message, ...details) {
      console.error(prefix, message, ...details)
    }
  }
}

function parseCliArgs(argv: string[]): ParsedCliArguments {
  const args = [...argv]
  const options: TransformCliOptions = {}
  let pipeline: TransformProcessType | undefined

  while (args.length > 0) {
    const token = args.shift()!
    switch (token) {
      case '--force':
        options.force = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--runner':
        options.runnerId = args.shift()
        break
      case '--version':
        options.version = args.shift()
        break
      case '--resource':
        options.resourceIdentifier = args.shift()
        break
      case 'taxa':
      case 'occurrences':
        if (pipeline) {
          throw new Error(
            `Pipeline já definido (${pipeline}). Argumento inesperado '${token}'.`
          )
        }
        pipeline = token
        break
      default:
        throw new Error(`Argumento desconhecido '${token}'.`)
    }
  }

  if (!pipeline) {
    throw new Error('Informe o pipeline a executar: taxa ou occurrences.')
  }

  return { pipeline, ...options } as ParsedCliArguments
}

function haveCountersChanged(
  before: ReturnType<ProcessMetricsTracker['snapshot']>['counters'],
  after: ReturnType<ProcessMetricsTracker['snapshot']>['counters']
): boolean {
  return (
    before.processed !== after.processed ||
    before.inserted !== after.inserted ||
    before.updated !== after.updated ||
    before.failed !== after.failed
  )
}

function haveErrorsChanged(
  before: Record<string, number>,
  after: Record<string, number>
): boolean {
  const beforeKeys = Object.keys(before)
  const afterKeys = Object.keys(after)
  if (beforeKeys.length !== afterKeys.length) {
    return true
  }
  return beforeKeys.some((key) => before[key] !== after[key])
}

function applyPipelineResultToMetrics(
  metrics: ProcessMetricsTracker,
  result: TransformPipelineResult
): void {
  if (result.processed) {
    metrics.addProcessed(result.processed)
  }
  if (result.inserted) {
    metrics.addInserted(result.inserted)
  }
  if (result.updated) {
    metrics.addUpdated(result.updated)
  }
  if (result.failed) {
    metrics.addFailed(result.failed)
  }
  if (result.errorSummary) {
    for (const [key, value] of Object.entries(result.errorSummary)) {
      metrics.addError(key, value)
    }
  }
}

function resolveRunnerId(options: TransformCliOptions): string | undefined {
  return (
    options.runnerId ??
    process.env.GITHUB_RUN_ID ??
    process.env.RUNNER_TRACKING_ID ??
    process.env.RUNNER_NAME ??
    undefined
  )
}

async function getPackageVersion(): Promise<string> {
  try {
    const proc = Bun.spawn(['bun', 'pm', 'pkg', 'get', 'version'], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const output = await new Response(proc.stdout).text()
    const version = output.trim().replace(/^["']|["']$/g, '') // Remove quotes
    return version || 'unknown'
  } catch (error) {
    console.warn('Failed to get package version:', error)
    return 'unknown'
  }
}

async function resolveVersion(options: TransformCliOptions): Promise<string> {
  if (options.version) return options.version
  if (process.env.TRANSFORM_VERSION) return process.env.TRANSFORM_VERSION
  return await getPackageVersion()
}

export async function runTransform(
  pipeline: TransformProcessType,
  options: TransformCliOptions = {}
): Promise<TransformRunSummary> {
  const handler = getPipelineHandler(pipeline)
  const logger = createLogger(pipeline)
  const runnerId = resolveRunnerId(options)
  const version = await resolveVersion(options)

  let summary: TransformRunSummary | undefined

  await withTransformLock(
    pipeline,
    async (lockDoc) => {
      const metrics = createTransformMetricsTracker(
        mergeTransformProcess(pipeline),
        {
          runnerId,
          version,
          resourceIdentifier: options.resourceIdentifier,
          processId: lockDoc.process_id
        }
      )

      const before = metrics.snapshot()
      logger.info(`Iniciando pipeline (process_id=${lockDoc.process_id})`)

      let pipelineResult: TransformPipelineResult | void
      try {
        pipelineResult = await handler({
          pipeline,
          lock: lockDoc,
          metrics,
          logger,
          options: { ...options, runnerId, version }
        })
      } catch (error) {
        logger.error('Pipeline falhou.', error)
        await metrics.finish('failed', error)
        throw error
      }

      const afterExecution = metrics.snapshot()
      const countersChanged = haveCountersChanged(
        before.counters,
        afterExecution.counters
      )
      const errorsChanged = haveErrorsChanged(
        before.errorSummary,
        afterExecution.errorSummary
      )

      if (!countersChanged && pipelineResult) {
        applyPipelineResultToMetrics(metrics, pipelineResult)
      } else if (!errorsChanged && pipelineResult?.errorSummary) {
        for (const [key, value] of Object.entries(
          pipelineResult.errorSummary
        )) {
          metrics.addError(key, value)
        }
      }

      await metrics.finish('completed')
      const finalSnapshot = metrics.snapshot()

      const elapsedSeconds = (
        (Date.now() - finalSnapshot.startedAt.getTime()) /
        1000
      ).toFixed(1)
      logger.info(
        `Pipeline concluído em ${elapsedSeconds}s - processados=${finalSnapshot.counters.processed}, inseridos=${finalSnapshot.counters.inserted}, atualizados=${finalSnapshot.counters.updated}, falhas=${finalSnapshot.counters.failed}`
      )

      summary = {
        pipeline,
        metricsSnapshot: finalSnapshot,
        result: pipelineResult
      }
    },
    {
      force: options.force,
      runnerId
    }
  )

  if (!summary) {
    throw new Error('Falha ao executar pipeline: resumo não gerado.')
  }

  return summary
}

async function runTransformFromCli(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2))
  try {
    await runTransform(parsed.pipeline, parsed)
  } catch (error) {
    if (error instanceof TransformLockAcquisitionError) {
      console.error(
        `O pipeline '${error.processType}' já está em execução. Use --force ou verifique com transform:check-lock.`
      )
      if (error.activeLock) {
        console.error('Lock ativo:', {
          process_id: error.activeLock.process_id,
          started_at: error.activeLock.started_at,
          updated_at: error.activeLock.updated_at,
          runner_id: error.activeLock.runner_id
        })
      }
      process.exitCode = 1
    } else {
      console.error('Erro ao executar pipeline:', error)
      process.exitCode = 1
    }
  } finally {
    await closeMongoClients().catch(() => undefined)
  }
}

export async function runTransformCli(
  pipeline: TransformProcessType,
  options: TransformCliOptions = {}
): Promise<TransformRunSummary> {
  const summary = await runTransform(pipeline, options)
  await closeMongoClients().catch(() => undefined)
  return summary
}

export function registerRunTransformCli(): void {
  if (cliRegistered) {
    return
  }
  cliRegistered = true
  if (import.meta.main) {
    // Import registrations before running CLI
    import('./register').then(() => {
      void runTransformFromCli()
    })
  }
}

registerRunTransformCli()
