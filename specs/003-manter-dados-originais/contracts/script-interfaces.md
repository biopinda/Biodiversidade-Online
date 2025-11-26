# Contratos de Interface: Scripts Bun

Este arquivo define as interfaces dos scripts Bun que serão executados pelos workflows GitHub Actions.
Não há APIs REST - todos os scripts se conectam diretamente ao MongoDB via MONGO_URI.

## Interface dos Scripts de Ingestão

### Script: ingest-fauna.ts

```typescript
interface IngestionScriptOptions {
  ipt_url?: string // URL específica do IPT (opcional)
  force_reprocess?: boolean // Forçar reprocessamento mesmo sem mudanças
  batch_size?: number // Tamanho do lote para processamento (default: 5000)
  timeout?: number // Timeout em segundos (default: 3600)
  dry_run?: boolean // Apenas simular, não persistir dados
}

interface IngestionResult {
  status: 'success' | 'failure' | 'skipped'
  document_count: number // Documentos processados
  duration: number // Duração em segundos
  ipt_version: string // Versão do IPT processada
  ipt_id: string // ID do IPT processado
  error_message?: string // Mensagem de erro se status = failure
  skipped_reason?: string // Motivo se status = skipped
  processing_stats: {
    total_from_ipt: number // Total de registros no IPT
    inserted: number // Novos documentos inseridos
    updated: number // Documentos atualizados
    removed: number // Documentos removidos (não presentes no IPT)
    failed: number // Documentos com falha
  }
}

// Função principal exportada
export async function main(
  options: IngestionScriptOptions = {}
): Promise<IngestionResult>

// Função para verificar versão do IPT
export async function checkIptVersion(iptId: string): Promise<{
  current_version: string
  needs_update: boolean
  last_modified: Date
}>
```

### Script: ingest-flora.ts

```typescript
// Mesma interface que ingest-fauna.ts
export async function main(
  options: IngestionScriptOptions = {}
): Promise<IngestionResult>
export async function checkIptVersion(
  iptId: string
): Promise<VersionCheckResult>
```

### Script: ingest-ocorrencias.ts

```typescript
interface OccurrenceIngestionOptions extends IngestionScriptOptions {
  ipt_urls?: string[] // Múltiplas URLs para ocorrências
  ipt_filter?: string // Filtrar por tag específica de IPT
}

export async function main(
  options: OccurrenceIngestionOptions = {}
): Promise<IngestionResult>
export async function checkIptVersion(
  iptId: string
): Promise<VersionCheckResult>
```

## Interface dos Scripts de Transformação

### Script: transform-fauna.ts

```typescript
interface TransformationOptions {
  ipt_filter?: string // Filtrar por IPT específico
  date_from?: Date // Filtro de data início
  date_to?: Date // Filtro de data fim
  force_reprocess?: boolean // Reprocessar documentos já transformados
  batch_size?: number // Tamanho do lote (default: 1000)
  pipeline_version?: string // Versão específica do pipeline
  dry_run?: boolean // Apenas simular
}

interface TransformationResult {
  status: 'success' | 'failure' | 'partial'
  success_count: number // Documentos transformados com sucesso
  failure_count: number // Documentos que falharam
  fallback_count: number // Documentos que usaram fallback
  skipped_count: number // Documentos já processados (não force)
  pipeline_version: string // Versão do pipeline utilizada
  duration: number // Duração em segundos
  processing_errors: Array<{
    document_id: string
    error: string
    fallback_applied: boolean
  }>
}

export async function main(
  options: TransformationOptions = {}
): Promise<TransformationResult>

// Função para obter documentos a serem transformados
export async function getDocumentsToTransform(filters: {
  ipt_filter?: string
  date_range?: { from: Date; to: Date }
  only_unprocessed?: boolean
}): Promise<number> // Retorna contagem para estimativa
```

### Script: transform-flora.ts

