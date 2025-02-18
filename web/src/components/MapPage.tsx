import { useCallback, useEffect, useState } from 'react'
import Map from '@/components/Map.tsx'
import MapFilter from '@/components/MapFilter.tsx'

interface RegionData {
  _id: string
  count: number
}

type Kingdom = 'Plantae' | 'Fungi' | 'Animalia'

export default function MapPage() {
  const [taxaRegions, setTaxaRegions] = useState<RegionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRegions = async (
    kingdom: Kingdom | null,
    family: string | null
  ) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        ...(kingdom && { kingdom }),
        ...(family && { family })
      })

      const response = await fetch(`/api/taxaCountByState?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Falha ao carregar dados dos estados')
      }
      const data = await response.json()
      setTaxaRegions(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar dados dos estados'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = useCallback(
    (kingdom: Kingdom | null, family: string | null) => {
      console.log('filterChange', kingdom, family)
      fetchRegions(kingdom, family)
    },
    []
  )

  // Initial load
  useEffect(() => {
    fetchRegions(null, null)
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <MapFilter onFilterChange={handleFilterChange} />
      {error ? (
        <div className="flex-1 flex items-center justify-center text-red-500">
          {error}
        </div>
      ) : (
        <Map
          className="flex-1"
          full
          data={[
            ['Estado', 'Taxa'],
            ...taxaRegions.map(
              ({ _id, count }) => [_id, count] as [string, number]
            )
          ]}
        />
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          Carregando...
        </div>
      )}
    </div>
  )
}
