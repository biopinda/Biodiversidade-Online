type IngestOcorrenciasOptions = {
  dry_run?: boolean
  ipt_urls?: string[]
  ipt_filter?: unknown
}

export async function main(_options: IngestOcorrenciasOptions): Promise<never> {
  throw new Error('Função não implementada: ingest-ocorrencias.main')
}

export async function checkIptVersion(_iptId: string): Promise<never> {
  throw new Error('Função não implementada: ingest-ocorrencias.checkIptVersion')
}
