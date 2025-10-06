type TransformFaunaOptions = {
  dry_run?: boolean
}

type GetDocumentsToTransformOptions = {
  only_unprocessed?: boolean
}

export async function main(_options: TransformFaunaOptions): Promise<never> {
  throw new Error('Função não implementada: transform-fauna.main')
}

export async function getDocumentsToTransform(
  _options: GetDocumentsToTransformOptions
): Promise<never> {
  throw new Error(
    'Função não implementada: transform-fauna.getDocumentsToTransform'
  )
}
