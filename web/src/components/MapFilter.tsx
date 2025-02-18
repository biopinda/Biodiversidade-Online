import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Kingdom = 'Plantae' | 'Fungi' | 'Animalia'
type Family = string

type Props = {
  onFilterChange: (kingdom: Kingdom | null, family: Family | null) => void
}

export default function MapFilter({ onFilterChange }: Props) {
  const [kingdom, setKingdom] = useState<Kingdom | null>(null)
  const [families, setFamilies] = useState<string[]>([])
  const [selectedFamily, setSelectedFamily] = useState<Family | ''>('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (kingdom) {
      fetch(`/api/family/${kingdom}`)
        .then((res) => res.json())
        .then((data: { _id: string }[]) => {
          const validFamilies = data
            .filter(
              (family) =>
                typeof family._id === 'string' && family._id.trim() !== ''
            )
            .sort((a, b) => a._id.localeCompare(b._id))
            .map((family) => family._id)
          setFamilies(validFamilies)
          setSelectedFamily('')
        })
    } else {
      setFamilies([])
      setSelectedFamily('')
    }
  }, [kingdom])

  useEffect(() => {
    onFilterChange(kingdom, selectedFamily)
  }, [kingdom, selectedFamily, onFilterChange])

  const filteredFamilies = useMemo(() => {
    return families.filter((family) => !family.includes('[Algae]'))
  }, [families])

  return (
    <Card className="p-2 flex gap-4 items-center rounded-none">
      <Select
        value={kingdom || '<none>'}
        onValueChange={(value) =>
          setKingdom(value === '<none>' ? null : (value as Kingdom))
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecione o reino" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem className="font-bold" value="<none>">
            Todos
          </SelectItem>
          <SelectItem value="Plantae">Plantas</SelectItem>
          <SelectItem value="Fungi">Fungos</SelectItem>
          <SelectItem value="Animalia">Animais</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[180px] justify-between"
            disabled={!kingdom || families.length === 0}
          >
            {selectedFamily || 'Selecione a família'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Procurar família..." className="h-9" />
            <CommandList>
              <ScrollArea className="h-[200px]">
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      setSelectedFamily('')
                      setOpen(false)
                    }}
                    className="cursor-pointer font-bold"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedFamily === '' ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    Todas
                  </CommandItem>
                  {filteredFamilies.map((family) => (
                    <CommandItem
                      key={family}
                      value={family}
                      onSelect={(currentValue) => {
                        setSelectedFamily(
                          currentValue === selectedFamily ? '' : currentValue
                        )
                        setOpen(false)
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedFamily === family
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {family}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Card>
  )
}
