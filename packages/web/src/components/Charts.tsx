/**
 * Charts Component
 * Displays visualization for species distribution and status
 */

import { useEffect, useState } from 'react'

export default function Charts() {
  const [chartData] = useState([
    {
      label: 'Nativas',
      value: 45000,
      color: '#10b981',
      percentage: 75
    },
    {
      label: 'Ameaçadas',
      value: 10000,
      color: '#f59e0b',
      percentage: 17
    },
    {
      label: 'Invasoras',
      value: 4000,
      color: '#ef4444',
      percentage: 8
    }
  ])

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Bar Chart - Species by Type */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">
          Distribuição por Tipo
        </h3>
        <div className="space-y-4">
          {chartData.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {item.label}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {item.value.toLocaleString('pt-BR')} ({item.percentage}%)
                </span>
              </div>
              <div className="h-8 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: mounted ? `${item.percentage}%` : '0%',
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pie Chart - Conservation Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">
          Status de Conservação
        </h3>
        <div className="flex items-center justify-center">
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            className="transform transition-all duration-500"
          >
            {/* Pie slices */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="#10b981"
              opacity={mounted ? 1 : 0.5}
              style={{
                transitionProperty: 'opacity',
                transitionDuration: '500ms'
              }}
            />
            <path
              d="M 100 100 L 100 20 A 80 80 0 0 1 165.64 48.16 Z"
              fill="#f59e0b"
              opacity={mounted ? 1 : 0.5}
              style={{
                transitionProperty: 'opacity',
                transitionDuration: '500ms'
              }}
            />
            <path
              d="M 100 100 L 165.64 48.16 A 80 80 0 0 1 141.42 160 Z"
              fill="#ef4444"
              opacity={mounted ? 1 : 0.5}
              style={{
                transitionProperty: 'opacity',
                transitionDuration: '500ms'
              }}
            />

            {/* Labels */}
            <text
              x="100"
              y="120"
              textAnchor="middle"
              className="fill-white text-sm font-bold"
            >
              75%
            </text>
            <text
              x="140"
              y="80"
              textAnchor="middle"
              className="fill-white text-xs font-bold"
            >
              17%
            </text>
            <text
              x="115"
              y="160"
              textAnchor="middle"
              className="fill-white text-xs font-bold"
            >
              8%
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}
