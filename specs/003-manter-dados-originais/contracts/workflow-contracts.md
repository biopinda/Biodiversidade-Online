# Workflow Contracts: GitHub Actions

## Contratos dos Workflows de Ingestão

### 1. Workflow de Ingestão de Fauna

**Arquivo**: `.github/workflows/ingest-fauna.yml`

```yaml
name: Ingestão de Dados - Fauna
on:
  schedule:
    - cron: '0 2 * * SUN' # Domingo às 2:00 AM
  workflow_dispatch:
    inputs:
      ipt_url:
        description: 'URL do IPT para ingestão (opcional)'
        required: false
        type: string
      force_reprocess:
        description: 'Forçar reprocessamento mesmo sem mudanças'
        required: false
        type: boolean
        default: false
  push:
    paths:
      - '.github/workflows/ingest-fauna.yml'
      - 'packages/ingest/src/scripts/ingest-fauna.ts'
      - 'packages/ingest/src/transformers/fauna/**'

inputs:
  ipt_url:
    description: URL específica do IPT (opcional para cron)
    type: string
    required: false
  force_reprocess:
    description: Forçar reprocessamento
    type: boolean
    default: false

outputs:
  job_status:
    description: Status final do job (success, failure, skipped)
    value: ${{ steps.ingest.outputs.status }}
  documents_processed:
    description: Número de documentos processados
    value: ${{ steps.ingest.outputs.document_count }}
  execution_time:
    description: Tempo de execução em segundos
    value: ${{ steps.ingest.outputs.duration }}
  ipt_version:
    description: Versão do IPT processada
    value: ${{ steps.ingest.outputs.version }}

environment_variables:
  MONGO_URI:
    description: String de conexão MongoDB
    required: true
    secret: true
  IPT_DEFAULT_FAUNA:
    description: URL padrão do IPT de fauna
    required: true
  LOCK_TIMEOUT:
    description: Timeout para locks em segundos
    default: '3600'

runner_requirements:
  type: self-hosted
  labels: [linux, biodiversity-data]
  disk_space: '10GB'
  memory: '4GB'
```

### 2. Workflow de Ingestão de Flora

**Arquivo**: `.github/workflows/ingest-flora.yml`

```yaml
name: Ingestão de Dados - Flora
on:
  schedule:
    - cron: '0 3 * * SUN' # Domingo às 3:00 AM
  workflow_dispatch:
    inputs:
      ipt_url:
        description: 'URL do IPT para ingestão (opcional)'
        required: false
        type: string
      force_reprocess:
        description: 'Forçar reprocessamento mesmo sem mudanças'
        required: false
        type: boolean
        default: false
  push:
    paths:
      - '.github/workflows/ingest-flora.yml'
      - 'packages/ingest/src/scripts/ingest-flora.ts'
      - 'packages/ingest/src/transformers/flora/**'
# [Mesma estrutura de inputs, outputs, environment_variables e runner_requirements da fauna]
```

### 3. Workflow de Ingestão de Ocorrências

**Arquivo**: `.github/workflows/ingest-ocorrencias.yml`

```yaml
name: Ingestão de Dados - Ocorrências
on:
  schedule:
    - cron: '0 4 * * SUN' # Domingo às 4:00 AM
  workflow_dispatch:
    inputs:
      ipt_urls:
        description: 'URLs dos IPTs separadas por vírgula (opcional)'
        required: false
        type: string
      force_reprocess:
        description: 'Forçar reprocessamento mesmo sem mudanças'
        required: false
        type: boolean
        default: false
  push:
    paths:
      - '.github/workflows/ingest-ocorrencias.yml'
      - 'packages/ingest/src/scripts/ingest-ocorrencias.ts'
      - 'packages/ingest/src/transformers/ocorrencias/**'
# [Estrutura similar aos outros workflows]
```

## Contratos dos Workflows de Transformação

### 1. Workflow de Transformação de Fauna

**Arquivo**: `.github/workflows/transform-fauna.yml`

```yaml
name: Transformação Offline - Fauna
on:
  workflow_dispatch:
    inputs:
      ipt_filter:
        description: 'Filtrar por IPT específico (opcional)'
        required: false
        type: string
      date_from:
        description: 'Data início para filtro (YYYY-MM-DD)'
        required: false
        type: string
      date_to:
        description: 'Data fim para filtro (YYYY-MM-DD)'
        required: false
        type: string
      force_reprocess:
        description: 'Reprocessar documentos já transformados'
        required: false
        type: boolean
        default: false
  push:
    paths:
      - '.github/workflows/transform-fauna.yml'
      - 'packages/ingest/src/scripts/transform-fauna.ts'
      - 'packages/ingest/src/transformers/fauna/**'

inputs:
  ipt_filter:
    description: ID do IPT para filtrar (opcional)
    type: string
    required: false
  date_from:
    description: Data de início para processamento
    type: string
    required: false
  date_to:
    description: Data de fim para processamento
    type: string
    required: false
  force_reprocess:
    description: Reprocessar documentos já transformados
    type: boolean
    default: false

outputs:
  transformation_status:
    description: Status da transformação (success, failure, partial)
    value: ${{ steps.transform.outputs.status }}
  documents_transformed:
    description: Documentos transformados com sucesso
    value: ${{ steps.transform.outputs.success_count }}
  documents_failed:
    description: Documentos que falharam na transformação
    value: ${{ steps.transform.outputs.failure_count }}
  fallback_applied:
    description: Documentos que usaram fallback
    value: ${{ steps.transform.outputs.fallback_count }}
  pipeline_version:
    description: Versão do pipeline usada
    value: ${{ steps.transform.outputs.pipeline_version }}
```

