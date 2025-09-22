import { useCallback, useEffect, useState } from 'react'
import Map from './Map.tsx'
import MapFilter from './MapFilter.tsx'

interface RegionData {
  _id: string
  count: number
}

interface OccurrenceResponse {
  total: number
  regions: RegionData[]
}

export default function MapOccurrencePage() {
  const [occurrenceData, setOccurrenceData] = useState<OccurrenceResponse>({
    total: 0,
    regions: []
  })
  const [error, setError] = useState<string | null>(null)

  const fetchRegions = async (filter: Record<string, string>) => {
    try {
      const params = new URLSearchParams(filter)

      const response = await fetch(`/api/occurrenceCountByState?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Falha ao carregar dados de ocorrências dos estados')
      }
      const data = await response.json()
      setOccurrenceData(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar dados de ocorrências dos estados'
      )
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
        totalCount={occurrenceData.total}
      />
      {error ? (
        <div className="flex-1 flex items-center justify-center text-red-500">
          {error}
        </div>
      ) : (
        <Map
          className="flex-1"
          full
          data={[
            ['Estado', 'Ocorrências'],
            ...occurrenceData.regions.map(
              ({ _id, count }) => [_id, count] as [string, number]
            )
          ]}
        />
      )}
    </div>
  )
}