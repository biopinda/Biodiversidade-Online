/**
 * Dashboard Filters Component
 * Interactive filter controls for species type, region, conservation status
 */

import { useCallback, useState } from 'react'

interface FilterState {
  type: string
  region: string
  conservationStatus: string
}

const REGIONS = [
  { code: '11', name: 'Rondônia' },
  { code: '12', name: 'Acre' },
  { code: '13', name: 'Amazonas' },
  { code: '14', name: 'Roraima' },
  { code: '15', name: 'Pará' },
  { code: '16', name: 'Amapá' },
  { code: '17', name: 'Tocantins' },
  { code: '21', name: 'Maranhão' },
  { code: '22', name: 'Piauí' },
  { code: '23', name: 'Ceará' },
  { code: '24', name: 'Rio Grande do Norte' },
  { code: '25', name: 'Paraíba' },
  { code: '26', name: 'Pernambuco' },
  { code: '27', name: 'Alagoas' },
  { code: '28', name: 'Sergipe' },
  { code: '29', name: 'Bahia' },
  { code: '31', name: 'Minas Gerais' },
  { code: '32', name: 'Espírito Santo' },
  { code: '33', name: 'Rio de Janeiro' },
  { code: '35', name: 'São Paulo' },
  { code: '41', name: 'Paraná' },
  { code: '42', name: 'Santa Catarina' },
  { code: '43', name: 'Rio Grande do Sul' },
  { code: '50', name: 'Mato Grosso do Sul' },
  { code: '51', name: 'Mato Grosso' },
  { code: '52', name: 'Goiás' },
  { code: '53', name: 'Distrito Federal' }
]

const CONSERVATION_STATUSES = [
  { value: 'threatened', label: 'Ameaçada' },
  { value: 'near-threatened', label: 'Quase ameaçada' },
  { value: 'least-concern', label: 'Pouca preocupação' }
]

const SPECIES_TYPES = [
  { value: 'native', label: 'Nativa' },
  { value: 'invasive', label: 'Invasora' },
  { value: 'threatened', label: 'Ameaçada' }
]

export default function DashboardFilters() {
  const [filters, setFilters] = useState<FilterState>({
    type: '',
    region: '',
    conservationStatus: ''
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleFilterChange = useCallback(
    (filterName: keyof FilterState, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [filterName]: value
      }))
      setIsLoading(true)

      // Trigger data update (handled by parent component)
      setTimeout(() => setIsLoading(false), 500)
    },
    []
  )

  const handleClearFilters = () => {
    setFilters({
      type: '',
      region: '',
      conservationStatus: ''
    })
  }

  const hasActiveFilters =
    filters.type || filters.region || filters.conservationStatus

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Filtros</h3>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
        {/* Type Filter */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700"
          >
            Tipo de Espécie
          </label>
          <select
            id="type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          >
            <option value="">Todas</option>
            {SPECIES_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Region Filter */}
        <div>
          <label
            htmlFor="region"
            className="block text-sm font-medium text-gray-700"
          >
            Estado/Região
          </label>
          <select
            id="region"
            value={filters.region}
            onChange={(e) => handleFilterChange('region', e.target.value)}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        {/* Conservation Status Filter */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700"
          >
            Status de Conservação
          </label>
          <select
            id="status"
            value={filters.conservationStatus}
            onChange={(e) =>
              handleFilterChange('conservationStatus', e.target.value)
            }
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {CONSERVATION_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        <div className="flex items-end">
          <button
            onClick={handleClearFilters}
            disabled={!hasActiveFilters || isLoading}
            className="w-full rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-gray-700" />
                Carregando...
              </span>
            ) : (
              'Limpar Filtros'
            )}
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.type && (
            <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
              Tipo: {SPECIES_TYPES.find((t) => t.value === filters.type)?.label}
              <button
                onClick={() => handleFilterChange('type', '')}
                className="hover:font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {filters.region && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
              Estado: {REGIONS.find((r) => r.code === filters.region)?.name}
              <button
                onClick={() => handleFilterChange('region', '')}
                className="hover:font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {filters.conservationStatus && (
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
              Status:{' '}
              {
                CONSERVATION_STATUSES.find(
                  (s) => s.value === filters.conservationStatus
                )?.label
              }
              <button
                onClick={() => handleFilterChange('conservationStatus', '')}
                className="hover:font-bold"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
