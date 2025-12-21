/**
 * Statistics Cards Component
 * Displays key metrics: total species, threatened count, invasive count
 */

import { useEffect, useState } from 'react'

interface DashboardStats {
  totalSpecies: number
  threatenedCount: number
  invasiveCount: number
  totalOccurrences: number
  lastUpdated: string
}

export default function StatCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        const response = await fetch('/api/dashboard/summary')
        if (!response.ok) {
          throw new Error('Falha ao carregar estatísticas')
        }
        const data = await response.json()
        setStats(data)
        setError(null)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar dados'
        )
        console.error('Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh every 10 minutes
    const interval = setInterval(fetchStats, 600000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p>Erro ao carregar estatísticas: {error}</p>
      </div>
    )
  }

  const cards = [
    {
      title: 'Total de Espécies',
      value: stats?.totalSpecies || 0,
      icon: '🌿',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700'
    },
    {
      title: 'Espécies Ameaçadas',
      value: stats?.threatenedCount || 0,
      icon: '⚠️',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700'
    },
    {
      title: 'Espécies Invasoras',
      value: stats?.invasiveCount || 0,
      icon: '🚨',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700'
    },
    {
      title: 'Total de Ocorrências',
      value: stats?.totalOccurrences || 0,
      icon: '📍',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-lg border-2 ${card.borderColor} ${card.bgColor} p-6 transition-all hover:shadow-md`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {card.title}
              </p>
              <p className={`mt-2 text-3xl font-bold ${card.textColor}`}>
                {loading ? (
                  <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-300" />
                ) : (
                  card.value.toLocaleString('pt-BR')
                )}
              </p>
            </div>
            <span className="text-4xl">{card.icon}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
