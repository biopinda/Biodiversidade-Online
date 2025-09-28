import { Card } from '@/components/ui/card'
import type { FilterField } from '@/types'
import { type MapFilterProps } from '@/types/occurrence'
import { useCallback, useMemo } from 'react'
import FilterPopover from './FilterPopover'

type FilterCriterion = {
  field: FilterField
  value: string
}

const numberFormatter = new Intl.NumberFormat()

const fieldToParam: Record<FilterField, string> = {
  reino: 'kingdom',
  filo: 'phylum',
  classe: 'class',
  ordem: 'order',
  superfamília: 'superfamily',
  família: 'family',
  gênero: 'genus',
  'epíteto específico': 'specificEpithet'
}

const paramToField = Object.entries(fieldToParam).reduce(
  (acc, [field, param]) => {
    acc[param] = field as FilterField
    return acc
  },
  {} as Record<string, FilterField>
)

export default function MapFilter({
  filters,
  onFilterChange,
  totalCount,
  isLoading
}: MapFilterProps) {
  const activeFilters = useMemo<FilterCriterion[]>(() => {
    const criteria: FilterCriterion[] = []

    Object.entries(filters).forEach(([param, value]) => {
      const field = paramToField[param]
      if (field && value) {
        criteria.push({ field, value })
      }
    })

    return criteria
  }, [filters])

  const handleFilterChange = useCallback(
    (filters: FilterCriterion[]) => {
      const params: Record<string, string> = {}

      filters.forEach((filter) => {
        if (filter.value) {
          params[fieldToParam[filter.field]] = filter.value
        }
      })

      onFilterChange(params)
    },
    [onFilterChange]
  )

  return (
    <Card className="flex items-center gap-2 rounded-none p-2">
      <FilterPopover
        value={activeFilters}
        onFilterChange={handleFilterChange}
        disabled={!!isLoading}
      />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {isLoading && (
          <div className="flex items-center text-sm text-gray-500">
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500"></div>
            Carregando...
          </div>
        )}

        <div className="font-semibold">
          Total: {numberFormatter.format(totalCount)}
        </div>
      </div>
    </Card>
  )
}
