'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import {
  MessageSquareIcon,
  MessageSquarePlusIcon,
  Trash2Icon
} from 'lucide-react'

export type ChatHistoryEntry = {
  id: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

type ChatHistoryListProps = {
  chats: ChatHistoryEntry[]
  activeChatId: string | null
  onSelectChat: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
  onCreateChat: () => void
  className?: string
}

function formatDate(dateIso: string) {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) {
    return 'Data desconhecida'
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

type ChatHistoryRowProps = {
  chat: ChatHistoryEntry
  active: boolean
  onSelect: (chatId: string) => void
  onDelete: (chatId: string) => void
}

function ChatHistoryRow({
  chat,
  active,
  onSelect,
  onDelete
}: ChatHistoryRowProps) {
  const messageLabel = useMemo(() => {
    const suffix = chat.messageCount === 1 ? 'mensagem' : 'mensagens'
    return `${chat.messageCount} ${suffix}`
  }, [chat.messageCount])

  const showDeleteAction = !(active && chat.messageCount === 0)

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
        active
          ? 'border-slate-300 bg-slate-100'
          : 'hover:border-slate-200 hover:bg-slate-50'
      )}
    >
      <button
        type="button"
        className="flex-1 text-left"
        onClick={() => onSelect(chat.id)}
      >
        <div className="flex items-center gap-2 font-medium text-slate-900">
          <MessageSquareIcon className="h-4 w-4" aria-hidden />
          <span>{formatDate(chat.updatedAt || chat.createdAt)}</span>
        </div>
        <span className="text-xs text-slate-500">{messageLabel}</span>
      </button>
      {showDeleteAction && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <Trash2Icon className="h-4 w-4" aria-hidden />
              <span className="sr-only">Excluir conversa</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Limpar a conversa selecionada?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove todas as mensagens desta conversa. O histórico
                permanece salvo somente no seu navegador.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(chat.id)
                }}
              >
                Limpar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export default function ChatHistoryList({
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onCreateChat,
  className
}: ChatHistoryListProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Conversas
        </span>
        <Button type="button" size="sm" onClick={onCreateChat}>
          <MessageSquarePlusIcon className="mr-2 h-4 w-4" aria-hidden />
          Nova
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            Nenhuma conversa ainda.
          </div>
        ) : (
          chats.map((chat) => (
            <ChatHistoryRow
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              onSelect={onSelectChat}
              onDelete={onDeleteChat}
            />
          ))
        )}
      </div>
    </div>
  )
}
