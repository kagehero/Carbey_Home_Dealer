'use server'

import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { setAutoSetting, requestReservation, moveReservation, cancelReservation, markReservationAssigned } from '@/lib/portal/auto-trading'

function num(v: FormDataEntryValue | null): number {
  return Number(String(v ?? '').replace(/[^\d]/g, ''))
}

/** 全体設定（同時運用上限・最低預かり金）を更新する（本部）。 */
export async function updateAutoSettingsAction(formData: FormData) {
  await requireFeature('reports')
  const cap = num(formData.get('auto_capacity_total'))
  const minDep = num(formData.get('auto_min_deposit'))
  if (cap > 0) await setAutoSetting('auto_capacity_total', cap)
  if (minDep >= 0) await setAutoSetting('auto_min_deposit', minDep)
  revalidatePath('/admin/auto-capacity')
}

/** 本部が加盟者を受注待ちに追加する。 */
export async function addReservationAction(formData: FormData) {
  await requireFeature('reports')
  const memberId = String(formData.get('member_id') ?? '')
  if (!memberId) return
  await requestReservation(memberId, String(formData.get('note') ?? '').trim() || null)
  revalidatePath('/admin/auto-capacity')
}

/** 予約の順番を上/下へ入れ替える（本部の手動並替）。 */
export async function moveReservationAction(formData: FormData) {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  const dir = String(formData.get('direction') ?? '') as 'up' | 'down'
  if (!id || (dir !== 'up' && dir !== 'down')) return
  await moveReservation(id, dir)
  revalidatePath('/admin/auto-capacity')
}

/** 予約を取消（本部）。 */
export async function cancelReservationAction(formData: FormData) {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await cancelReservation(id)
  revalidatePath('/admin/auto-capacity')
}

/** 予約を割当済みにする（本部が起票へ進めたとき）。 */
export async function assignReservationAction(formData: FormData) {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await markReservationAssigned(id)
  revalidatePath('/admin/auto-capacity')
}
