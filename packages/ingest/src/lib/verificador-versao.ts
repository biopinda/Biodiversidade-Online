import { Collection, Db, MongoClient } from 'mongodb'
import { getEml, processaEml, type DbIpt } from './dwca.ts'

/**
 * Extensão do DbIpt para incluir controles de processamento
 */
export interface ExtendedDbIpt extends DbIpt {
  processing_control?: {
    last_ingestion_check?: Date
    last_ingestion_fauna?: Date
    last_ingestion_flora?: Date
    last_ingestion_ocorrencias?: Date
    version_hash?: string
    is_processing?: boolean
    next_scheduled?: Date
    last_error?: string
  }
  statistics?: {
    fauna?: {
      total_documents: number
      processed_documents: number
      failed_documents: number
    }
    flora?: {
      total_documents: number
      processed_documents: number
      failed_documents: number
    }
    ocorrencias?: {
      total_documents: number
      processed_documents: number
      failed_documents: number
    }
  }
}

/**
 * Resultado da verificação de versão do IPT
 */
export interface VersionCheckResult {
  /** Versão atual no IPT remoto */
  current_version: string

  /** Se precisa atualizar */
  needs_update: boolean

  /** Data da última modificação */
  last_modified: Date

  /** Estimativa de mudanças (se disponível) */
  estimated_changes?: number

  /** URL do IPT verificado */
  ipt_url: string

  /** ID do IPT */
  ipt_id: string
}

/**
 * Opções para verificação de versão
 */
export interface VersionCheckOptions {
  /** Timeout para a requisição em ms */
  timeout?: number

  /** Forçar verificação mesmo se cache local está válido */
  force_check?: boolean

  /** Cache local válido por quantos minutos */
  cache_validity_minutes?: number
}

/**
 * Verificador de versões IPT
 */
export class VerificadorVersao {
  private db: Db
  private iptsCollection: Collection<ExtendedDbIpt>

  constructor(db: Db) {
    this.db = db
    this.iptsCollection = db.collection<ExtendedDbIpt>('ipts')
  }

  /**
   * Verifica se IPT precisa ser atualizado
   */
  async checkIptVersion(
    iptId: string,
    iptUrl: string,
    options: VersionCheckOptions = {}
  ): Promise<VersionCheckResult> {
    const {
      timeout = 10000,
      force_check = false,
      cache_validity_minutes = 5
    } = options

    let localIpt: ExtendedDbIpt | null = null

    try {
      // Buscar versão local no banco
      localIpt = await this.iptsCollection.findOne({ _id: iptId })

      // Verificar cache local se não for forçado
      if (!force_check && localIpt?.processing_control?.last_ingestion_check) {
        const cacheAge =
          Date.now() -
          localIpt.processing_control.last_ingestion_check.getTime()
        const cacheValidMs = cache_validity_minutes * 60 * 1000

        if (cacheAge < cacheValidMs) {
          return {
            current_version: localIpt.version as string,
            needs_update: false,
            last_modified: localIpt.processing_control.last_ingestion_check,
            ipt_url: iptUrl,
            ipt_id: iptId
          }
        }
      }

      // Buscar versão remota
      const emlUrl = `${iptUrl}eml.do?r=${iptId.split('/').pop()}`
      const eml = await getEml(emlUrl, timeout)
      const remoteIpt = processaEml(eml)

      const needsUpdate = !localIpt || localIpt.version !== remoteIpt.version

      // Atualizar cache de verificação
      await this.updateVersionCheckCache(iptId, remoteIpt.version)

      return {
        current_version: remoteIpt.version,
        needs_update: needsUpdate,
        last_modified: new Date(),
        ipt_url: iptUrl,
        ipt_id: iptId
      }
    } catch (error) {
      // Em caso de erro, assumir que não precisa atualizar para evitar loops
      const fallbackVersion = (localIpt?.version as string) || 'unknown'

      throw new Error(
        `Failed to check IPT version for ${iptId}: ${(error as Error).message}`
      )
    }
  }

