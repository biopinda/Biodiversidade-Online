import {
  parseRecord,
  serializeRecord,
  useSearchParamsState
} from '@/lib/url/useSearchParamsState'
import {
  type MapOccurrencePageState,
  convertToChartData,
  filterFieldMapping,
  validateErrorResponse,
  validateOccurrenceResponse
} from '@/types/occurrence'
import { useCallback, useEffect, useState } from 'react'
import Map from './Map.tsx'
import MapFilter from './MapFilter.tsx'

const allowedFilterKeys = Object.values(filterFieldMapping)

export default function MapOccurrencePage() {
  const [state, setState] = useState<MapOccurrencePageState>({
    occurrenceData: { total: 0, regions: [] },
    error: null,
    isLoading: true,
    currentFilters: {}
  })

  const parseFilters = useCallback(
    (params: URLSearchParams) => parseRecord(params, allowedFilterKeys),
    []
  )

  const [filters, setFilters] = useSearchParamsState<Record<string, string>>({
    defaultState: {},
    parse: parseFilters,
    serialize: serializeRecord
  })

  const fetchRegions = useCallback(async (filter: Record<string, string>) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      currentFilters: filter
    }))

    try {
      const params = new URLSearchParams(filter)
      console.log('🔄 Fetching occurrence data with filters:', filter)

      const response = await fetch(
        `/api/occurrenceCountByState?${params.toString()}`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (validateErrorResponse(errorData)) {
          throw new Error(errorData.error)
        }

        // Fallback error messages based on status code
        if (response.status === 504) {
          throw new Error(
            'Consulta demorou muito para responder. Tente filtros mais específicos.'
          )
        } else if (response.status === 500) {
          throw new Error(
            'Erro interno do servidor. Tente novamente em alguns instantes.'
          )
        } else {
          throw new Error(`Erro ${response.status}: Falha ao carregar dados`)
        }
      }

      const data = await response.json()

      // Validate response structure
      if (!validateOccurrenceResponse(data)) {
        throw new Error('Dados recebidos estão em formato inválido')
      }

      console.log(
        `✅ Occurrence data loaded: ${data.total} total, ${data.regions.length} regions`
      )

      setState((prev) => ({
        ...prev,
        occurrenceData: data,
        isLoading: false,
        error: null
      }))
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Falha ao carregar dados de ocorrências dos estados'

      console.error('❌ Error fetching occurrence data:', errorMessage)

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
    }
  }, [])

  const handleFilterChange = useCallback(
    (filters: Record<string, string>) => {
      setFilters(filters)
    },
    [setFilters]
  )

  useEffect(() => {
    fetchRegions(filters)
  }, [fetchRegions, filters])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <MapFilter
        filters={filters}
        onFilterChange={handleFilterChange}
        totalCount={state.occurrenceData.total}
        isLoading={state.isLoading}
      />

      {state.error ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="mb-2 text-lg font-semibold text-red-500">
              ⚠️ Erro ao carregar dados
            </div>
            <div className="mb-4 text-gray-600">{state.error}</div>
            <button
              onClick={() => fetchRegions(state.currentFilters)}
              className="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
              disabled={state.isLoading}
            >
              {state.isLoading ? 'Carregando...' : 'Tentar novamente'}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex-1">
          {state.isLoading && (
            <div className="bg-opacity-75 absolute inset-0 z-10 flex items-center justify-center bg-white">
              <div className="flex flex-col items-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
                <div className="text-gray-600">
                  Carregando dados de ocorrências...
                </div>
              </div>
            </div>
          )}

          <Map
            className="h-full w-full"
            full
            isLoading={state.isLoading}
            data={convertToChartData(state.occurrenceData)}
          />
        </div>
      )}
    </div>
  )
}
