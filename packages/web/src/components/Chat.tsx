'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { decrypt, encrypt } from '@/lib/crypto'
import { cn } from '@/lib/utils'
import { useChat, type Message } from '@ai-sdk/react'
import {
  CogIcon,
  CommandIcon,
  CornerDownRightIcon,
  HistoryIcon,
  InfoIcon,
  MessageSquarePlusIcon,
  Trash2Icon
} from 'lucide-react'
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChatHistoryList, { type ChatHistoryEntry } from './ChatHistoryList'
import EncryptionPasswordDialog from './EncryptionPasswordDialog'
import ModelSelector, { type Provider } from './ModelSelector'
import PasswordInput from './PasswordInput'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Textarea } from './ui/textarea'

type StoredChatSession = {
  id: string
  createdAt: string
  updatedAt: string
  messages: Message[]
  lastError: string | null
}

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory'
const CURRENT_CHAT_ID_STORAGE_KEY = 'chatHistoryCurrentId'

const RATE_LIMIT_WINDOW = 60000
const MAX_STORAGE_OPERATIONS_PER_WINDOW = 100

class SessionRateLimiter {
  private operations: number[] = []

  check(): boolean {
    const now = Date.now()
    this.operations = this.operations.filter(
      (time) => now - time < RATE_LIMIT_WINDOW
    )

    if (this.operations.length >= MAX_STORAGE_OPERATIONS_PER_WINDOW) {
      return false
    }

    this.operations.push(now)
    return true
  }

  reset(): void {
    this.operations = []
  }
}

const rateLimiter = new SessionRateLimiter()

const timeValue = (isoDate: string | undefined) => {
  if (!isoDate) {
    return 0
  }
  const value = new Date(isoDate).getTime()
  return Number.isNaN(value) ? 0 : value
}

const sortSessions = (sessions: StoredChatSession[]) =>
  [...sessions].sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt))

