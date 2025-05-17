import { experimental_createMCPClient } from 'ai'

import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio'

const mongoDBConnectionString =
  import.meta.env.MONGODB_URI_READONLY ?? process.env.MONGODB_URI_READONLY

const mongodbTransport = new Experimental_StdioMCPTransport({
  command: 'node',
  args: [
    './node_modules/mongodb-mcp-server',
    '--connectionString',
    mongoDBConnectionString!
  ]
})
const mongodbClient = await experimental_createMCPClient({
  transport: mongodbTransport
})
const tools = await mongodbClient.tools()

console.dir(tools.aggregate, { depth: null })
