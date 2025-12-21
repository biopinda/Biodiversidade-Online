/**
 * MCP Adapter
 * Maps Claude natural language to MongoDB queries via Model Context Protocol
 */

import { getMongoDatabase } from './mongo'
import { logger } from './logger'

export interface MCPQuery {
  type: 'taxa' | 'occurrences' | 'statistics' | 'spatial'
  params: Record<string, unknown>
}

export interface MCPResult {
  success: boolean
  data: unknown[]
  count: number
  source: string
}

/**
 * Parse natural language and convert to MCP queries
 */
export async function parseAndExecuteQuery(
  userMessage: string
): Promise<MCPResult> {
  try {
    logger.debug('Parsing natural language query', {
      messageLength: userMessage.length
    })

    // Simple pattern matching for common queries
    const lowerMessage = userMessage.toLowerCase()

    // Check for species queries
    if (
      lowerMessage.includes('espécie') ||
      lowerMessage.includes('species') ||
      lowerMessage.includes('quantas')
    ) {
      return await executeTaxaQuery(userMessage)
    }

    // Check for occurrence/location queries
    if (
      lowerMessage.includes('onde') ||
      lowerMessage.includes('location') ||
      lowerMessage.includes('onde') ||
      lowerMessage.includes('ocorrênc')
    ) {
      return await executeOccurrenceQuery(userMessage)
    }

    // Check for statistics
    if (
      lowerMessage.includes('total') ||
      lowerMessage.includes('count') ||
      lowerMessage.includes('quantos')
    ) {
      return await executeStatisticsQuery()
    }

    // Default: return sample data
    return {
      success: false,
      data: [],
      count: 0,
      source: 'mcp-adapter'
    }
  } catch (error) {
    logger.error(
      'Error parsing query',
      error instanceof Error ? error : new Error(String(error))
    )
    return {
      success: false,
      data: [],
      count: 0,
      source: 'mcp-adapter-error'
    }
  }
}

/**
 * Execute taxa query
 */
async function executeTaxaQuery(userMessage: string): Promise<MCPResult> {
  try {
    const db = await getMongoDatabase()
    const collection = db.collection('taxa')

    // Simple implementation - in production would parse more complex queries
    const results = await collection
      .find({})
      .limit(50)
      .toArray()

    logger.info('Taxa query executed', {
      count: results.length,
      query: userMessage.substring(0, 100)
    })

    return {
      success: true,
      data: results,
      count: results.length,
      source: 'mongodb-taxa'
    }
  } catch (error) {
    logger.error('Taxa query failed', error instanceof Error ? error : undefined)
    return {
      success: false,
      data: [],
      count: 0,
      source: 'taxa-error'
    }
  }
}

/**
 * Execute occurrence query with spatial support
 */
async function executeOccurrenceQuery(
  userMessage: string
): Promise<MCPResult> {
  try {
    const db = await getMongoDatabase()
    const collection = db.collection('occurrences')

    // Extract region if mentioned
    const regionMatch = userMessage.match(
      /(?:em|in|na|no)\s+([A-Za-záãíõûôèéêlaw\s]+)/i
    )
    const region = regionMatch ? regionMatch[1].trim() : null

    const filter = region
      ? { stateProvince: new RegExp(region, 'i') }
      : {}

    const results = await collection
      .find(filter)
      .limit(100)
      .toArray()

    logger.info('Occurrence query executed', {
      count: results.length,
      region: region || 'all'
    })

    return {
      success: true,
      data: results,
      count: results.length,
      source: 'mongodb-occurrences'
    }
  } catch (error) {
    logger.error(
      'Occurrence query failed',
      error instanceof Error ? error : undefined
    )
    return {
      success: false,
      data: [],
      count: 0,
      source: 'occurrences-error'
    }
  }
}

/**
 * Execute statistics query
 */
async function executeStatisticsQuery(): Promise<MCPResult> {
  try {
    const db = await getMongoDatabase()
    const taxaCollection = db.collection('taxa')
    const occurrencesCollection = db.collection('occurrences')

    const [totalSpecies, threatenedCount, totalOccurrences] = await Promise.all(
      [
        taxaCollection.countDocuments(),
        taxaCollection.countDocuments({ threatStatus: 'threatened' }),
        occurrencesCollection.countDocuments()
      ]
    )

    const stats = {
      totalSpecies,
      threatenedCount,
      totalOccurrences
    }

    logger.info('Statistics query executed', stats)

    return {
      success: true,
      data: [stats],
      count: 1,
      source: 'mongodb-stats'
    }
  } catch (error) {
    logger.error(
      'Statistics query failed',
      error instanceof Error ? error : undefined
    )
    return {
      success: false,
      data: [],
      count: 0,
      source: 'stats-error'
    }
  }
}

/**
 * Format query results for Claude context
 */
export function formatResultsForClaude(result: MCPResult): string {
  if (!result.success || result.count === 0) {
    return 'No data found for your query.'
  }

  // Summarize results based on source
  switch (result.source) {
    case 'mongodb-taxa':
      return formatTaxaResults(result.data as any[])
    case 'mongodb-occurrences':
      return formatOccurrenceResults(result.data as any[])
    case 'mongodb-stats':
      return formatStatsResults(result.data as any[])
    default:
      return `Found ${result.count} results from ${result.source}`
  }
}

function formatTaxaResults(taxa: any[]): string {
  if (taxa.length === 0) return 'No species found.'

  const summary = taxa
    .slice(0, 10)
    .map((t) => `• ${t.scientificName}${t.commonName ? ` (${t.commonName})` : ''}`)
    .join('\n')

  return `Found ${taxa.length} species:\n${summary}${
    taxa.length > 10 ? `\n... and ${taxa.length - 10} more` : ''
  }`
}

function formatOccurrenceResults(occurrences: any[]): string {
  if (occurrences.length === 0) return 'No occurrences found.'

  const byRegion: Record<string, number> = {}
  occurrences.forEach((o) => {
    const region = o.stateProvince || 'Unknown'
    byRegion[region] = (byRegion[region] || 0) + 1
  })

  const summary = Object.entries(byRegion)
    .map(([region, count]) => `• ${region}: ${count} occurrences`)
    .join('\n')

  return `Found ${occurrences.length} occurrences:\n${summary}`
}

function formatStatsResults(stats: any[]): string {
  if (stats.length === 0) return 'No statistics available.'

  const s = stats[0]
  return `Biodiversity Statistics:\n• Total species: ${s.totalSpecies}\n• Threatened species: ${s.threatenedCount}\n• Total occurrences: ${s.totalOccurrences}`
}
