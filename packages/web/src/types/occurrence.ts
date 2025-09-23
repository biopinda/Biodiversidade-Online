/**
 * TypeScript interfaces for Occurrence Map functionality
 * Based on contracts from /specs/001-mapa-de-ocorr/contracts/
 */

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Taxonomic filter for occurrence data queries
 */
export interface TaxonomicFilter {
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  superfamily?: string
  family?: string
  genus?: string
  specificEpithet?: string
}

/**
 * Region data with occurrence count
 */
export interface RegionData {
  _id: string // Normalized state name
  count: number // Number of occurrences
}

/**
 * API response for occurrence counts by state
 */
export interface OccurrenceResponse {
  total: number // Total number of occurrence records
  regions: RegionData[] // Counts per state
}

/**
 * Error response from API
 */
export interface ErrorResponse {
  error: string // Error message in Portuguese
}

/**
 * Data formatted for Google Charts visualization
 */
export type ChartData = [string, any][]

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for MapOccurrencePage component
 */
export interface MapOccurrencePageProps {
  // Component manages its own state internally
}

/**
 * Props for MapFilter component
 */
export interface MapFilterProps {
  onFilterChange: (filters: Record<string, string>) => void
  totalCount: number
  isLoading?: boolean
}

/**
 * Props for Map component (Google Charts)
 */
export interface MapProps {
  data?: ChartData
  stateList?: string[]
  full?: boolean
  className?: string
  isLoading?: boolean
}

// ============================================================================
// Component State Management
// ============================================================================

/**
 * Internal state for MapOccurrencePage component
 */
export interface MapOccurrencePageState {
  occurrenceData: OccurrenceResponse
  error: string | null
  isLoading: boolean
  currentFilters: Record<string, string>
}

/**
 * Loading states for UI components
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// ============================================================================
// Event Handlers and Callbacks
// ============================================================================

/**
 * Function type for fetching occurrence data
 */
export type FetchRegionsFunction = (
  filter: Record<string, string>
) => Promise<void>

/**
 * Handler for filter changes
 */
export type FilterChangeHandler = (filters: Record<string, string>) => void

/**
 * Error handling callback
 */
export type ErrorHandler = (error: Error | string) => void

// ============================================================================
// Configuration and Constants
// ============================================================================

/**
 * API configuration options
 */
export interface ApiConfig {
  endpoint: string
  timeout: number
  retryAttempts: number
}

/**
 * Default API configuration
 */
export const defaultApiConfig: ApiConfig = {
  endpoint: '/api/occurrenceCountByState',
  timeout: 10000, // 10 seconds
  retryAttempts: 3
}

/**
 * Mapping from UI filter fields to API parameters
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
 * UI filter field names (Portuguese)
 */
export type FilterField = keyof typeof filterFieldMapping

/**
 * API parameter names (English)
 */
export type ApiParameter = (typeof filterFieldMapping)[FilterField]

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Type guard to validate RegionData objects
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
 * Type guard to validate OccurrenceResponse objects
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
 * Type guard to validate ErrorResponse objects
 */
export function validateErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).error === 'string'
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert OccurrenceResponse to Google Charts format
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
 * Format numbers with Brazilian locale (thousands separator)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num)
}

/**
 * Convert UI filter fields to API parameters
 */
export function convertFiltersToApiParams(
  uiFilters: Record<FilterField, string>
): Record<ApiParameter, string> {
  const apiParams: Record<string, string> = {}

  Object.entries(uiFilters).forEach(([uiField, value]) => {
    if (value && value.trim()) {
      const apiParam = filterFieldMapping[uiField as FilterField]
      if (apiParam) {
        apiParams[apiParam] = value.trim()
      }
    }
  })

  return apiParams as Record<ApiParameter, string>
}

/**
 * Debounce function for filter inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func(...args)
      timeout = null
    }, wait)
  }
}

// ============================================================================
// Testing Support
// ============================================================================

/**
 * Mock data structure for testing
 */
export interface MockOccurrenceData {
  response: OccurrenceResponse
  filters: Record<string, string>
  chartData: ChartData
}

/**
 * Factory function to create mock occurrence data for testing
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

// ============================================================================
// Brazilian States Reference
// ============================================================================

/**
 * Complete list of Brazilian states (normalized names)
 */
export const BRAZILIAN_STATES = [
  'Acre',
  'Alagoas',
  'Amapá',
  'Amazonas',
  'Bahia',
  'Ceará',
  'Distrito Federal',
  'Espírito Santo',
  'Goiás',
  'Maranhão',
  'Mato Grosso',
  'Mato Grosso do Sul',
  'Minas Gerais',
  'Pará',
  'Paraíba',
  'Paraná',
  'Pernambuco',
  'Piauí',
  'Rio de Janeiro',
  'Rio Grande do Norte',
  'Rio Grande do Sul',
  'Rondônia',
  'Roraima',
  'Santa Catarina',
  'São Paulo',
  'Sergipe',
  'Tocantins'
] as const

/**
 * Brazilian state name type
 */
export type BrazilianStateName = (typeof BRAZILIAN_STATES)[number]

/**
 * Validate if a string is a valid Brazilian state name
 */
export function isValidBrazilianState(
  state: string
): state is BrazilianStateName {
  return BRAZILIAN_STATES.includes(state as BrazilianStateName)
}
