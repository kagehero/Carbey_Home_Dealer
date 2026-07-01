'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendChatMessageAction } from '@/app/portal/chat/actions'
import type { ChatMessageRow } from '@/types/database'

/**
 * リアルタイムチャットスレッド。
 * 初期メッセージをサーバーから受け取り、Supabase Realtime で chat_messages の
 * INSERT を購読して追記する。送信はサーバーアクション経由。
 */
export default function ChatThread({
  conversationId,
  initialMessages,
  currentUserId,
  isStaffViewer,
}: {
  conversationId: string
  initialMessages: ChatMessageRow[]
  currentUserId: string
  /** 本部側ビューか（フォームに conversation_id を載せる必要がある） */
  isStaffViewer: boolean
}) {
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Realtime 購読
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function subscribe() {
      // Realtime のRLS評価で auth.uid() を効かせるため、ユーザーの JWT を明示的に渡す。
      // (@supabase/ssr の createBrowserClient は realtime に自動でトークンを流さないため)
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) supabase.realtime.setAuth(token)
      if (cancelled) return

      channel = supabase
        .channel(`chat:${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'portal', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as ChatMessageRow
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          },
        )
        .subscribe((status, err) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[chat realtime]', status, err ?? '')
          }
        })
    }
    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId])

  // 新着で最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (formData: FormData) => {
    setSending(true)
    try {
      await sendChatMessageAction(formData)
      formRef.current?.reset()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-card">
      {/* メッセージ一覧 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-5 scrollbar-slim">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-400">まだメッセージがありません。最初の一通を送ってみましょう。</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                  {new Date(m.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力 */}
      <form ref={formRef} action={handleSubmit} className="flex items-end gap-2 border-t border-slate-200 p-3">
        {isStaffViewer && <input type="hidden" name="conversation_id" value={conversationId} />}
        <textarea
          name="body"
          required
          rows={1}
          placeholder="メッセージを入力..."
          className="max-h-32 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button
          type="submit"
          disabled={sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
          aria-label="送信"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
