import { useState } from 'react'

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
    <th
      className="sticky top-0 px-2 z-10 bg-gray-200 text-left"
      onClick={onClick}
    >
      {title}
      {sorted ? (
        <span className="text-slate-600"> {sorted === 1 ? '▲' : '▼'}</span>
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
      if ((a[byField] ?? '') < (b[byField] ?? '')) return -1 * direction
      if ((a[byField] ?? '') > (b[byField] ?? '')) return 1 * direction
      return 0
    })
    setSortedOccurrences(sorted)
    setSortedBy({ field: byField, direction })
  }

  const occurrence = occurrences.find(
    (occurrence) => occurrence._id === selectedOccurrence
  )
  return (
    <div className="grid gap-2 grid-cols-1 lg:grid-cols-2 border border-slate-200 h-full overflow-y-auto">
      <div className="overflow-auto h-64 lg:h-auto border-b lg:border-r lg:border-b-0 border-slate-200 lg:row-span-2">
        <table className="border-collapse w-full cursor-default">
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
                key={occurrence._id as string}
                className={
                  selectedOccurrence === occurrence._id
                    ? 'bg-blue-600 text-white sticky top-6 bottom-0'
                    : ''
                }
                onClick={() => {
                  setSelectedOccurrence(occurrence._id as string)
                }}
              >
                <td className="px-2">{occurrence.ipt as string}</td>
                <td className="px-2">{occurrence.institutionCode as string}</td>
                <td className="px-2">{occurrence.country as string}</td>
                <td className="px-2">{occurrence.stateProvince as string}</td>
                <td className="px-2">{occurrence.municipality as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 p-2 w-full h-64 lg:h-auto overflow-y-auto break-words">
        {Object.entries(occurrence ?? {}).map(([key, value]) => (
          <div>
            <span className="font-bold">{key}: </span>
            {Array.isArray(value) ? (
              value.map((item: Record<string, string>) => (
                <div className="border-l-4 border-slate-800 ml-2 pl-2">
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
              <span>{value as string}</span>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-2 items-start grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {(occurrence?.multimedia as Record<string, string>[])?.map(
          ({ identifier, rightsHolder, created }) => (
            <div className="relative">
              <a href={`https://${identifier}`} target="_blank">
                <img src={`https://${identifier}`} alt={rightsHolder} />
                <div className="absolute bottom-0 right-0 left-0 bg-gray-200 text-xs px-2">
                  {created}
                </div>
              </a>
            </div>
          )
        )}
      </div>
    </div>
  )
}
