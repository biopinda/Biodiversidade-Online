type TransformFloraOptions = {
  dry_run?: boolean
}

type GetDocumentsToTransformOptions = {
  only_unprocessed?: boolean
}

export async function main(_options: TransformFloraOptions): Promise<never> {
  throw new Error('Função não implementada: transform-flora.main')
}

export async function getDocumentsToTransform(
  _options: GetDocumentsToTransformOptions
): Promise<never> {
  throw new Error(
    'Função não implementada: transform-flora.getDocumentsToTransform'
  )
}
