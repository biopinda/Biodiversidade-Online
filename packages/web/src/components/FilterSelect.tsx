import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { FilterField } from '@/types'

type Props = {
  value: FilterField
  availableFields: FilterField[]
  onChange: (value: FilterField) => void
  className?: string
}

export default function FilterSelect({
  value,
  availableFields,
  onChange,
  className
}: Props) {
  return (
    <Select
      value={value}
      onValueChange={(value) => onChange(value as FilterField)}
    >
      <SelectTrigger className={`text-nowrap ${className}`}>
        <SelectValue placeholder="Campo" />
      </SelectTrigger>
      <SelectContent>
        {availableFields.map((field) => (
          <SelectItem key={field} value={field}>
            {field.slice(0, 1).toUpperCase() + field.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
