import Map from '@/components/Map.tsx'
import MapFilter from '@/components/MapFilter.tsx'
import { useCallback, useEffect, useState } from 'react'

interface RegionData {
  _id: string
  count: number
}

interface TaxaResponse {
  total: number
  regions: RegionData[]
}

export default function MapPage() {
  const [taxaData, setTaxaData] = useState<TaxaResponse>({
    total: 0,
    regions: []
  })
  const [error, setError] = useState<string | null>(null)
  const [currentFilters, setCurrentFilters] = useState<Record<string, string>>(
    {}
  )

  const fetchRegions = useCallback(async (filter: Record<string, string>) => {
    try {
      setCurrentFilters(filter)
      // If no filters, try cache-first JSON for fast initial load
      if (!filter || Object.keys(filter).length === 0) {
        try {
          const cacheResp = await fetch('/cache/map-initial-load.json')
          if (cacheResp.ok) {
            const cacheData = await cacheResp.json()
            setTaxaData({
              total: cacheData.total || 0,
              regions: cacheData.regions || []
            })
            return
          }
        } catch (err) {
          // fallthrough to API if cache read fails
          console.warn('Cache inicial não disponível, consultando API...', err)
        }
      }

      const params = new URLSearchParams(filter)

      const response = await fetch(
        `/api/occurrenceCountByState?${params.toString()}`
      )
      if (!response.ok) {
        throw new Error('Falha ao carregar dados dos estados')
      }
      const data = await response.json()
      setTaxaData(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar dados dos estados'
      )
    }
  }, [])

  const handleFilterChange = useCallback(
    (filters: Record<string, string>) => {
      fetchRegions(filters)
    },
    [fetchRegions]
  )

  // Initial load
  useEffect(() => {
    fetchRegions({})
  }, [fetchRegions])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <MapFilter
        filters={currentFilters}
        onFilterChange={handleFilterChange}
        totalCount={taxaData.total}
      />
      {error ? (
        <div className="flex flex-1 items-center justify-center text-red-500">
          {error}
        </div>
      ) : (
        <Map
          className="flex-1"
          full
          data={[
            ['Estado', 'Taxa'],
            ...taxaData.regions.map(
              ({ _id, count }) => [_id, count] as [string, number]
            )
          ]}
        />
      )}
    </div>
  )
}
