'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/session'
import { updateUserRole, updateUserStatus, countAdmins } from '@/lib/portal/staff'
import { inviteStaff } from '@/lib/portal/invite'
import { isSmtpConfigured } from '@/lib/email/sendEmail'
import type { UserRole, UserStatus } from '@/types/database'

const STAFF_ROLES: UserRole[] = ['admin', 'crm_staff', 'chat_only']

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

/** ユーザーのロールを変更する。最後の管理者を降格させない安全弁つき。 */
export async function updateRoleAction(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  const role = str(formData.get('role')) as UserRole | null
  if (!id || !role || !STAFF_ROLES.includes(role)) redirect('/admin/permissions?error=invalid')

  // 自分自身を管理者から降格しようとした場合、または最後の管理者を降格しようとした場合は拒否
  if (role !== 'admin') {
    const admins = await countAdmins()
    if (admins <= 1) {
      redirect('/admin/permissions?error=last_admin')
    }
  }

  await updateUserRole(id!, role!)
  revalidatePath('/admin/permissions')
  redirect('/admin/permissions?saved=role')
}

/** ユーザーの利用状態 (有効/停止) を切り替える。自分自身は停止できない。 */
export async function updateStatusAction(formData: FormData) {
  const me = await requireAdmin()
  const id = str(formData.get('id'))
  const status = str(formData.get('status')) as UserStatus | null
  if (!id || (status !== 'active' && status !== 'suspended')) redirect('/admin/permissions?error=invalid')
  if (id === me.userId) redirect('/admin/permissions?error=self_suspend')

  await updateUserStatus(id!, status!)
  revalidatePath('/admin/permissions')
  redirect('/admin/permissions?saved=status')
}

/** 本部スタッフを招待する (ロール指定)。 */
export async function inviteStaffAction(formData: FormData) {
  await requireAdmin()
  const email = str(formData.get('email'))
  const name = str(formData.get('name'))
  const role = str(formData.get('role')) as UserRole | null
  if (!email) redirect('/admin/permissions?error=email_required')
  if (!role || !STAFF_ROLES.includes(role)) redirect('/admin/permissions?error=invalid')
  if (!isSmtpConfigured()) redirect('/admin/permissions?error=smtp')

  try {
    await inviteStaff(email!, name, role!)
  } catch (e) {
    redirect(`/admin/permissions?error=invite&msg=${encodeURIComponent(e instanceof Error ? e.message : 'failed')}`)
  }
  revalidatePath('/admin/permissions')
  redirect('/admin/permissions?saved=invited')
}
