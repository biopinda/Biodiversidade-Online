import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import type { FilterField } from '@/types'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import FilterSelect from './FilterSelect'
import SimpleSelect from './SimpleSelect'

type FilterCriterion = {
  field: FilterField
  value: string
}

interface Props {
  value: FilterCriterion[]
  onFilterChange: (filters: FilterCriterion[]) => void
  disabled?: boolean
}

const KINGDOM_OPTIONS = [
  { label: 'Plantae', value: 'Plantae' },
  { label: 'Fungi', value: 'Fungi' },
  { label: 'Animalia', value: 'Animalia' }
]

export default function FilterPopover({
  value,
  onFilterChange,
  disabled = false
}: Props) {
  const [filters, setFilters] = useState<FilterCriterion[]>(value)
  const [open, setOpen] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setFilters(value)
  }, [value])

  const availableFields: FilterField[] = [
    'reino',
    'filo',
    'classe',
    'ordem',
    'superfamília',
    'família',
    'gênero',
    'epíteto específico'
  ]

  const usedFields = new Set(filters.map((f) => f.field))
  const remainingFields = availableFields.filter(
    (field) => !usedFields.has(field)
  )

  const applyFilters = () => {
    const validFilters = filters.filter((filter) => filter.value !== '')
    onFilterChange(validFilters)
  }

  const addFilter = () => {
    const firstAvailableField = remainingFields[0]
    if (!firstAvailableField) return

    const newFilter: FilterCriterion = {
      field: firstAvailableField,
      value: ''
    }
    setFilters([...filters, newFilter])
  }

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index)
    setFilters(newFilters)
    // Apply filters automatically when removing a filter
    const validFilters = newFilters.filter((filter) => filter.value !== '')
    onFilterChange(validFilters)
  }

  const updateFilter = (index: number, updates: Partial<FilterCriterion>) => {
    const newFilters = [...filters]
    if (newFilters[index]) {
      newFilters[index] = { ...newFilters[index], ...updates }
      setFilters(newFilters)

      // Focus the input when field changes and it's not reino
      if (updates.field && updates.field !== 'reino') {
        setTimeout(() => {
          console.log('focusing', inputRefs.current[index])
          inputRefs.current[index]?.focus()
        }, 10)
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[180px]"
          disabled={disabled}
          title={disabled ? 'Aguarde carregamento' : 'Adicionar/editar filtros'}
        >
          Filtros ({filters.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] space-y-1 p-4">
        {filters.map((filter, index) => {
          const availableFieldsForSelect = [filter.field, ...remainingFields]
          return (
            <div key={index} className="flex items-center">
              <FilterSelect
                className="w-[90px] shrink-0 rounded-e-none border-e-0 shadow-none"
                value={filter.field}
                onChange={(value) => updateFilter(index, { field: value })}
                availableFields={availableFieldsForSelect}
              />
              {filter.field === 'reino' ? (
                <SimpleSelect
                  className="flex-1 rounded-s-none"
                  value={filter.value || null}
                  onChange={(value) =>
                    updateFilter(index, { value: value || '' })
                  }
                  values={KINGDOM_OPTIONS}
                  placeholder="Selecione um reino"
                />
              ) : (
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  type="text"
                  value={filter.value}
                  onChange={(e) =>
                    updateFilter(index, { value: e.target.value })
                  }
                  className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-e-md border bg-transparent px-3 py-1 pr-8 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Digite o valor..."
                  disabled={disabled}
                />
              )}
              <Button
                className="w-6 shrink-0"
                variant="ghost"
                size="icon"
                onClick={() => removeFilter(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
        {remainingFields.length > 0 && (
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={addFilter}
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar filtro
          </Button>
        )}
        <Button
          variant="default"
          className="mt-2 w-full"
          onClick={applyFilters}
          disabled={disabled || filters.length === 0}
        >
          Filtrar
        </Button>
      </PopoverContent>
    </Popover>
  )
}
