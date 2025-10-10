import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { closeConnection } from './database.js'
import {
  getTaxaCountByKingdom,
  queryTaxa,
  TaxaFilterSchema,
  type TaxaFilter
} from './taxa-service.js'

/**
 * MCP Server para acesso à coleção taxa da Biodiversidade.Online
 */
export class BiodiversidadeMCPServer {
  private server: McpServer

  constructor() {
    this.server = new McpServer({
      name: 'biodiversidade-mcp-server',
      version: '1.0.0',
      description:
        'MCP server para acesso aos dados de biodiversidade brasileira'
    })

    this.setupTools()
    this.setupErrorHandling()
  }

  /**
   * Configura as ferramentas MCP
   */
  private setupTools(): void {
    // Ferramenta para consultar taxa
    this.server.registerTool(
      'query_taxa',
      {
        description:
          'Consulta taxa da biodiversidade brasileira com filtros opcionais',
        inputSchema: {
          scientificName: z
            .string()
            .optional()
            .describe(
              'Nome científico da espécie (busca por substring, case-insensitive)'
            ),
          kingdom: z
            .string()
            .optional()
            .describe('Reino taxonômico (ex: Animalia, Plantae)'),
          phylum: z.string().optional().describe('Filo taxonômico'),
          class: z.string().optional().describe('Classe taxonômica'),
          order: z.string().optional().describe('Ordem taxonômica'),
          family: z.string().optional().describe('Família taxonômica'),
          genus: z.string().optional().describe('Gênero taxonômico'),
          taxonomicStatus: z
            .string()
            .optional()
            .describe('Status taxonômico (ex: NOME_ACEITO, SINONIMO)'),
          stateProvince: z
            .string()
            .optional()
            .describe('Estado brasileiro onde a espécie ocorre'),
          country: z.string().optional().describe('País onde a espécie ocorre'),
          page: z
            .number()
            .min(0)
            .default(0)
            .describe('Página para paginação (inicia em 0)'),
          limit: z
            .number()
            .min(1)
            .max(100)
            .default(50)
            .describe('Número máximo de resultados por página')
        }
      },
      async (args) => await this.handleQueryTaxa(args)
    )

    // Ferramenta para contagem por reino
    this.server.registerTool(
      'get_taxa_count_by_kingdom',
      {
        description: 'Obtém contagem de taxa aceitos agrupados por reino',
        inputSchema: {}
      },
      async () => await this.handleGetTaxaCountByKingdom()
    )
  }

  /**
   * Handler para consulta de taxa
   */
  private async handleQueryTaxa(args: any) {
    const parseResult = TaxaFilterSchema.safeParse(args)

    if (!parseResult.success) {
      throw new Error(`Parâmetros inválidos: ${parseResult.error.message}`)
    }

    const filters: TaxaFilter = parseResult.data
    const result = await queryTaxa(filters)

    return {
      content: [
        {
          type: 'text' as const,
          text:
            `Encontrados ${result.total} taxa(s) correspondentes aos critérios.\\n\\n` +
            `Página ${result.page + 1} de ${result.totalPages} (mostrando ${result.data.length} resultados):\\n\\n` +
            result.data
              .map((taxon) => {
                let text = `**${taxon.scientificName}**`
                if (taxon.kingdom) text += ` | Reino: ${taxon.kingdom}`
                if (taxon.family) text += ` | Família: ${taxon.family}`
                if (taxon.taxonomicStatus)
                  text += ` | Status: ${taxon.taxonomicStatus}`
                if (taxon.stateProvince)
                  text += ` | Estado: ${taxon.stateProvince}`

                // Adicionar nomes vernaculares se disponíveis
                if (taxon.vernacularname && taxon.vernacularname.length > 0) {
                  const vernacular = taxon.vernacularname
                    .map((v) => v.vernacularName)
                    .join(', ')
                  text += ` | Nomes populares: ${vernacular}`
                }

                return text
              })
              .join('\\n\\n')
        }
      ]
    }
  }

  /**
   * Handler para contagem de taxa por reino
   */
  private async handleGetTaxaCountByKingdom() {
    const counts = await getTaxaCountByKingdom()

    const totalTaxa = Object.values(counts).reduce(
      (sum, count) => sum + count,
      0
    )

    let text = `**Contagem de Taxa Aceitos por Reino:**\\n\\n`
    text += `Total geral: ${totalTaxa.toLocaleString()} taxa\\n\\n`

    for (const [kingdom, count] of Object.entries(counts)) {
      const percentage = ((count / totalTaxa) * 100).toFixed(1)
      text += `• **${kingdom}**: ${count.toLocaleString()} taxa (${percentage}%)\\n`
    }

    return {
      content: [
        {
          type: 'text' as const,
          text
        }
      ]
    }
  }

  /**
   * Configura tratamento de erros
   */
  private setupErrorHandling(): void {
    // Tratamento graceful de encerramento
    process.on('SIGINT', async () => {
      console.log('\\n🔌 Encerrando servidor MCP...')
      await closeConnection()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('\\n🔌 Encerrando servidor MCP...')
      await closeConnection()
      process.exit(0)
    })
  }

  /**
   * Inicia o servidor via stdio
   */
  async runStdio(): Promise<void> {
    const transport = new StdioServerTransport()
    console.error('🚀 Servidor MCP iniciado via stdio')
    await this.server.connect(transport)
  }

  /**
   * Inicia o servidor via HTTP/SSE
   */
  async runHttp(port: number = 3001): Promise<void> {
    const transport = new SSEServerTransport('/message', { port } as any)
    console.log(`🚀 Servidor MCP iniciado via HTTP na porta ${port}`)
    await this.server.connect(transport)
  }
}