  /**
   * Verifica múltiplos IPTs em paralelo
   */
  async checkMultipleIpts(
    iptConfigs: Array<{ id: string; url: string }>,
    options: VersionCheckOptions = {}
  ): Promise<VersionCheckResult[]> {
    const promises = iptConfigs.map((config) =>
      this.checkIptVersion(config.id, config.url, options).catch(
        (error) =>
          ({
            current_version: 'error',
            needs_update: false,
            last_modified: new Date(),
            ipt_url: config.url,
            ipt_id: config.id,
            error: error.message
          }) as VersionCheckResult & { error: string }
      )
    )

    return Promise.all(promises)
  }

  /**
   * Atualiza cache de verificação de versão
   */
  private async updateVersionCheckCache(
    iptId: string,
    version: string
  ): Promise<void> {
    await this.iptsCollection.updateOne(
      { _id: iptId },
      {
        $set: {
          'processing_control.last_ingestion_check': new Date(),
          'processing_control.version_hash': this.generateVersionHash(version)
        }
      },
      { upsert: true }
    )
  }

  /**
   * Gera hash da versão para comparação rápida
   */
  private generateVersionHash(version: string): string {
    // Hash simples baseado na versão
    return Buffer.from(version).toString('base64').substring(0, 16)
  }

  /**
   * Obtém estatísticas de IPTs por status
   */
  async getIptStatistics(): Promise<{
    total: number
    needs_update: number
    up_to_date: number
    never_checked: number
    check_errors: number
  }> {
    const [total, withCache, withErrors] = await Promise.all([
      this.iptsCollection.countDocuments(),
      this.iptsCollection.countDocuments({
        'processing_control.last_ingestion_check': { $exists: true }
      }),
      this.iptsCollection.countDocuments({
        'processing_control.last_error': { $exists: true }
      })
    ])

    // Esta é uma implementação simplificada
    // Em produção, seria necessário verificar todos os IPTs para estatísticas precisas
    return {
      total,
      needs_update: 0, // Seria calculado verificando todos
      up_to_date: withCache,
      never_checked: total - withCache,
      check_errors: withErrors
    }
  }

  /**
   * Limpa cache de verificações antigas
   */
  async cleanOldVersionChecks(olderThanHours: number = 24): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)

    const result = await this.iptsCollection.updateMany(
      {
        'processing_control.last_ingestion_check': { $lt: cutoffDate }
      },
      {
        $unset: {
          'processing_control.last_ingestion_check': '',
          'processing_control.version_hash': ''
        }
      }
    )

    return result.modifiedCount
  }
}

// Funções de conveniência para uso direto
let verificadorInstance: VerificadorVersao | null = null

/**
 * Inicializa o verificador de versão
 */
export async function initializeVersionChecker(
  mongoUri: string
): Promise<VerificadorVersao> {
  const client = new MongoClient(mongoUri)
  await client.connect()
  const db = client.db('dwc2json')

  verificadorInstance = new VerificadorVersao(db)
  return verificadorInstance
}

/**
 * Obtém instância do verificador
 */
export function getVersionChecker(): VerificadorVersao {
  if (!verificadorInstance) {
    throw new Error(
      'Version checker not initialized. Call initializeVersionChecker first.'
    )
  }
  return verificadorInstance
}

/**
 * Verifica versão de um IPT específico
 */
export async function checkIptVersion(
  iptId: string,
  iptUrl: string,
  options?: VersionCheckOptions
): Promise<VersionCheckResult> {
  return getVersionChecker().checkIptVersion(iptId, iptUrl, options)
}

/**
 * Verifica se dados mudaram comparando hash
 */
export function hasDataChanged(
  oldVersion: string,
  newVersion: string
): boolean {
  return oldVersion !== newVersion
}

/**
 * Determina prioridade de atualização baseada em padrões de versão
 */
export function getUpdatePriority(
  oldVersion: string,
  newVersion: string
): 'low' | 'medium' | 'high' {
  // Lógica simples baseada em diferenças de versão
  if (!oldVersion) return 'high' // Primeira ingestão

  // Tentar detectar mudanças maiores vs menores
  const oldParts = oldVersion.split('.')
  const newParts = newVersion.split('.')

  if (oldParts[0] !== newParts[0]) return 'high' // Major version change
  if (oldParts[1] !== newParts[1]) return 'medium' // Minor version change

  return 'low' // Patch or timestamp change
}
