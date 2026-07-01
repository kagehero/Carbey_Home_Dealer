import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { ChatMessageRow, UserRole } from '@/types/database'

export type ConversationSummary = {
  id: string
  member_id: string
  member_name: string
  company_name: string | null
  last_message_at: string | null
  last_body: string | null
  unread: number
}

/** 本部向け：全会話の一覧（加盟店名・最終メッセージ・未読数つき）。 */
export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = createServiceRoleClient()
  const { data: convs, error } = await supabase
    .from('chat_conversations')
    .select('id, member_id, last_message_at, member:members(member_name, company_name)')
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message)

  const rows = (convs ?? []) as unknown as {
    id: string
    member_id: string
    last_message_at: string | null
    member: { member_name: string; company_name: string | null } | null
  }[]

  // 各会話の最終メッセージ本文と、本部宛の未読数を取得
  const result: ConversationSummary[] = []
  for (const c of rows) {
    const { data: last } = await supabase
      .from('chat_messages')
      .select('body')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ body: string }>()
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id)
      .eq('sender_role', 'member')
      .is('read_at', null)
    result.push({
      id: c.id,
      member_id: c.member_id,
      member_name: c.member?.member_name ?? '—',
      company_name: c.member?.company_name ?? null,
      last_message_at: c.last_message_at,
      last_body: last?.body ?? null,
      unread: count ?? 0,
    })
  }
  return result
}

/** 会話を ID で取得（加盟店名つき）。本部スレッド画面用。 */
export async function getConversationById(
  conversationId: string,
): Promise<{ id: string; member_id: string; member_name: string; company_name: string | null } | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, member_id, member:members(member_name, company_name)')
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as unknown as {
    id: string
    member_id: string
    member: { member_name: string; company_name: string | null } | null
  }
  return {
    id: row.id,
    member_id: row.member_id,
    member_name: row.member?.member_name ?? '—',
    company_name: row.member?.company_name ?? null,
  }
}

/** 加盟店の会話 ID を取得 or 作成（member_id 指定）。 */
export async function getOrCreateConversation(memberId: string): Promise<string> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_or_create_conversation', { p_member_id: memberId } as never)
  if (error) throw new Error(error.message)
  return data as unknown as string
}

/** user_id から自分（加盟店）の会話 ID を取得 or 作成。 */
export async function getOwnConversation(userId: string): Promise<{ conversationId: string; memberId: string } | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()
  if (!member) return null
  const conversationId = await getOrCreateConversation(member.id)
  return { conversationId, memberId: member.id }
}

/** 会話のメッセージ一覧（古い順）。 */
export async function listMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ChatMessageRow[]
}

/** メッセージを送信する。 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderRole: UserRole,
  body: string,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, sender_role: senderRole, body } as never)
  if (error) throw new Error(error.message)
}

/** 相手から来た未読メッセージを既読にする。 */
export async function markRead(conversationId: string, viewerIsStaff: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  // 閲覧者がスタッフなら member 発言を、加盟店なら staff/admin 発言を既読化
  const senderRoles = viewerIsStaff ? ['member'] : ['admin', 'crm_staff', 'chat_only']
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() } as never)
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .in('sender_role', senderRoles)
  if (error) throw new Error(error.message)
}
