#!/usr/bin/env node

import { BiodiversidadeMCPServer } from './mcp-server.js'

/**
 * Ponto de entrada principal para o servidor MCP da Biodiversidade.Online
 */
async function main() {
  // Parse argumentos da linha de comando
  const args = process.argv.slice(2)
  const isStdio = args.includes('--stdio')
  const isHttp = args.includes('--http')
  const portArg = args.find((arg) => arg.startsWith('--port='))
  const port = portArg ? parseInt(portArg.split('=')[1]) : 3001

  // Verificar se MONGO_URI está configurado
  if (!process.env.MONGO_URI) {
    console.error(
      '❌ Erro: MONGO_URI não está definido nas variáveis de ambiente'
    )
    console.error(
      '   Configure a variável de ambiente MONGO_URI com a string de conexão do MongoDB'
    )
    process.exit(1)
  }

  try {
    const server = new BiodiversidadeMCPServer()

    // Determinar modo de transporte
    if (isStdio) {
      console.error('🔗 Iniciando servidor MCP via stdio...')
      await server.runStdio()
    } else if (isHttp) {
      console.error(`🔗 Iniciando servidor MCP via HTTP na porta ${port}...`)
      await server.runHttp(port)
    } else {
      // Padrão é stdio se nenhum argumento for fornecido
      console.error('🔗 Iniciando servidor MCP via stdio (padrão)...')
      console.error(
        '   Use --http para modo HTTP ou --stdio para modo stdio explícito'
      )
      await server.runStdio()
    }
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor MCP:', error)
    process.exit(1)
  }
}

// Executar se for o arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
  })
}