```typescript
// Mesma interface que transform-fauna.ts
export async function main(
  options: TransformationOptions = {}
): Promise<TransformationResult>
export async function getDocumentsToTransform(
  filters: TransformFilters
): Promise<number>
```

### Script: transform-ocorrencias.ts

```typescript
// Mesma interface que transform-fauna.ts
export async function main(
  options: TransformationOptions = {}
): Promise<TransformationResult>
export async function getDocumentsToTransform(
  filters: TransformFilters
): Promise<number>
```

## Interface de Utilitários

### Script: check-locks.ts

```typescript
interface LockStatus {
  resource_type: string
  is_locked: boolean
  locked_by?: string
  locked_at?: Date
  expires_at?: Date
  is_expired: boolean
}

export async function main(): Promise<LockStatus[]>
export async function checkLock(resourceType: string): Promise<LockStatus>
```

### Script: cleanup-locks.ts

```typescript
interface CleanupResult {
  expired_locks_removed: number
  active_locks: number
  errors: string[]
}

export async function main(options: {
  force_all?: boolean // Forçar limpeza de todos os locks
  older_than?: Date // Remover locks mais antigos que data
}): Promise<CleanupResult>
```

### Script: ipt-status.ts

```typescript
interface IPTStatusReport {
  total_ipts: number
  by_type: {
    fauna: number
    flora: number
    ocorrencias: number
  }
  processing_status: {
    available: number
    processing: number
    error: number
  }
  last_ingestion: {
    fauna?: Date
    flora?: Date
    ocorrencias?: Date
  }
}

export async function main(): Promise<IPTStatusReport>
export async function getIPTDetails(iptId: string): Promise<IPTDocument>
```

## Variáveis de Ambiente Necessárias

```bash
# Obrigatórias
MONGO_URI="mongodb://user:pass@host:port/database?authSource=admin"

# Opcionais com defaults
IPT_DEFAULT_FAUNA="https://ipt.jbrj.gov.br/jabot/resource?r=fauna_brasil"
IPT_DEFAULT_FLORA="https://ipt.jbrj.gov.br/jabot/resource?r=flora_brasil"
LOCK_TIMEOUT_SECONDS="3600"
BATCH_SIZE_DEFAULT="5000"
TRANSFORM_BATCH_SIZE="1000"
```

## Códigos de Saída

Todos os scripts seguem convenção padrão de códigos de saída:

```typescript
enum ExitCodes {
  SUCCESS = 0, // Operação bem-sucedida
  GENERAL_ERROR = 1, // Erro geral
  INVALID_ARGS = 2, // Argumentos inválidos
  LOCK_EXISTS = 3, // Recurso já está sendo processado
  IPT_UNAVAILABLE = 4, // IPT não acessível
  MONGO_ERROR = 5, // Erro de conexão MongoDB
  VERSION_CHECK_FAIL = 6, // Falha na verificação de versão
  PARTIAL_SUCCESS = 7 // Sucesso parcial (alguns erros)
}
```

## Logs e Monitoramento

Todos os scripts produzem logs estruturados no formato JSON:

```typescript
interface LogEntry {
  timestamp: string // ISO 8601
  level: 'info' | 'warn' | 'error' | 'debug'
  script: string // Nome do script
  operation: string // Operação sendo executada
  message: string // Mensagem legível
  data?: any // Dados estruturados adicionais
  duration_ms?: number // Duração da operação
  ipt_id?: string // IPT sendo processado
  document_count?: number // Contagem de documentos
}
```

Exemplo de saída de log:

```json
{"timestamp":"2025-09-29T10:30:00Z","level":"info","script":"ingest-fauna","operation":"start","message":"Iniciando ingestão de fauna","data":{"ipt_url":"https://example.com/ipt","force_reprocess":false}}
{"timestamp":"2025-09-29T10:31:30Z","level":"info","script":"ingest-fauna","operation":"complete","message":"Ingestão concluída com sucesso","duration_ms":90000,"document_count":15420}
```
