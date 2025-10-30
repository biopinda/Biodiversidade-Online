import { createOccurrencesTransformHandler } from '../occurrences/transformOccurrences'
import type {
  TransformCliOptions,
  TransformPipelineHandler
} from './runTransform'
import { registerTransformPipeline, runTransformCli } from './runTransform'

let cachedHandler: TransformPipelineHandler | null = null

async function getOrCreateHandler(): Promise<TransformPipelineHandler> {
  if (!cachedHandler) {
    cachedHandler = await createOccurrencesTransformHandler()
  }
  return cachedHandler
}

export function registerTransformOccurrencesCli(): void {
  registerTransformPipeline('occurrences', async (context) => {
    const handler = await getOrCreateHandler()
    return handler(context)
  })
}

export function runTransformOccurrencesCli(options?: TransformCliOptions) {
  return runTransformCli('occurrences', options)
}

registerTransformOccurrencesCli()
