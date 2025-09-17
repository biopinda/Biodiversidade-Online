import { Card } from '@/components/ui/card'
import { useCallback } from 'react'
import FilterPopover from './FilterPopover'
import type { FilterField } from '@/types'

type FilterCriterion = {
  field: FilterField
  value: string
}

type Props = {
  onFilterChange: (filters: Record<string, string>) => void
  totalCount: number
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

export default function MapFilter({ onFilterChange, totalCount }: Props) {
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
    <Card className="p-2 flex gap-2 items-center rounded-none">
      <FilterPopover onFilterChange={handleFilterChange} />
      <div className="flex-1" />
      <div className="font-semibold">
        Total: {numberFormatter.format(totalCount)}
      </div>
    </Card>
  )
}
