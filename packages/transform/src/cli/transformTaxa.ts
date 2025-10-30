import { createTaxaTransformHandler } from '../taxa/transformTaxa'
import type {
  TransformCliOptions,
  TransformPipelineHandler
} from './runTransform'
import { registerTransformPipeline, runTransformCli } from './runTransform'

let cachedHandler: TransformPipelineHandler | null = null

async function getOrCreateHandler(): Promise<TransformPipelineHandler> {
  if (!cachedHandler) {
    cachedHandler = await createTaxaTransformHandler()
  }
  return cachedHandler
}

export function registerTransformTaxaCli(): void {
  registerTransformPipeline('taxa', async (context) => {
    const handler = await getOrCreateHandler()
    return handler(context)
  })
}

export function runTransformTaxaCli(options?: TransformCliOptions) {
  return runTransformCli('taxa', options)
}

registerTransformTaxaCli()
