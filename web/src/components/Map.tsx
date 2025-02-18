import { twMerge } from 'tailwind-merge'
import { useEffect, useRef } from 'react'

interface Props {
  full?: boolean
  data?: [string, any][]
  stateList?: string[]
  className?: string
}

const Map = ({ full, stateList, className = '', data: propData }: Props) => {
  const chartRef = useRef<HTMLDivElement>(null)

  const data =
    propData ??
    (stateList && [
      ['Estado', 'Ocorrência'],
      ...stateList.map((state) => [state, state])
    ])

  useEffect(() => {
    // Load Google Charts script
    const script = document.createElement('script')
    script.src = 'https://cdn.skypack.dev/@google-web-components/google-chart'
    script.type = 'module'
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (chartRef.current && data) {
      const chart = document.createElement('google-chart')
      chart.setAttribute('type', 'geo')
      chart.setAttribute('data', JSON.stringify(data))
      chart.setAttribute(
        'options',
        JSON.stringify({
          region: 'BR',
          resolution: 'provinces',
          title: 'Ocorrências'
        })
      )
      chart.className = full ? 'w-full h-full' : 'h-[200px] w-auto'

      // Clear previous content and append new chart
      chartRef.current.innerHTML = ''
      chartRef.current.appendChild(chart)
    }
  }, [data, full, className])

  return (
    <div
      className={twMerge(
        full ? 'w-full h-full' : 'h-[200px] w-auto',
        className
      )}
      ref={chartRef}
    />
  )
}

export default Map
