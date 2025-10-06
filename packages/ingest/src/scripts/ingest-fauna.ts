type IngestFaunaOptions = {
  dry_run?: boolean
}

export async function main(_options: IngestFaunaOptions): Promise<never> {
  throw new Error('Função não implementada: ingest-fauna.main')
}

export async function checkIptVersion(_iptId: string): Promise<never> {
  throw new Error('Função não implementada: ingest-fauna.checkIptVersion')
}
