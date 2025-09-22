/**
 * Contratos de Interface para Componentes do Mapa de Ocorrências
 *
 * Define as interfaces TypeScript para componentes React do mapa,
 * garantindo tipagem consistente entre MapOccurrencePage, MapFilter e Map.
 */

// ============================================================================
// Tipos de Dados Base
// ============================================================================

/**
 * Filtro taxonômico aplicável aos dados de ocorrência
 */
export interface TaxonomicFilter {
  kingdom?: string // Reino taxonômico
  phylum?: string // Filo taxonômico
  class?: string // Classe taxonômica
  order?: string // Ordem taxonômica
  superfamily?: string // Superfamília taxonômica
  family?: string // Família taxonômica
  genus?: string // Gênero taxonômico
  specificEpithet?: string // Epíteto específico
}

/**
 * Dados de contagem por região (estado)
 */
export interface RegionData {
  _id: string // Nome normalizado do estado
  count: number // Contagem de ocorrências
}

/**
 * Resposta da API de contagem de ocorrências
 */
export interface OccurrenceResponse {
  total: number // Total geral de registros
  regions: RegionData[] // Contagens por estado
}

/**
 * Dados formatados para Google Charts
 */
export type ChartData = [string, any][]

// ============================================================================
// Props de Componentes
// ============================================================================

/**
 * Props para o componente MapOccurrencePage
 */
export interface MapOccurrencePageProps {
  // Componente não recebe props externas (gerencia estado interno)
}

/**
 * Props para o componente MapFilter
 */
export interface MapFilterProps {
  onFilterChange: (filters: Record<string, string>) => void
  totalCount: number
  isLoading?: boolean // Estado de carregamento (opcional)
}

/**
 * Props para o componente Map (Google Charts)
 */
export interface MapProps {
  data?: ChartData // Dados para visualização
  stateList?: string[] // Lista de estados (alternativa)
  full?: boolean // Modo tela cheia
  className?: string // Classes CSS adicionais
  isLoading?: boolean // Estado de carregamento
}

// ============================================================================
// Estados de Componente
// ============================================================================

/**
 * Estado interno do MapOccurrencePage
 */
export interface MapOccurrencePageState {
  occurrenceData: OccurrenceResponse
  error: string | null
  isLoading: boolean
  currentFilters: Record<string, string>
}

/**
 * Estado de carregamento possíveis
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// ============================================================================
// Callbacks e Handlers
// ============================================================================

/**
 * Tipo para função de busca de dados
 */
export type FetchRegionsFunction = (
  filter: Record<string, string>
) => Promise<void>

/**
 * Tipo para handler de mudança de filtros
 */
export type FilterChangeHandler = (filters: Record<string, string>) => void

/**
 * Tipo para handler de erro
 */
export type ErrorHandler = (error: Error | string) => void

// ============================================================================
// Configurações e Constantes
// ============================================================================

/**
 * Configuração da API
 */
export interface ApiConfig {
  endpoint: string // URL do endpoint
  timeout: number // Timeout em milliseconds
  retryAttempts: number // Número de tentativas
}

/**
 * Configuração padrão da API
 */
export const defaultApiConfig: ApiConfig = {
  endpoint: '/api/occurrenceCountByState',
  timeout: 10000, // 10 segundos
  retryAttempts: 3
}

/**
 * Mapeamento de campos de filtro UI para parâmetros de API
 */
export const filterFieldMapping = {
  reino: 'kingdom',
  filo: 'phylum',
  classe: 'class',
  ordem: 'order',
  superfamília: 'superfamily',
  família: 'family',
  gênero: 'genus',
  'epíteto específico': 'specificEpithet'
} as const

/**
 * Tipo derivado para campos de filtro UI
 */
export type FilterField = keyof typeof filterFieldMapping

/**
 * Tipo derivado para parâmetros de API
 */
export type ApiParameter = (typeof filterFieldMapping)[FilterField]

// ============================================================================
// Validação e Utilitários
// ============================================================================

/**
 * Função de validação de dados de região
 */
export function validateRegionData(data: unknown): data is RegionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any)._id === 'string' &&
    typeof (data as any).count === 'number' &&
    (data as any).count >= 0
  )
}

/**
 * Função de validação de resposta de ocorrências
 */
export function validateOccurrenceResponse(
  data: unknown
): data is OccurrenceResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).total === 'number' &&
    (data as any).total >= 0 &&
    Array.isArray((data as any).regions) &&
    (data as any).regions.every(validateRegionData)
  )
}

/**
 * Função para converter resposta da API para dados do Chart
 */
export function convertToChartData(response: OccurrenceResponse): ChartData {
  return [
    ['Estado', 'Ocorrências'],
    ...response.regions.map(
      ({ _id, count }) => [_id, count] as [string, number]
    )
  ]
}

/**
 * Função para formatar número com separadores de milhares
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num)
}

// ============================================================================
// Tipos para Testes
// ============================================================================

/**
 * Mock data para testes
 */
export interface MockOccurrenceData {
  response: OccurrenceResponse
  filters: Record<string, string>
  chartData: ChartData
}

/**
 * Função factory para criar dados de teste
 */
export function createMockOccurrenceData(
  states: Array<{ name: string; count: number }>
): MockOccurrenceData {
  const total = states.reduce((sum, state) => sum + state.count, 0)
  const regions = states.map((state) => ({
    _id: state.name,
    count: state.count
  }))

  const response: OccurrenceResponse = { total, regions }
  const chartData = convertToChartData(response)

  return {
    response,
    filters: {},
    chartData
  }
}
