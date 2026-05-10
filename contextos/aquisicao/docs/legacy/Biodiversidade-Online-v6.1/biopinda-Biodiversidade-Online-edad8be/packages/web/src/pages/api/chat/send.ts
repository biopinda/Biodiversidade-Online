/**
 * ChatBB Send Message Endpoint
 * POST /api/chat/send
 * Sends user message to Claude via MCP adapter
 */

import { getClaudeClient } from '@/lib/claude-client'
import { logger } from '@/lib/logger'
import { formatResultsForClaude, parseAndExecuteQuery } from '@/lib/mcp-adapter'
import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'

interface ChatRequest {
  query: string
  conversationId?: string
}

interface ChatResponse {
  response: string
  dataSources: string[]
  conversationId: string
  timestamp: string
}

// System prompt for ChatBB
const SYSTEM_PROMPT = `You are ChatBB, a helpful assistant for the Biodiversidade.Online platform specializing in Brazilian biodiversity information.

Your role is to help users understand and explore biodiversity data about Brazilian species, their conservation status, invasive species, and protected areas.

Key guidelines:
1. Respond in Portuguese Brazilian (PT-BR) or English based on user language
2. Provide accurate information based on available data
3. Cite data sources when making claims (GBIF, Flora/Funga Brasil, SiBBr, IBAMA, ICMBio)
4. Acknowledge limitations if data is incomplete
5. Be helpful and encouraging about conservation
6. For technical questions, explain biodiversity concepts clearly
7. Always prioritize accuracy over comprehensiveness

When answering questions:
- Reference specific species names (scientific and common names)
- Mention conservation status when relevant
- Note geographic distribution in Brazilian states
- Highlight endangered or invasive species concerns
- Suggest conservation resources when appropriate`

export async function POST(context: APIContext): Promise<Response> {
  try {
    const body = (await context.request.json()) as ChatRequest

    if (!body.query) {
      return new Response(
        JSON.stringify({
          error: 'Missing query parameter',
          code: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    logger.info('Chat request received', {
      queryLength: body.query.length
    })

    // Get or create conversation
    const db = await getMongoDatabase()
    const sessionCollection = db.collection('chat_sessions')

    let conversationId = body.conversationId
    let conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
    }> = []

    if (conversationId) {
      const session = await sessionCollection.findOne({
        _id: conversationId
      })
      if (session && session.messages) {
        conversationHistory = session.messages
          .slice(-10) // Limit to last 10 messages
          .map((m: any) => ({
            role: m.role,
            content: m.content
          }))
      }
    } else {
      conversationId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // Query data via MCP adapter
    const queryResult = await parseAndExecuteQuery(body.query)
    const dataContext = formatResultsForClaude(queryResult)

    // Create augmented system prompt with data context
    const augmentedSystemPrompt = `${SYSTEM_PROMPT}

Current available data:
${dataContext}`

    // Send to Claude
    const claudeClient = getClaudeClient()
    const response = await claudeClient.sendMessage(
      body.query,
      augmentedSystemPrompt,
      conversationHistory
    )

    // Store conversation
    const dataSources = queryResult.success ? [queryResult.source] : []

    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: body.query },
      { role: 'assistant' as const, content: response }
    ]

    await sessionCollection.updateOne(
      { _id: conversationId },
      {
        $set: {
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date()
          })),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days TTL
        }
      },
      { upsert: true }
    )

    logger.info('Chat response generated', {
      responseLength: response.length,
      dataSources: dataSources.length,
      conversationId
    })

    const chatResponse: ChatResponse = {
      response,
      dataSources,
      conversationId,
      timestamp: new Date().toISOString()
    }

    return new Response(JSON.stringify(chatResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    logger.error(
      'Error in chat endpoint',
      error instanceof Error ? error : new Error(String(error))
    )

    return new Response(
      JSON.stringify({
        error: 'Error processing chat request',
        code: 'CHAT_ERROR'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
