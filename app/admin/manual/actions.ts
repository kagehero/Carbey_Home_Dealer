'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/auth/session'
import { saveSection, deleteSection, moveSection } from '@/lib/portal/manual'

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** マニュアル項目を保存（新規/更新）。 */
export async function saveSectionAction(formData: FormData) {
  await requireStaff()
  const id = str(formData.get('id')) || undefined
  const title = str(formData.get('title'))
  const body = str(formData.get('body')) || null
  const note = str(formData.get('note')) || null
  const published = formData.get('published') === 'on'
  if (!title) redirect('/admin/manual?error=required')

  await saveSection({ id, title, body, note, published })
  revalidatePath('/admin/manual')
  revalidatePath('/portal/onboarding/manual')
  redirect('/admin/manual?saved=1')
}

/** マニュアル項目を削除。 */
export async function deleteSectionAction(formData: FormData) {
  await requireStaff()
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/manual')
  await deleteSection(id)
  revalidatePath('/admin/manual')
  redirect('/admin/manual')
}

/** マニュアル項目の並び替え。 */
export async function moveSectionAction(formData: FormData) {
  await requireStaff()
  const id = str(formData.get('id'))
  const dir = str(formData.get('dir')) === 'up' ? 'up' : 'down'
  if (!id) redirect('/admin/manual')
  await moveSection(id, dir)
  revalidatePath('/admin/manual')
  revalidatePath('/portal/onboarding/manual')
  redirect('/admin/manual')
}
