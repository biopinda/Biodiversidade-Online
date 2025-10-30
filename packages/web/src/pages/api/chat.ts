import prompt from '@/prompts/prompt.md?raw'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import {
  APICallError,
  experimental_createMCPClient,
  streamText,
  type Tool
} from 'ai'
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio'

import type { APIContext } from 'astro'
import { z } from 'zod'

function safeTools<T extends Record<string, Tool<any, any>>>(tools: T): T {
  // wrapped has the exact same keys & types as T
  const wrapped = {} as { [K in keyof T]: T[K] }

  // iterate only over your own keys
  ;(Object.keys(tools) as Array<keyof T>).forEach((key) => {
    const original = tools[key]!

    wrapped[key] = {
      ...original,
      execute: async (args: any, options: any) => {
        try {
          // call the real tool
          return await original.execute!(args, options)
        } catch (err: any) {
          // return an { error } object instead of throwing
          return {
            content: [
              { text: err instanceof Error ? err.message : String(err) }
            ]
          }
        }
      }
    } as T[typeof key]
  })

  return wrapped
}

const input = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })
  ),
  apiKey: z.string(),
  model: z
    .object({
      provider: z.enum(['openai', 'google']),
      model: z.string()
    })
    .default({
      provider: 'openai',
      model: 'gpt-4o-mini'
    }),
  maxSteps: z.number().default(10)
})

const systemPrompt = prompt

export async function POST({ request }: APIContext) {
  const { error, data } = input.safeParse(await request.json())
  if (error) {
    return new Response(JSON.stringify(error.format()), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { messages, apiKey, model: modelSpec, maxSteps } = data

  const openai = createOpenAI({
    apiKey
  })
  const google = createGoogleGenerativeAI({
    apiKey
  })

  const mongoDBConnectionString =
    import.meta.env.MONGODB_URI_READONLY ?? process.env.MONGODB_URI_READONLY
  if (!mongoDBConnectionString) {
    return new Response('Setup needed: MongoDB Connection string missing', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  const isWindows = process.platform === 'win32'
  const base = isWindows
    ? {
        command: 'cmd',
        args: ['/c', 'npx', '-y', 'mongodb-mcp-server', '--readOnly']
      }
    : { command: 'npx', args: ['-y', 'mongodb-mcp-server', '--readOnly'] }

  const mongodbTransport = new Experimental_StdioMCPTransport({
    command: base.command,
    args: base.args,
    env: {
      MDB_MCP_CONNECTION_STRING: mongoDBConnectionString
    }
  })
  const mongodbClient = await experimental_createMCPClient({
    transport: mongodbTransport
  })
  const tools = await mongodbClient.tools()

  const model =
    modelSpec.provider === 'openai'
      ? openai(modelSpec.model)
      : google(modelSpec.model)
  const result = streamText({
    model,
    maxSteps,
    system: systemPrompt,
    messages,
    tools: safeTools(tools),
    onError: (error: unknown) => {
      if (error instanceof APICallError) {
        console.error('API Call Error', error.url)
        console.dir(error.requestBodyValues, { depth: null })
        console.dir(error.data, { depth: null })
      } else {
        console.dir(error, { depth: null })
      }
    },
    experimental_activeTools: ['find', 'aggregate'],
    providerOptions: {
      ...(modelSpec.model.startsWith('o') && modelSpec.provider === 'openai'
        ? {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: 'auto'
            }
          }
        : {}),
      ...(modelSpec.provider === 'google'
        ? {
            google: {
              thinkingConfig: {
                includeThoughts: true
                // thinkingBudget: 2048, // Optional: set a token budget for reasoning
              }
            }
          }
        : {})
    }
  })

  return result.toDataStreamResponse({
    sendReasoning: true
  })
}
