type IngestFloraOptions = {
  dry_run?: boolean
}

export async function main(_options: IngestFloraOptions): Promise<never> {
  throw new Error('Função não implementada: ingest-flora.main')
}

export async function checkIptVersion(_iptId: string): Promise<never> {
  throw new Error('Função não implementada: ingest-flora.checkIptVersion')
}
