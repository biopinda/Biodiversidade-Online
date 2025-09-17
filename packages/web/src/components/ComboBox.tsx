import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

type Props<T extends string> = {
  value: T | ''
  onChange: (value: T | '') => void
  values: T[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  renderValue?: (value: T) => string
}

export default function ComboBox<T extends string>({
  value,
  onChange,
  values,
  placeholder = 'Selecione uma opção',
  searchPlaceholder = 'Procurar...',
  className,
  disabled = false,
  renderValue = (value) => value
}: Props<T>) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-[180px] justify-between', className)}
          disabled={disabled || values.length === 0}
        >
          {value ? renderValue(value as T) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <ScrollArea className="h-[200px]">
              <CommandGroup>
                <CommandItem
                  value=""
                  onSelect={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  className="cursor-pointer font-bold"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === '' ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  All
                </CommandItem>
                {values.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={(currentValue) => {
                      onChange(
                        currentValue === value ? '' : (currentValue as T)
                      )
                      setOpen(false)
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === item ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {renderValue(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
