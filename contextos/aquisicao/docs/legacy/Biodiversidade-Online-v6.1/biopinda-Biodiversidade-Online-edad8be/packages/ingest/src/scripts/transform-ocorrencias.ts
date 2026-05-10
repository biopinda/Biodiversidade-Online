type TransformOcorrenciasOptions = {
  dry_run?: boolean
}

type GetDocumentsToTransformOptions = {
  only_unprocessed?: boolean
}

export async function main(
  _options: TransformOcorrenciasOptions
): Promise<never> {
  throw new Error('Função não implementada: transform-ocorrencias.main')
}

export async function getDocumentsToTransform(
  _options: GetDocumentsToTransformOptions
): Promise<never> {
  throw new Error(
    'Função não implementada: transform-ocorrencias.getDocumentsToTransform'
  )
}
