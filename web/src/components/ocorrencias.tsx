import { useState } from 'preact/hooks'

type Props = {
  occurrences: Record<string, unknown>[]
}

function TableHeader({
  title,
  onClick,
  sorted
}: {
  title: string
  onClick: () => void
  sorted?: number | undefined
}) {
  return (
    <th class="sticky top-0 px-2 z-10 bg-gray-200 text-left" onClick={onClick}>
      {title}
      {sorted ? (
        <span class="text-slate-600"> {sorted === 1 ? '▲' : '▼'}</span>
      ) : (
        ''
      )}
    </th>
  )
}
export default function Ocorrencias({ occurrences }: Props) {
  const [selectedOccurrence, setSelectedOccurrence] = useState('')
  const [sortedOccurrences, setSortedOccurrences] = useState(occurrences)
  const [sortedBy, setSortedBy] = useState({ field: '', direction: 1 })

  const resortOccurrences = (byField: string) => {
    const direction = sortedBy.field === byField ? sortedBy.direction * -1 : 1
    const sorted = [...occurrences].sort((a, b) => {
      if ((a[byField] as string) < (b[byField] as string)) return -1 * direction
      if ((a[byField] as string) > (b[byField] as string)) return 1 * direction
      return 0
    })
    setSortedOccurrences(sorted)
    setSortedBy({ field: byField, direction })
  }

  const occurrence = occurrences.find(
    (occurrence) => occurrence._id === selectedOccurrence
  )
  return (
    <div class="grid grid-cols-1 lg:grid-cols-2 border border-slate-200">
      <div class="overflow-auto h-60 border-b lg:border-r lg:border-b-0 border-slate-200">
        <table class="border-collapse w-full cursor-default">
          <thead>
            <tr>
              <TableHeader
                title="ipt"
                onClick={() => {
                  resortOccurrences('ipt')
                }}
                sorted={
                  sortedBy.field === 'ipt' ? sortedBy.direction : undefined
                }
              />
              <TableHeader
                title="inst."
                onClick={() => {
                  resortOccurrences('institutionCode')
                }}
                sorted={
                  sortedBy.field === 'institutionCode'
                    ? sortedBy.direction
                    : undefined
                }
              />
              <TableHeader
                title="país"
                onClick={() => {
                  resortOccurrences('country')
                }}
                sorted={
                  sortedBy.field === 'country' ? sortedBy.direction : undefined
                }
              />
              <TableHeader
                title="estado"
                onClick={() => {
                  resortOccurrences('stateProvince')
                }}
                sorted={
                  sortedBy.field === 'stateProvince'
                    ? sortedBy.direction
                    : undefined
                }
              />
              <TableHeader
                title="município"
                onClick={() => {
                  resortOccurrences('municipality')
                }}
                sorted={
                  sortedBy.field === 'municipality'
                    ? sortedBy.direction
                    : undefined
                }
              />
            </tr>
          </thead>
          <tbody>
            {sortedOccurrences.map((occurrence) => (
              <tr
                key={occurrence._id}
                class={
                  selectedOccurrence === occurrence._id
                    ? 'bg-blue-600 text-white sticky top-6 bottom-0'
                    : ''
                }
                onClick={() => {
                  setSelectedOccurrence(occurrence._id as string)
                }}
              >
                <td class="px-2">{occurrence.ipt as string}</td>
                <td class="px-2">{occurrence.institutionCode as string}</td>
                <td class="px-2">{occurrence.country as string}</td>
                <td class="px-2">{occurrence.stateProvince as string}</td>
                <td class="px-2">{occurrence.municipality as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 p-2 w-full overflow-y-auto h-60 break-words">
        {Object.entries(occurrence ?? {}).map(([key, value]) => (
          <div>
            <span className="font-bold">{key}: </span>
            {Array.isArray(value) ? (
              value.map((item: Record<string, string>) => (
                <div class="border-l-4 border-slate-800 ml-2 pl-2">
                  {Object.entries(item).map(([_key, _value]) => (
                    <div>
                      <span className="font-bold">{_key}: </span>
                      <span>{_value}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : typeof value === 'object' ? (
              <span>{JSON.stringify(value)}</span>
            ) : (
              <span>{value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
