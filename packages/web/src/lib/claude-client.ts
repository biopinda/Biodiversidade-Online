/**
 * Claude API Client
 * Initializes Anthropic SDK and manages conversation context
 */

import Anthropic from '@anthropic-ai/sdk'
import { logger } from './logger'

export class ClaudeClient {
  private client: Anthropic
  private model = 'claude-3-5-sonnet-20241022'
  private maxTokens = 4096

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY

    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is not set')
    }

    this.client = new Anthropic({
      apiKey
    })

    logger.info('Claude client initialized', {
      model: this.model,
      maxTokens: this.maxTokens
    })
  }

  /**
   * Send a message with conversation history
   */
  async sendMessage(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
    }> = []
  ): Promise<string> {
    try {
      const messages = [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: userMessage
        }
      ]

      logger.debug('Sending message to Claude', {
        messageLength: userMessage.length,
        historyLength: conversationHistory.length
      })

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages
      })

      const assistantMessage =
        response.content[0].type === 'text' ? response.content[0].text : ''

      logger.info('Claude response received', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason
      })

      return assistantMessage
    } catch (error) {
      logger.error(
        'Error communicating with Claude',
        error instanceof Error ? error : new Error(String(error)),
        { messageLength: userMessage.length }
      )
      throw error
    }
  }

  /**
   * Send a message with streaming response
   * Note: Streaming requires SSE endpoint implementation
   */
  async *streamMessage(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
    }> = []
  ): AsyncGenerator<string> {
    try {
      const messages = [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: userMessage
        }
      ]

      logger.debug('Starting streamed message to Claude', {
        messageLength: userMessage.length
      })

      const response = await this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages
      })

      for await (const event of response) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text
        }
      }

      logger.info('Streamed response completed')
    } catch (error) {
      logger.error(
        'Error in streamed communication with Claude',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }
}

// Singleton instance
let claudeClient: ClaudeClient | null = null

export function getClaudeClient(): ClaudeClient {
  if (!claudeClient) {
    claudeClient = new ClaudeClient()
  }
  return claudeClient
}
