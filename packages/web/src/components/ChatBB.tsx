/**
 * ChatBB Component
 * Conversational interface for biodiversity questions
 */

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  dataSources?: string[]
}

export default function ChatBB() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    // Add user message to UI
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: userMessage.content,
          conversationId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || 'Erro ao processar mensagem'
        )
      }

      const data = await response.json()

      // Update conversation ID
      if (data.conversationId) {
        setConversationId(data.conversationId)
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
        dataSources: data.dataSources
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'json' | 'markdown') => {
    let content = ''

    if (format === 'json') {
      content = JSON.stringify(messages, null, 2)
    } else {
      content = messages
        .map((m) => {
          const prefix = m.role === 'user' ? '**Você:**' : '**ChatBB:**'
          return `${prefix}\n${m.content}\n`
        })
        .join('\n')
    }

    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/markdown'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'md'}`
    a.click()
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-green-700">ChatBB</h1>
          <p className="text-sm text-gray-600">
            Faça perguntas sobre biodiversidade do Brasil
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="container mx-auto flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
            <svg
              className="mb-4 h-16 w-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="mb-2 text-lg font-semibold">Comece uma conversa</p>
            <p className="text-sm">
              Faça perguntas sobre espécies ameaçadas, invasoras, ou unidades de conservação
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-md rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-green-600 text-white'
                      : 'border border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.dataSources && message.dataSources.length > 0 && (
                    <p className="mt-2 text-xs opacity-70">
                      Fonte: {message.dataSources.join(', ')}
                    </p>
                  )}
                  <p className="mt-1 text-xs opacity-50">
                    {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="inline-block h-3 w-3 animate-bounce rounded-full bg-gray-400" />
                  <span className="inline-block h-3 w-3 animate-bounce rounded-full bg-gray-400 animation-delay-100" />
                  <span className="inline-block h-3 w-3 animate-bounce rounded-full bg-gray-400 animation-delay-200" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro: {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="container mx-auto">
          <form onSubmit={handleSendMessage} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escreva sua pergunta..."
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>

            {/* Export Buttons */}
            {messages.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Exportar JSON
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('markdown')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Exportar Markdown
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
