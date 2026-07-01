'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { getOwnConversation, getOrCreateConversation, sendMessage, markRead } from '@/lib/portal/chat'
import { isStaff } from '@/lib/auth/session'

/**
 * メッセージ送信（本部・加盟店 共通）。
 * conversation_id があれば本部、無ければ加盟店として自分の会話に送る。
 */
export async function sendChatMessageAction(formData: FormData) {
  const session = await requireSession()
  const body = String(formData.get('body') ?? '').trim()
  const conversationIdInput = String(formData.get('conversation_id') ?? '')
  if (!body) return

  let conversationId = conversationIdInput
  if (!conversationId) {
    // 加盟店：自分の会話を解決
    const own = await getOwnConversation(session.userId)
    if (!own) return
    conversationId = own.conversationId
  } else if (!isStaff(session.role)) {
    // 加盟店が他人の会話IDを指定してくるのを防ぐ：自分の会話に強制
    const own = await getOwnConversation(session.userId)
    if (!own || own.conversationId !== conversationId) return
  }

  await sendMessage(conversationId, session.userId, session.role, body)

  if (isStaff(session.role)) {
    revalidatePath(`/admin/chat/${conversationId}`)
    revalidatePath('/admin/chat')
  } else {
    revalidatePath('/portal/chat')
  }
}

/** 会話を既読にする（相手の発言）。 */
export async function markReadAction(conversationId: string) {
  const session = await requireSession()
  await markRead(conversationId, isStaff(session.role))
}

/** 本部：member_id から会話を取得 or 作成して ID を返す。 */
export async function ensureConversationAction(memberId: string): Promise<string> {
  await requireSession()
  return getOrCreateConversation(memberId)
}
