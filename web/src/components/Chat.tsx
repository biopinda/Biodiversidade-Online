'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import {
  CogIcon,
  CommandIcon,
  CornerDownRightIcon,
  InfoIcon
} from 'lucide-react'
import {
  unstable_ViewTransition as ViewTransition,
  startTransition,
  useEffect,
  useRef,
  useState
} from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ModelSelector, { type Provider } from './ModelSelector'
import PasswordInput from './PasswordInput'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'

function ConfigForm({
  initialKeys,
  onSetKeys
}: {
  initialKeys: { openAIKey: string; geminiKey: string }
  onSetKeys: (keys: { openAIKey: string; geminiKey: string }) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const openAIKeyRef = useRef<HTMLInputElement>(null)
  const geminiKeyRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex gap-2 items-end">
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex gap-2 text-sm items-center">
          Defina suas chaves de API aqui.
          <Button
            className="py-1 !px-1 h-auto"
            variant={showInfo ? 'default' : 'ghost'}
            onClick={() => setShowInfo((prev) => !prev)}
          >
            <InfoIcon />
          </Button>
        </div>
        {showInfo && (
          <div className="bg-slate-800 rounded-md p-2 text-white text-sm self-start">
            Uma chave de API é necessária para usar o chat. Elas são armazenadas
            apenas no seu navegador.
          </div>
        )}
        <div className="flex gap-2 text-sm items-center">
          <b>OpenAI</b>{' '}
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
        </div>
        <PasswordInput
          ref={openAIKeyRef}
          initialValue={initialKeys.openAIKey}
          placeholder="Chave de API OpenAI"
        />
        <div className="flex gap-2 text-sm items-center">
          <b>Google Gemini</b>{' '}
          <i>
            Obtenha uma em{' '}
            <a
              className="hover:underline text-black"
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://aistudio.google.com/app/apikey
            </a>
          </i>
        </div>
        <PasswordInput
          ref={geminiKeyRef}
          initialValue={initialKeys.geminiKey}
          placeholder="Chave de API Google Gemini"
        />
      </div>
      <Button
        type="button"
        onClick={() =>
          onSetKeys({
            openAIKey: openAIKeyRef.current?.value ?? '',
            geminiKey: geminiKeyRef.current?.value ?? ''
          })
        }
      >
        OK
      </Button>
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

function ToolCall({
  toolCall
}: {
  toolCall: {
    toolName: string
    state: string
    result: { content: { text: string }[] }
    args: unknown
  }
}) {
  {
    const [showDetails, setShowDetails] = useState(false)

    const toggleDetails = () => {
      startTransition(() => {
        setShowDetails((prev) => !prev)
      })
    }

    const results = toolCall.result?.content
    const waiting = toolCall.state !== 'result'
    return (
      <ViewTransition>
        <div
          className={cn(
            'flex flex-col gap-2 max-w-full',
            showDetails && 'w-full'
          )}
        >
          <div className="flex" onClick={toggleDetails}>
            <ViewTransition name="tool-call-badge">
              <Badge
                className={cn(
                  'text-xs cursor-default',
                  waiting && 'animate-pulse',
                  results?.length > 0 && 'rounded-e-none'
                )}
                title={JSON.stringify(toolCall.args)}
              >
                {toolCall.toolName}
              </Badge>
              {results?.length > 0 && (
                <Badge
                  className="text-xs cursor-default bg-slate-50 text-slate-800 rounded-s-none"
                  title={results
                    .map((content: { text: string }) => content?.text)
                    .join('\n')}
                >
                  {results.length}
                </Badge>
              )}
            </ViewTransition>
          </div>
          {showDetails && (
            <div className="flex gap-1 justify-between">
              <ScrollArea className="rounded-md border-slate-300 border p-2 text-xs bg-slate-800 text-white w-full max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(toolCall.args, null, 2)}
                </pre>
              </ScrollArea>
              <ScrollArea className="rounded-md border-slate-300 border p-2 text-xs bg-slate-800 text-white w-full max-h-32 overflow-y-auto">
                {toolCall.result?.content?.map(({ text }) => {
                  try {
                    const json = JSON.parse(text)
                    return (
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(json, null, 2)}
                      </pre>
                    )
                  } catch (e) {
                    return text
                  }
                })}
              </ScrollArea>
            </div>
          )}
        </div>
      </ViewTransition>
    )
  }
}

function ReasoningPart({ part }: { part: any }) {
  const [showDetails, setShowDetails] = useState(false)

  const toggleDetails = () => {
    startTransition(() => {
      setShowDetails((prev) => !prev)
    })
  }

  return (
    <ViewTransition>
      <div
        className={cn(
          'flex flex-col gap-2 max-w-full',
          showDetails && 'w-full'
        )}
      >
        <div className="flex" onClick={toggleDetails}>
          <ViewTransition name="reasoning-badge">
            <Badge
              className={cn(
                'text-xs cursor-pointer',
                showDetails ? 'bg-slate-800 text-white' : '',
                'inline-flex items-center'
              )}
              title="Raciocínio do modelo"
            >
              Raciocínio
            </Badge>
          </ViewTransition>
        </div>
        {showDetails && (
          <ScrollArea className="prose prose-p:my-0 prose-td:py-0 prose-custom-code rounded-md border border-slate-300 p-2 text-xs bg-slate-100 text-black w-full max-h-32 overflow-y-auto max-w-none flex flex-col-reverse">
            <div className="flex flex-col gap-1">
              {part.details && part.details.length > 0
                ? part.details.map((detail: any, i: number) => (
                    <Markdown remarkPlugins={[remarkGfm]} key={i}>
                      {detail.type === 'text' ? detail.text : detail.data}
                    </Markdown>
                  ))
                : null}
              {part.reasoning && (
                <Markdown remarkPlugins={[remarkGfm]}>
                  {part.reasoning}
                </Markdown>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </ViewTransition>
  )
}

export default function Chat() {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [localConfigLoaded, setLocalConfigLoaded] = useState(false)
  const [apiKeys, setApiKeys] = useState<{
    openAIKey: string
    geminiKey: string
  }>({
    openAIKey: '',
    geminiKey: ''
  })
  const [selectedModel, setSelectedModel] = useState<{
    provider: 'openai' | 'google'
    model: string
  } | null>(null)

  useEffect(() => {
    if (!localConfigLoaded) {
      const _apiKeys = localStorage.getItem('apiKeys')
      if (_apiKeys) {
        setApiKeys(JSON.parse(_apiKeys))
      }
      const _selectedModel = localStorage.getItem('model')
      if (_selectedModel) {
        setSelectedModel(JSON.parse(_selectedModel))
      } else {
        setSelectedModel({ provider: 'openai', model: 'gpt-4o-mini' })
      }
      setLocalConfigLoaded(true)
    } else {
      localStorage.setItem('apiKeys', JSON.stringify(apiKeys))
      localStorage.setItem('model', JSON.stringify(selectedModel))
    }
  }, [apiKeys, selectedModel, localConfigLoaded])

  const hasApiKey = apiKeys.openAIKey !== '' || apiKeys.geminiKey !== ''
  const apiKey =
    selectedModel?.provider === 'openai' ? apiKeys.openAIKey : apiKeys.geminiKey

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    error,
    reload,
    status,
    stop,
    setMessages
  } = useChat({
    api: '/api/chat',
    body: { apiKey, model: selectedModel }
  })

  useEffect(() => {
    if (status === 'ready') {
      const lastMessage = messages.at(-1)
      if (lastMessage?.role === 'assistant' && lastMessage?.content === '') {
        setMessages(messages.slice(0, -1))
      }
    }
  }, [status, messages])

  const isMac =
    typeof window !== 'undefined' &&
    (window.navigator?.userAgent?.includes('Mac') ||
      window.navigator?.userAgent?.includes('iPad'))

  return (
    <div className="py-4 mx-auto max-w-screen-lg flex flex-col h-screen gap-4">
      <div className="flex-1 overflow-y-auto flex flex-col-reverse">
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => {
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

            const isLastMessage = index === messages.length - 1
            const isLoading = status === 'streaming' && isLastMessage

            return (
              <ChatBubble
                key={message.id}
                align={message.role === 'user' ? 'right' : 'left'}
              >
                {toolInvocationParts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {toolInvocationParts.map((part, index) => (
                      <ToolCall key={index} toolCall={part.toolInvocation} />
                    ))}
                    {message.parts
                      .filter((part) => part.type === 'reasoning')
                      .map((part, i) => (
                        <ReasoningPart
                          key={`reasoning-badge-${i}`}
                          part={part}
                        />
                      ))}
                  </div>
                )}
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <div
                        key={index}
                        className="prose prose-td:py-0 prose-custom-code max-w-full"
                      >
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </Markdown>
                      </div>
                    )
                  }
                  // skip reasoning part here, it's handled above
                  return null
                })}
                {isLoading && (
                  <div className="animate-pulse self-start">...</div>
                )}
              </ChatBubble>
            )
          })}
          {status === 'submitted' && (
            <ChatBubble align="left">
              <div className="animate-pulse">...</div>
            </ChatBubble>
          )}
        </div>
      </div>

      {error && (
        <div className="flex gap-2 items-center">
          <div>Ocorreu um erro.</div>
          <Button type="button" onClick={() => reload()} variant="outline">
            Tentar novamente
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="relative w-full mt-8">
          {localConfigLoaded && (isConfiguring || !hasApiKey) ? (
            <ConfigForm
              initialKeys={apiKeys}
              onSetKeys={(keys) => {
                setApiKeys(keys)
                setIsConfiguring(false)
              }}
            />
          ) : (
            <div className="relative">
              {localConfigLoaded && (
                <div className="absolute bottom-full left-0 mb-2">
                  <ModelSelector
                    availableProviders={['openai', 'google']}
                    onModelChange={(model: {
                      provider: Provider
                      model: string
                    }) => {
                      setSelectedModel(model)
                    }}
                    initialModel={selectedModel ?? undefined}
                  />
                </div>
              )}
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
                className="field-sizing-content min-h-20 border-slate-400"
              />
            </div>
          )}

          <div className="absolute right-full mr-2 bottom-0 flex flex-col gap-0 items-center">
            <Button
              variant={isConfiguring || !hasApiKey ? 'default' : 'ghost'}
              disabled={!hasApiKey}
              onClick={() => {
                if (hasApiKey) {
                  setIsConfiguring((prev) => !prev)
                }
              }}
            >
              <CogIcon />
            </Button>
          </div>
        </div>
        {!isConfiguring && apiKey && (
          <div className="flex flex-col gap-2 justify-end">
            {status === 'streaming' && (
              <Button type="button" onClick={() => stop()} variant="outline">
                Stop
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                !input ||
                error != null ||
                status === 'streaming' ||
                status === 'submitted'
              }
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
