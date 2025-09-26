import { useCallback, useEffect, useState } from 'react'
import Map from './Map.tsx'
import MapFilter from './MapFilter.tsx'
import {
  type MapOccurrencePageState,
  convertToChartData,
  validateOccurrenceResponse,
  validateErrorResponse
} from '@/types/occurrence'

export default function MapOccurrencePage() {
  const [state, setState] = useState<MapOccurrencePageState>({
    occurrenceData: { total: 0, regions: [] },
    error: null,
    isLoading: true,
    currentFilters: {}
  })

  const fetchRegions = async (filter: Record<string, string>) => {
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
  }

  const handleFilterChange = useCallback((filters: Record<string, string>) => {
    fetchRegions(filters)
  }, [])

  // Initial load
  useEffect(() => {
    fetchRegions({})
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <MapFilter
        onFilterChange={handleFilterChange}
        totalCount={state.occurrenceData.total}
        isLoading={state.isLoading}
      />

      {state.error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="text-red-500 text-lg font-semibold mb-2">
              ⚠️ Erro ao carregar dados
            </div>
            <div className="text-gray-600 mb-4">{state.error}</div>
            <button
              onClick={() => fetchRegions(state.currentFilters)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              disabled={state.isLoading}
            >
              {state.isLoading ? 'Carregando...' : 'Tentar novamente'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          {state.isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <div className="text-gray-600">
                  Carregando dados de ocorrências...
                </div>
              </div>
            </div>
          )}

          <Map
            className="w-full h-full"
            full
            isLoading={state.isLoading}
            data={convertToChartData(state.occurrenceData)}
          />
        </div>
      )}
    </div>
  )
}
