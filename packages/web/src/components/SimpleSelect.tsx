import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type Props<T extends string> = {
  values: {
    label: string
    value: T
  }[]
  onChange: (value: T | null) => void
  value: T | null
  nullOptionLabel?: string
  placeholder?: string
  className?: string
}

export default function SimpleSelect<T extends string>({
  values,
  onChange,
  value,
  nullOptionLabel,
  placeholder = 'Selecione uma opção',
  className
}: Props<T>) {
  return (
    <Select
      value={value ?? '<clear>'}
      onValueChange={(value: T) => onChange(value === '<clear>' ? null : value)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {nullOptionLabel && (
          <SelectItem key={''} value="<clear>">
            {nullOptionLabel}
          </SelectItem>
        )}
        {values.map(({ label, value }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
