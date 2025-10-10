# MCP Server da Biodiversidade.Online

Servidor MCP (Model Context Protocol) para acesso à coleção de taxa da Biodiversidade.Online.

## Funcionalidades

- **query_taxa**: Consulta taxa com filtros (scientificName, kingdom, family, etc.)
- **get_taxa_count_by_kingdom**: Estatísticas de taxa por reino

## Uso

### Stdio (Local)

```bash
MONGO_URI="mongodb://..." node dist/index.js --stdio
```

### HTTP (Remoto)

```bash
MONGO_URI="mongodb://..." node dist/index.js --http --port=3001
```

## Configuração Cliente MCP

### Claude Desktop

```json
{
  "mcpServers": {
    "biodiversidade": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js", "--stdio"],
      "env": {
        "MONGO_URI": "mongodb://..."
      }
    }
  }
}
```

## Desenvolvimento

```bash
# Build
bun run build

# Desenvolvimento
bun run dev
```

## Requisitos

- Node.js 18+
- Acesso ao MongoDB da Biodiversidade.Online
- @modelcontextprotocol/sdk
