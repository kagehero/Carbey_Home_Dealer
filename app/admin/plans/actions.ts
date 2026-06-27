'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/session'
import { createPlan, updatePlan } from '@/lib/portal/plans'
import type { PlanType } from '@/types/database'

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const s = str(v)
  return s == null ? 0 : Number(s)
}
function features(v: FormDataEntryValue | null): string[] {
  const s = str(v)
  if (!s) return []
  return s.split('\n').map((x) => x.trim()).filter(Boolean)
}

export async function createPlanAction(formData: FormData) {
  await requireAdmin()
  const code = str(formData.get('code'))
  const name = str(formData.get('name'))
  if (!code || !name) redirect('/admin/plans/new?error=required')

  await createPlan({
    code,
    name,
    plan_type: (str(formData.get('plan_type')) ?? 'full_auto') as PlanType,
    monthly_fee_yen: num(formData.get('monthly_fee_yen')),
    joining_fee_yen: num(formData.get('joining_fee_yen')),
    display_order: num(formData.get('display_order')),
    description: str(formData.get('description')),
    features: features(formData.get('features')),
    is_active: formData.get('is_active') === 'on',
  })
  revalidatePath('/admin/plans')
  redirect('/admin/plans')
}

export async function updatePlanAction(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/plans')
  await updatePlan(id, {
    name: str(formData.get('name')) ?? undefined,
    plan_type: (str(formData.get('plan_type')) ?? undefined) as PlanType | undefined,
    monthly_fee_yen: num(formData.get('monthly_fee_yen')),
    joining_fee_yen: num(formData.get('joining_fee_yen')),
    display_order: num(formData.get('display_order')),
    description: str(formData.get('description')),
    features: features(formData.get('features')),
    is_active: formData.get('is_active') === 'on',
  })
  revalidatePath('/admin/plans')
  redirect('/admin/plans')
}
