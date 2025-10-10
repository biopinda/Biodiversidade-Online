import type { APIContext } from 'astro'

/**
 * Endpoint para informações sobre o servidor MCP
 */
export async function GET({ request }: APIContext) {
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  return new Response(
    JSON.stringify({
      name: 'Biodiversidade.Online MCP Server',
      version: '1.0.0',
      description:
        'Servidor MCP para acesso aos dados de biodiversidade brasileira',
      endpoints: {
        documentation: `${baseUrl}/mcp`,
        stdio: {
          description: 'Conexão via stdio para uso local',
          command: 'node',
          args: ['packages/mcp-server/dist/index.js', '--stdio'],
          env: {
            MONGO_URI: 'required'
          }
        },
        http: {
          description: 'Conexão via HTTP/SSE para uso remoto',
          url: `${baseUrl}:3001/message`,
          status: 'available_on_demand'
        }
      },
      tools: [
        {
          name: 'query_taxa',
          description:
            'Consulta taxa da biodiversidade brasileira com filtros opcionais',
          parameters: [
            'scientificName',
            'kingdom',
            'phylum',
            'class',
            'order',
            'family',
            'genus',
            'taxonomicStatus',
            'stateProvince',
            'country',
            'page',
            'limit'
          ]
        },
        {
          name: 'get_taxa_count_by_kingdom',
          description: 'Obtém contagem de taxa aceitos agrupados por reino',
          parameters: []
        }
      ],
      requirements: {
        mongodb: 'Requer conexão com MongoDB via MONGO_URI',
        sdk: '@modelcontextprotocol/sdk'
      }
    }),
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}