### 2. Workflow de Transformação de Flora

**Arquivo**: `.github/workflows/transform-flora.yml`

```yaml
name: Transformação Offline - Flora
# [Mesma estrutura do workflow de transformação de fauna]
```

### 3. Workflow de Transformação de Ocorrências

**Arquivo**: `.github/workflows/transform-ocorrencias.yml`

```yaml
name: Transformação Offline - Ocorrências
# [Mesma estrutura do workflow de transformação de fauna]
```

## Interfaces dos Scripts Bun

### Interface do Script de Ingestão

```typescript
// packages/ingest/src/scripts/ingest-fauna.ts
interface IngestionScriptInterface {
  // Função principal de entrada
  main(options: IngestionOptions): Promise<IngestionResult>

  // Verificação de versão IPT
  checkIptVersion(iptId: string, iptUrl: string): Promise<VersionCheckResult>

  // Processamento de dados
  processIptData(
    iptUrl: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult>
}

interface IngestionOptions {
  ipt_url?: string // URL específica (opcional)
  force_reprocess?: boolean // Forçar reprocessamento
  batch_size?: number // Tamanho do lote
  timeout?: number // Timeout em segundos
}

interface IngestionResult {
  status: 'success' | 'failure' | 'skipped'
  document_count: number
  duration: number // Duração em segundos
  version: string // Versão do IPT processada
  error_message?: string // Mensagem de erro se status = failure
}

interface VersionCheckResult {
  current_version: string
  needs_update: boolean
  last_modified: Date
  estimated_changes?: number
}

interface ProcessingOptions {
  collection_type: 'fauna' | 'flora' | 'ocorrencias'
  batch_size: number
  preserve_order: boolean
}

interface ProcessingResult {
  total_documents: number
  processed_documents: number
  failed_documents: number
  skipped_documents: number
  processing_errors: Array<{
    record_id: string
    error: string
  }>
}
```

### Interface do Script de Transformação

```typescript
// packages/ingest/src/scripts/transform-fauna.ts
interface TransformationScriptInterface {
  // Função principal de entrada
  main(options: TransformationOptions): Promise<TransformationResult>

  // Obter documentos para transformação
  getDocumentsToTransform(filters: DocumentFilters): Promise<OriginalDocument[]>

  // Aplicar pipeline de transformação
  applyTransformationPipeline(
    document: OriginalDocument
  ): Promise<TransformationAttempt>
}

interface TransformationOptions {
  ipt_filter?: string // Filtrar por IPT específico
  date_from?: Date // Filtro de data início
  date_to?: Date // Filtro de data fim
  force_reprocess?: boolean // Reprocessar já transformados
  batch_size?: number // Tamanho do lote
  pipeline_version?: string // Versão específica do pipeline
}

interface TransformationResult {
  status: 'success' | 'failure' | 'partial'
  success_count: number
  failure_count: number
  fallback_count: number
  pipeline_version: string
  processing_errors: Array<{
    document_id: string
    error: string
  }>
}

interface DocumentFilters {
  ipt_filter?: string
  date_range?: {
    from: Date
    to: Date
  }
  processing_status?: boolean
}

interface TransformationAttempt {
  success: boolean
  transformed_document?: TransformedDocument
  error?: string
  fallback_applied: boolean
}
```

## Contratos de Comunicação Entre Workflows

### Eventos de Notificação

```yaml
# Evento enviado após ingestão bem-sucedida
workflow_notification:
  type: 'ingestion_completed'
  payload:
    collection_type: 'fauna' | 'flora' | 'ocorrencias'
    ipt_id: string
    document_count: number
    version: string
    timestamp: ISO8601

# Evento enviado após transformação
workflow_notification:
  type: 'transformation_completed'
  payload:
    collection_type: 'fauna' | 'flora' | 'ocorrencias'
    success_count: number
    failure_count: number
    pipeline_version: string
    timestamp: ISO8601
```

### Dependências Entre Workflows

```yaml
# Transformação pode ser automaticamente triggada após ingestão
workflow_dependencies:
  ingest-fauna:
    triggers_on_success:
      - transform-fauna
    conditions:
      - minimum_new_documents: 100
      - max_failure_rate: 0.05

  transform-fauna:
    depends_on:
      - successful_ingestion: true
      - lock_availability: true
    max_concurrent_executions: 1
```

## Validações e Testes de Contrato

### Testes de Script

```typescript
// Teste de contrato para script de ingestão
describe('ingest-fauna.ts', () => {
  it('deve retornar IngestionResult válido', async () => {
    const result = await main({
      ipt_url: 'https://example.com/ipt',
      force_reprocess: false
    })

    expect(result.status).toBeOneOf(['success', 'failure', 'skipped'])
    expect(result.document_count).toBeGreaterThanOrEqual(0)
    expect(result.duration).toBeGreaterThan(0)
  })

  it('deve pular processamento se versão não mudou', async () => {
    const result = await main({ force_reprocess: false })
    expect(result.status).toBe('skipped')
    expect(result.skipped_reason).toBeDefined()
  })
})
```

### Testes de Workflow

```yaml
# .github/workflows/test-contracts.yml
name: Teste de Contratos de Workflow
on:
  pull_request:
    paths:
      - '.github/workflows/**'
      - 'packages/ingest/src/**'

jobs:
  test-ingestion-contract:
    runs-on: ubuntu-latest
    steps:
      - name: Testar interface de ingestão
        run: bun test packages/ingest/tests/scripts/ingest-fauna.test.ts

      - name: Validar outputs do workflow
        run: |
          # Simular execução e validar outputs esperados
          bun run packages/ingest/src/scripts/ingest-fauna.ts --dry-run
```