const messagesEqual = (a: Message[], b: Message[]) => {
  if (a.length !== b.length) {
    return false
  }

  for (let i = 0; i < a.length; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      return false
    }
  }

  return true
}

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
    <div className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          Defina suas chaves de API aqui.
          <Button
            className="h-auto !px-1 py-1"
            variant={showInfo ? 'default' : 'ghost'}
            onClick={() => setShowInfo((prev) => !prev)}
          >
            <InfoIcon />
          </Button>
        </div>
        {showInfo && (
          <div className="self-start rounded-md bg-slate-800 p-2 text-sm text-white">
            Uma chave de API é necessária para usar o chat. Elas são armazenadas
            apenas no seu navegador.
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <b>OpenAI</b>{' '}
          <i>
            Obtenha uma em{' '}
            <a
              className="text-black hover:underline"
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
        <div className="flex items-center gap-2 text-sm">
          <b>Google Gemini</b>{' '}
          <i>
            Obtenha uma em{' '}
            <a
              className="text-black hover:underline"
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
        'flex flex-col gap-2 rounded-lg bg-slate-200 px-4 py-2',
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
      <>
        <div
          className={cn(
            'flex max-w-full flex-col gap-2',
            showDetails && 'w-full'
          )}
        >
          <div className="flex" onClick={toggleDetails}>
            <>
              <Badge
                className={cn(
                  'cursor-default text-xs',
                  waiting && 'animate-pulse',
                  results?.length > 0 && 'rounded-e-none'
                )}
                title={JSON.stringify(toolCall.args)}
              >
                {toolCall.toolName}
              </Badge>
              {results?.length > 0 && (
                <Badge
                  className="cursor-default rounded-s-none bg-slate-50 text-xs text-slate-800"
                  title={results
                    .map((content: { text: string }) => content?.text)
                    .join('\n')}
                >
                  {results.length}
                </Badge>
              )}
            </>
          </div>
          {showDetails && (
            <div className="flex justify-between gap-1">
              <ScrollArea className="max-h-32 w-full overflow-y-auto rounded-md border border-slate-300 bg-slate-800 p-2 text-xs text-white">
                <pre className="break-all whitespace-pre-wrap">
                  {JSON.stringify(toolCall.args, null, 2)}
                </pre>
              </ScrollArea>
              <ScrollArea className="max-h-32 w-full overflow-y-auto rounded-md border border-slate-300 bg-slate-800 p-2 text-xs text-white">
                {toolCall.result?.content?.map(({ text }) => {
                  try {
                    const json = JSON.parse(text)
                    return (
                      <pre className="break-all whitespace-pre-wrap">
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
      </>
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
    <>
      <div
        className={cn(
          'flex max-w-full flex-col gap-2',
          showDetails && 'w-full'
        )}
      >
        <div className="flex" onClick={toggleDetails}>
          <>
            <Badge
              className={cn(
                'cursor-pointer text-xs',
                showDetails ? 'bg-slate-800 text-white' : '',
                'inline-flex items-center'
              )}
              title="Raciocínio do modelo"
            >
              Raciocínio
            </Badge>
          </>
        </div>
        {showDetails && (
          <ScrollArea className="prose prose-p:my-0 prose-td:py-0 prose-custom-code flex max-h-32 w-full max-w-none flex-col-reverse overflow-y-auto rounded-md border border-slate-300 bg-slate-100 p-2 text-xs text-black">
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
    </>
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
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false)
  const [chatHistory, setChatHistory] = useState<StoredChatSession[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false)
  const [persistentError, setPersistentError] = useState<string | null>(null)
  const [encryptionPassword, setEncryptionPassword] = useState<string | null>(
    null
  )
  const [needsPassword, setNeedsPassword] = useState(false)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false)
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null)

  const persistErrorForCurrentChat = useCallback(
    (
      message: string | null,
      { updateTimestamp = true }: { updateTimestamp?: boolean } = {}
    ) => {
      if (!currentChatId) {
        return
      }

      setChatHistory((previousHistory) => {
        const index = previousHistory.findIndex(
          (session) => session.id === currentChatId
        )

        if (index === -1) {
          return previousHistory
        }

        const currentSession = previousHistory[index]
        if (!currentSession) {
          return previousHistory
        }

        if (currentSession.lastError === message && !updateTimestamp) {
          return previousHistory
        }

        const nextHistory = [...previousHistory]
        nextHistory[index] = {
          ...currentSession,
          lastError: message,
          updatedAt: updateTimestamp
            ? new Date().toISOString()
            : currentSession.updatedAt
        }

        return sortSessions(nextHistory)
      })
    },
    [currentChatId]
  )

  const registerErrorForCurrentChat = useCallback(
    (message: string) => {
      setPersistentError(message)
      persistErrorForCurrentChat(message)
    },
    [persistErrorForCurrentChat]
  )

  const clearErrorForCurrentChat = useCallback(
    ({ updateTimestamp = false }: { updateTimestamp?: boolean } = {}) => {
      setPersistentError(null)
      persistErrorForCurrentChat(null, { updateTimestamp })
    },
    [persistErrorForCurrentChat]
  )

  const createSessionObject = useCallback((): StoredChatSession => {
    const now = new Date().toISOString()
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`

    return {
      id,
      createdAt: now,
      updatedAt: now,
      messages: [],
      lastError: null
    }
  }, [])

  useEffect(() => {
    if (!localConfigLoaded) {
      const loadStoredData = async () => {
        const hasStoredKeys = sessionStorage.getItem('apiKeys') !== null
        const hasStoredModel = sessionStorage.getItem('model') !== null

        if (hasStoredKeys && !encryptionPassword) {
          setNeedsPassword(true)
          setIsFirstTimeSetup(false)
          return
        }

        if (hasStoredKeys && encryptionPassword) {
          if (!rateLimiter.check()) {
            setRateLimitWarning(
              'Rate limit excedido. Tente novamente em alguns instantes.'
            )
            return
          }

          try {
            const _encryptedKeys = sessionStorage.getItem('apiKeys')
            if (_encryptedKeys) {
              const decryptedKeys = await decrypt(
                _encryptedKeys,
                encryptionPassword
              )
              setApiKeys(JSON.parse(decryptedKeys))
            }
          } catch (error) {
            console.error('Erro ao descriptografar API keys:', error)
            setNeedsPassword(true)
            setIsFirstTimeSetup(false)
            return
          }
        }

        if (hasStoredModel) {
          const _selectedModel = sessionStorage.getItem('model')
          if (_selectedModel) {
            setSelectedModel(JSON.parse(_selectedModel))
          }
        } else {
          setSelectedModel({ provider: 'openai', model: 'gpt-4o-mini' })
        }

        setLocalConfigLoaded(true)
      }

      loadStoredData()
    } else if (encryptionPassword) {
      const saveStoredData = async () => {
        if (!rateLimiter.check()) {
          setRateLimitWarning(
            'Rate limit excedido. Tente novamente em alguns instantes.'
          )
          return
        }

        try {
          if (apiKeys.openAIKey || apiKeys.geminiKey) {
            const encryptedKeys = await encrypt(
              JSON.stringify(apiKeys),
              encryptionPassword
            )
            sessionStorage.setItem('apiKeys', encryptedKeys)
          }
          sessionStorage.setItem('model', JSON.stringify(selectedModel))
        } catch (error) {
          console.error('Erro ao criptografar API keys:', error)
        }
      }

      saveStoredData()
    }
  }, [apiKeys, selectedModel, localConfigLoaded, encryptionPassword])

  const hasApiKey = apiKeys.openAIKey !== '' || apiKeys.geminiKey !== ''
  const apiKey =
    selectedModel?.provider === 'openai' ? apiKeys.openAIKey : apiKeys.geminiKey

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    reload,
    status,
    stop,
    setMessages
  } = useChat({
    api: '/api/chat',
    body: { apiKey, model: selectedModel },
    onError: (err) => {
      const message = err?.message ?? 'Erro desconhecido'
      registerErrorForCurrentChat(message)
    },
    onFinish: () => {
      clearErrorForCurrentChat()
    }
  })

  useEffect(() => {
    if (chatHistoryLoaded) {
      return
    }

    const storedHistory = sessionStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
    const storedCurrentId = sessionStorage.getItem(CURRENT_CHAT_ID_STORAGE_KEY)

    let parsedHistory: StoredChatSession[] = []

    if (storedHistory) {
      try {
        const rawHistory = JSON.parse(storedHistory) as StoredChatSession[]
        if (Array.isArray(rawHistory)) {
          parsedHistory = rawHistory
            .filter(
              (session): session is StoredChatSession =>
                typeof session?.id === 'string'
            )
            .map((session) => {
              const historyEntry = session as unknown as {
                lastError?: unknown
              }

              return {
                ...session,
                messages: Array.isArray(session.messages)
                  ? session.messages
                  : [],
                lastError:
                  typeof historyEntry.lastError === 'string'
                    ? historyEntry.lastError
                    : null
              }
            })
        }
      } catch (error) {
        console.error('Erro ao carregar histórico do chat', error)
      }
    }

    let initialHistory =
      parsedHistory.length > 0 ? sortSessions(parsedHistory) : []

    if (initialHistory.length === 0) {
      initialHistory = [createSessionObject()]
    }

    const initialCurrentId =
      storedCurrentId &&
      initialHistory.some((session) => session.id === storedCurrentId)
        ? storedCurrentId
        : (initialHistory[0]?.id ?? '')

    const initialSession = initialHistory.find(
      (session) => session.id === initialCurrentId
    )

    const initialMessages = initialSession?.messages ?? []

    setChatHistory(initialHistory)
    setCurrentChatId(initialCurrentId)
    setMessages(initialMessages)
    setPersistentError(initialSession?.lastError ?? null)
    setChatHistoryLoaded(true)
  }, [chatHistoryLoaded, createSessionObject, setMessages])

  useEffect(() => {
    if (!chatHistoryLoaded) {
      return
    }

    sessionStorage.setItem(
      CHAT_HISTORY_STORAGE_KEY,
      JSON.stringify(chatHistory)
    )
  }, [chatHistory, chatHistoryLoaded])

  useEffect(() => {
    if (!chatHistoryLoaded) {
      return
    }

    if (currentChatId) {
      sessionStorage.setItem(CURRENT_CHAT_ID_STORAGE_KEY, currentChatId)
    } else {
      sessionStorage.removeItem(CURRENT_CHAT_ID_STORAGE_KEY)
    }
  }, [currentChatId, chatHistoryLoaded])

  useEffect(() => {
    if (!chatHistoryLoaded || !currentChatId) {
      return
    }

    setChatHistory((previousHistory) => {
      const index = previousHistory.findIndex(
        (session) => session.id === currentChatId
      )

      if (index === -1) {
        return previousHistory
      }

      const currentSession = previousHistory[index]
      if (!currentSession || messagesEqual(currentSession.messages, messages)) {
        return previousHistory
      }

      const nextHistory = [...previousHistory]
      nextHistory[index] = {
        ...currentSession,
        messages,
        updatedAt: new Date().toISOString(),
        id: currentSession.id,
        createdAt: currentSession.createdAt,
        lastError: currentSession.lastError
      }

      return nextHistory
    })
  }, [messages, chatHistoryLoaded, currentChatId])

  useEffect(() => {
    if (status === 'ready') {
      const lastMessage = messages.at(-1)
      if (lastMessage?.role === 'assistant' && lastMessage?.content === '') {
        setMessages(messages.slice(0, -1))
      }
    }
  }, [status, messages])

  const historyEntries = useMemo<ChatHistoryEntry[]>(() => {
    return chatHistory.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length
    }))
  }, [chatHistory])

  const currentSession = useMemo(() => {
    if (!currentChatId) {
      return undefined
    }
    return chatHistory.find((session) => session.id === currentChatId)
  }, [chatHistory, currentChatId])

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setIsHistorySheetOpen(false)
      if (chatId === currentChatId) {
        return
      }

      const session = chatHistory.find((item) => item.id === chatId)
      if (!session) {
        return
      }

      stop()
      setCurrentChatId(chatId)
      setMessages(session.messages)
      setPersistentError(session.lastError ?? null)
    },
    [chatHistory, currentChatId, setMessages, stop, setPersistentError]
  )

  const handleCreateNewChat = useCallback(() => {
    stop()
    const newSession = createSessionObject()
    setChatHistory((prev) => sortSessions([...prev, newSession]))
    setCurrentChatId(newSession.id)
    setMessages([])
    setPersistentError(null)
    setIsHistorySheetOpen(false)
  }, [createSessionObject, setMessages, stop, setPersistentError])

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      stop()
      let nextState: {
        chatId: string
        messages: Message[]
        lastError: string | null
      } | null = null

      setChatHistory((prev) => {
        const filtered = prev.filter((session) => session.id !== chatId)
        if (filtered.length === prev.length) {
          return prev
        }

        if (filtered.length === 0) {
          const fallbackSession = createSessionObject()
          nextState = {
            chatId: fallbackSession.id,
            messages: [],
            lastError: fallbackSession.lastError
          }
          return [fallbackSession]
        }

        const sorted = sortSessions(filtered)
        if (chatId === currentChatId) {
          const nextSession = sorted[0]
          if (nextSession) {
            nextState = {
              chatId: nextSession.id,
              messages: nextSession.messages,
              lastError: nextSession.lastError ?? null
            }
          }
        }

        return sorted
      })

      if (nextState !== null) {
        const state = nextState as {
          chatId: string
          messages: Message[]
          lastError: string | null
        }
        setCurrentChatId(state.chatId)
        setMessages(state.messages)
        setPersistentError(state.lastError ?? null)
      } else {
        // Fallback: create a new session if no valid next state
        const newSession = createSessionObject()
        setCurrentChatId(newSession.id)
        setMessages([])
        setPersistentError(null)
      }
    },
    [createSessionObject, currentChatId, setMessages, stop, setPersistentError]
  )

  const handleClearChat = useCallback(() => {
    if (!currentChatId) {
      setMessages([])
      setPersistentError(null)
      return
    }

    stop()
    clearErrorForCurrentChat({ updateTimestamp: false })
    setMessages([])
    setChatHistory((prev) => {
      const index = prev.findIndex((session) => session.id === currentChatId)
      if (index === -1) {
        return prev
      }

      const currentSession = prev[index]
      if (!currentSession) {
        return prev
      }

      const updated = [...prev]
      updated[index] = {
        ...currentSession,
        messages: [],
        updatedAt: new Date().toISOString(),
        id: currentSession.id,
        createdAt: currentSession.createdAt,
        lastError: null
      }

      return sortSessions(updated)
    })
  }, [clearErrorForCurrentChat, currentChatId, setMessages, stop])

  const canClearCurrentChat = (currentSession?.messages?.length ?? 0) > 0
  const hasActiveError = persistentError !== null
  const displayedErrorMessage = persistentError ?? ''

  const handleRetry = useCallback(() => {
    clearErrorForCurrentChat()

    void reload()
  }, [clearErrorForCurrentChat, reload])

  const isMac =
    typeof window !== 'undefined' &&
    (window.navigator?.userAgent?.includes('Mac') ||
      window.navigator?.userAgent?.includes('iPad'))

  const handlePasswordSet = useCallback((password: string) => {
    setEncryptionPassword(password)
    setNeedsPassword(false)
    setLocalConfigLoaded(false)
    rateLimiter.reset()
  }, [])

  const handleConfigureKeys = useCallback(() => {
    if (!encryptionPassword) {
      setIsFirstTimeSetup(true)
      setNeedsPassword(true)
    } else {
      setIsConfiguring(true)
    }
  }, [encryptionPassword])

  useEffect(() => {
    if (apiKeys.openAIKey || apiKeys.geminiKey) {
      if (!encryptionPassword) {
        setIsFirstTimeSetup(true)
        setNeedsPassword(true)
      }
    }
  }, [apiKeys, encryptionPassword])

  useEffect(() => {
    if (rateLimitWarning) {
      const timer = setTimeout(() => {
        setRateLimitWarning(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [rateLimitWarning])

  return (
    <div className="mx-auto flex h-screen w-full max-w-screen-lg flex-col gap-4 px-4 py-4 sm:px-6">
      <EncryptionPasswordDialog
        open={needsPassword}
        onPasswordSet={handlePasswordSet}
        isFirstTime={isFirstTimeSetup}
      />
      {rateLimitWarning && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-red-100 p-4 text-sm text-red-800">
          {rateLimitWarning}
        </div>
      )}
      <div className="flex h-full flex-1 gap-4">
        <aside className="hidden shrink-0 md:flex">
          <ChatHistoryList
            chats={historyEntries}
            activeChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onCreateChat={handleCreateNewChat}
            className="w-64 min-w-64"
          />
        </aside>
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:hidden">
              <Sheet
                open={isHistorySheetOpen}
                onOpenChange={setIsHistorySheetOpen}
              >
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <HistoryIcon className="mr-2 h-4 w-4" aria-hidden />
                    Histórico
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 max-w-full p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Histórico de conversas</SheetTitle>
                  </SheetHeader>
                  <ChatHistoryList
                    chats={historyEntries}
                    activeChatId={currentChatId}
                    onSelectChat={handleSelectChat}
                    onDeleteChat={handleDeleteChat}
                    onCreateChat={handleCreateNewChat}
                    className="h-full w-full min-w-0 rounded-none border-0 shadow-none"
                  />
                </SheetContent>
              </Sheet>
              <Button type="button" size="sm" onClick={handleCreateNewChat}>
                <MessageSquarePlusIcon className="mr-2 h-4 w-4" aria-hidden />
                Nova
              </Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AlertDialog
                open={isClearDialogOpen}
                onOpenChange={setIsClearDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={!canClearCurrentChat}
                    aria-label="Limpar conversa atual"
                    title="Limpar conversa atual"
                  >
                    <Trash2Icon className="h-4 w-4" aria-hidden />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Limpar a conversa atual?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove todas as mensagens desta conversa. O
                      histórico permanece salvo somente no seu navegador.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        handleClearChat()
                        setIsClearDialogOpen(false)
                      }}
                    >
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                type="button"
                size="icon"
                variant={isConfiguring || !hasApiKey ? 'default' : 'ghost'}
                disabled={!localConfigLoaded || !hasApiKey}
                onClick={() => {
                  if (hasApiKey) {
                    handleConfigureKeys()
                  }
                }}
                aria-label="Configurações do chat"
                title="Configurações do chat"
              >
                <CogIcon className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex flex-1 flex-col-reverse overflow-y-auto">
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
                          {toolInvocationParts.map((part, partIndex) => (
                            <ToolCall
                              key={partIndex}
                              toolCall={part.toolInvocation}
                            />
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
                      {message.parts.map((part, partIndex) => {
                        if (part.type === 'text') {
                          return (
                            <div
                              key={partIndex}
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

            {hasActiveError && (
              <div className="flex items-center gap-2">
                <div>
                  Ocorreu um erro
                  {displayedErrorMessage ? `: ${displayedErrorMessage}` : '.'}
                </div>
                <Button type="button" onClick={handleRetry} variant="outline">
                  Tentar novamente
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <div className="flex w-full flex-col gap-3">
                {localConfigLoaded && (
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
                )}
                {localConfigLoaded && (isConfiguring || !hasApiKey) ? (
                  <ConfigForm
                    initialKeys={apiKeys}
                    onSetKeys={(keys) => {
                      setApiKeys(keys)
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
                    disabled={hasActiveError || status === 'streaming'}
                    className="field-sizing-content min-h-24 border-slate-400"
                  />
                )}
              </div>
              {!isConfiguring && apiKey && (
                <div className="flex flex-col justify-end gap-2">
                  {status === 'streaming' && (
                    <Button
                      type="button"
                      onClick={() => stop()}
                      variant="outline"
                    >
                      Stop
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      !input ||
                      hasActiveError ||
                      status === 'streaming' ||
                      status === 'submitted'
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span>{isMac ? <CommandIcon /> : 'Ctrl'}</span>
                      <CornerDownRightIcon className="-rotate-90" />
                    </div>
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
