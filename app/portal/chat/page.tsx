import { requireMember } from '@/lib/auth/session'
import { getOwnConversation, listMessages, markRead } from '@/lib/portal/chat'
import ChatThread from '@/components/chat/ChatThread'

export const dynamic = 'force-dynamic'

export default async function MemberChatPage() {
  const session = await requireMember()
  const own = await getOwnConversation(session.userId)

  if (!own) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        会員情報が紐付いていません。本部にお問い合わせください。
      </div>
    )
  }

  const messages = await listMessages(own.conversationId)
  await markRead(own.conversationId, false)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">チャット</h1>
        <p className="text-sm text-slate-500">本部サポートとやり取りできます。</p>
      </div>
      <ChatThread
        conversationId={own.conversationId}
        initialMessages={messages}
        currentUserId={session.userId}
        isStaffViewer={false}
      />
    </div>
  )
}
