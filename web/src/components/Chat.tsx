'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import {
  CogIcon,
  CommandIcon,
  CornerDownRightIcon,
  Eye,
  EyeOff,
  InfoIcon
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'

function ConfigForm({
  initialKey = '',
  onSetKey
}: {
  initialKey: string
  onSetKey: (key: string) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 text-sm items-center">
        Insira sua chave de API OpenAI.{' '}
        <i>
          Obtenha uma em{' '}
          <a
            className="hover:underline text-black"
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://platform.openai.com/api-keys
          </a>
        </i>
        <Button
          variant={showInfo ? 'default' : 'ghost'}
          onClick={() => setShowInfo((prev) => !prev)}
        >
          <InfoIcon />
        </Button>
      </div>
      {showInfo && (
        <div className="bg-slate-800 rounded-md p-2 text-white text-sm self-start">
          Uma chave de API é necessária para usar o chat. Ela é armazenada
          apenas no seu navegador.
        </div>
      )}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          defaultValue={initialKey}
          type={showPassword ? 'text' : 'password'}
          autoComplete="existing-password"
          placeholder="Chave de API OpenAI"
        />
        <Button
          variant="ghost"
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? <Eye /> : <EyeOff />}
        </Button>
        <Button
          type="button"
          onClick={() => onSetKey(inputRef.current?.value ?? '')}
        >
          OK
        </Button>
      </div>
    </div>
  )
}

function ChatBubble({
  align,
  children
}: {
  align: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg py-2 px-4 bg-slate-200 flex flex-col gap-2',
        align === 'left' ? 'mr-24' : 'ml-24'
      )}
    >
      {children}
    </div>
  )
}

export default function Chat() {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [apiKey, setApiKey] = useState<string | null | -1>(-1)
  const [strongModel, setStrongModel] = useState(false)

  const model = strongModel ? 'gpt-4.1' : 'gpt-4.1-mini'

  useEffect(() => {
    if (apiKey === -1) {
      const _apiKey = localStorage.getItem('apiKey') || null
      setApiKey(_apiKey)
      if (!_apiKey) {
        setIsConfiguring(true)
      }
    } else if (apiKey) {
      localStorage.setItem('apiKey', apiKey)
    }
  }, [apiKey])

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    error,
    reload,
    status,
    stop
  } = useChat({
    api: '/api/chat',
    body: { apiKey, model }
  })

  const isMac =
    typeof window !== 'undefined' &&
    (window.navigator?.userAgent?.includes('Mac') ||
      window.navigator?.userAgent?.includes('iPad'))

  return (
    <div className="py-4 mx-auto max-w-screen-md flex flex-col h-screen gap-4">
      <div className="flex-1 overflow-y-auto flex flex-col-reverse">
        <div className="flex flex-col gap-3">
          {messages.map((message) => {
            const toolInvocationParts = message.parts.filter(
              (
                part
              ): part is {
                type: 'tool-invocation'
                toolInvocation: {
                  toolName: string
                  state: 'result'
                  step?: number
                  toolCallId: string
                  args: any
                  result: any
                }
              } => part.type === 'tool-invocation'
            )

            return (
              <ChatBubble
                key={message.id}
                align={message.role === 'user' ? 'right' : 'left'}
              >
                {toolInvocationParts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {toolInvocationParts.map((part, index) => {
                      const results = part.toolInvocation.result?.content
                      const waiting = part.toolInvocation.state !== 'result'
                      return (
                        <div className="flex">
                          <Badge
                            key={index}
                            className={cn(
                              'text-xs cursor-default',
                              waiting && 'animate-pulse',
                              results?.length > 0 && 'rounded-e-none'
                            )}
                            title={JSON.stringify(part.toolInvocation.args)}
                          >
                            {part.toolInvocation.toolName}
                          </Badge>
                          {results?.length > 0 && (
                            <Badge
                              className="text-xs cursor-default bg-slate-50 text-slate-800 rounded-s-none"
                              title={results
                                .map(
                                  (content: { text: string }) => content?.text
                                )
                                .join('\n')}
                            >
                              {results.length}
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {message.parts.map((part, index) => {
                  // text parts:
                  if (part.type === 'text') {
                    return (
                      <div
                        key={index}
                        className="prose prose-td:py-0 prose-custom-code"
                      >
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </Markdown>
                      </div>
                    )
                  }

                  // reasoning parts:
                  if (part.type === 'reasoning') {
                    return (
                      <pre key={index}>
                        {part.details.map((detail) =>
                          detail.type === 'text' ? detail.text : '<redacted>'
                        )}
                      </pre>
                    )
                  }
                  return null
                })}
              </ChatBubble>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="flex gap-2">
          <div>Ocorreu um erro.</div>
          <Button type="button" onClick={() => reload()} variant="outline">
            Tentar novamente
          </Button>
        </div>
      )}

      {(status === 'submitted' || status === 'streaming') && (
        <div>{status === 'submitted' && <span>...</span>}</div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="relative w-full">
          {isConfiguring ? (
            <ConfigForm
              initialKey={apiKey && apiKey !== -1 ? apiKey : ''}
              onSetKey={(key) => {
                setApiKey(key)
                setIsConfiguring(false)
              }}
            />
          ) : (
            <Textarea
              value={input}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              onChange={handleInputChange}
              disabled={error != null || status === 'streaming'}
              className="field-sizing-content min-h-20"
            />
          )}

          <div className="absolute right-full mr-2 bottom-0 flex flex-col gap-0 items-center">
            
            <Button
              variant={isConfiguring ? 'default' : 'ghost'}
              onClick={() => {
                if (apiKey && apiKey !== -1) {
                  setIsConfiguring((prev) => !prev)
                }
              }}
            >
              <CogIcon />
            </Button>
          </div>
        </div>
        {!isConfiguring && apiKey && apiKey !== -1 && (
          <div className="flex flex-col gap-2 justify-end">
            {status === 'streaming' && (
              <Button type="button" onClick={() => stop()} variant="outline">
                Stop
              </Button>
            )}
            <Button
              type="submit"
              disabled={!input || error != null || status === 'streaming'}
            >
              <div className="flex gap-2 items-center">
                <span>{isMac ? <CommandIcon /> : 'Ctrl'}</span>
                <CornerDownRightIcon className="-rotate-90" />
              </div>
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
