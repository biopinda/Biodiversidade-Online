import { twMerge } from 'tailwind-merge'
import { useEffect, useRef } from 'react'
import { type MapProps } from '@/types/occurrence'

const Map = ({
  full,
  stateList,
  className = '',
  data: propData,
  isLoading
}: MapProps) => {
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
    if (chartRef.current && data && !isLoading) {
      const chart = document.createElement('google-chart')
      chart.setAttribute('type', 'geo')
      chart.setAttribute('data', JSON.stringify(data))
      chart.setAttribute(
        'options',
        JSON.stringify({
          region: 'BR',
          resolution: 'provinces',
          title: 'Ocorrências por Estado',
          backgroundColor: 'transparent',
          datalessRegionColor: '#f0f0f0',
          colorAxis: {
            colors: ['#e8f4f8', '#0072ce']
          },
          tooltip: {
            textStyle: {
              fontSize: 12
            }
          }
        })
      )
      chart.className = full ? 'w-full h-full' : 'h-[200px] w-auto'

      // Clear previous content and append new chart
      chartRef.current.innerHTML = ''
      chartRef.current.appendChild(chart)
    }
  }, [data, full, className, isLoading])

  return (
    <div
      className={twMerge(
        full ? 'w-full h-full' : 'h-[200px] w-auto',
        'relative',
        className
      )}
      ref={chartRef}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-gray-500">Preparando visualização...</div>
        </div>
      )}
    </div>
  )
}

export default Map
