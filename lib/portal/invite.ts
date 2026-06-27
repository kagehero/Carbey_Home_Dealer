import { createClient } from '@supabase/supabase-js'
import { getPublicSupabaseConfig, getServiceRoleKey } from '@/lib/env'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { generateInviteLink } from '@/lib/auth/adminLinks'
import { sendEmail } from '@/lib/email/sendEmail'
import { inviteEmail } from '@/lib/email/templates'
import type { MemberRow, UserRole } from '@/types/database'

function authAdmin() {
  const { url } = getPublicSupabaseConfig()
  return createClient(url, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = authAdmin()
  // listUsers は admin 専用。件数が増えたらページング/検索に置き換える。
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  return found?.id ?? null
}

/**
 * 加盟店を招待する。
 *   1. auth.users を作成 (無ければ)
 *   2. portal.users に role='member' で登録
 *   3. members.user_id を紐付け
 *   4. 招待リンクを生成し、自前SMTP で招待メールを送信
 */
export async function inviteMember(member: MemberRow): Promise<void> {
  const email = member.email
  if (!email) throw new Error('会員にメールアドレスが登録されていません')

  const authClient = authAdmin()
  const portal = createServiceRoleClient()

  // 1. auth ユーザー確保
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await authClient.auth.admin.createUser({
      email,
      email_confirm: true, // 招待リンクで本人確認するため確認済み扱い
    })
    if (error) throw new Error(error.message)
    userId = data.user.id
  }

  // 2. portal.users に member ロールで登録
  const { error: uErr } = await portal
    .from('users')
    .upsert({ id: userId, email, name: member.member_name, role: 'member' } as never)
  if (uErr) throw new Error(uErr.message)

  // 3. members.user_id 紐付け
  const { error: mErr } = await portal
    .from('members')
    .update({ user_id: userId } as never)
    .eq('id', member.id)
  if (mErr) throw new Error(mErr.message)

  // 4. 招待リンク生成 + 自前SMTP 送信
  const link = await generateInviteLink(email)
  const { subject, html } = inviteEmail({ name: member.member_name, url: link })
  await sendEmail({ to: email, subject, html })
}

/**
 * 本部スタッフを招待する (管理者 / CRM入力担当 / チャット専用)。
 * 加盟店招待と違い members レコードには紐付けず、portal.users に指定ロールで登録する。
 *   1. auth.users を作成 (無ければ)
 *   2. portal.users に指定 role で upsert
 *   3. 招待リンクを生成し、自前SMTP で招待メールを送信
 */
export async function inviteStaff(email: string, name: string | null, role: UserRole): Promise<void> {
  if (!email) throw new Error('メールアドレスが必要です')
  if (role === 'member') throw new Error('スタッフ招待に加盟店ロールは指定できません')

  const authClient = authAdmin()
  const portal = createServiceRoleClient()

  // 1. auth ユーザー確保
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data, error } = await authClient.auth.admin.createUser({ email, email_confirm: true })
    if (error) throw new Error(error.message)
    userId = data.user.id
  }

  // 2. portal.users に指定ロールで登録
  const { error: uErr } = await portal
    .from('users')
    .upsert({ id: userId, email, name, role } as never)
  if (uErr) throw new Error(uErr.message)

  // 3. 招待リンク生成 + 自前SMTP 送信
  const link = await generateInviteLink(email)
  const { subject, html } = inviteEmail({ name: name ?? email, url: link })
  await sendEmail({ to: email, subject, html })
}
