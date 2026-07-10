import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { ManualSectionRow } from '@/types/database'

export type ManualSectionWithCheck = ManualSectionRow & { checked: boolean }

/** 公開中の実践マニュアル項目（並び順）。 */
export async function listPublishedSections(): Promise<ManualSectionRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('manual_sections')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ManualSectionRow[]
}

/** 全項目（本部CMS用・非公開含む）。 */
export async function listAllSections(): Promise<ManualSectionRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('manual_sections').select('*').order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ManualSectionRow[]
}

/** 加盟店向け：公開項目にチェック状況を付与。 */
export async function getMemberManual(userId: string): Promise<{ sections: ManualSectionWithCheck[]; total: number; done: number } | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return null

  const sections = await listPublishedSections()
  const { data: prog } = await supabase.from('manual_progress').select('section_id').eq('member_id', member.id)
  const checkedIds = new Set((prog ?? []).map((p: { section_id: string }) => p.section_id))

  const withCheck = sections.map((s) => ({ ...s, checked: checkedIds.has(s.id) }))
  return { sections: withCheck, total: withCheck.length, done: withCheck.filter((s) => s.checked).length }
}

/** 加盟店：項目をチェック/解除。 */
export async function toggleSectionCheck(userId: string, sectionId: string, checked: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) throw new Error('会員情報が紐付いていません')

  if (checked) {
    const { error } = await supabase
      .from('manual_progress')
      .upsert({ member_id: member.id, section_id: sectionId } as never, { onConflict: 'member_id,section_id' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('manual_progress').delete().eq('member_id', member.id).eq('section_id', sectionId)
    if (error) throw new Error(error.message)
  }
}

/** 本部：項目を保存（新規/更新）。 */
export async function saveSection(input: {
  id?: string
  title: string
  body: string | null
  note: string | null
  published: boolean
}): Promise<void> {
  const supabase = createServiceRoleClient()
  if (input.id) {
    const { error } = await supabase
      .from('manual_sections')
      .update({ title: input.title, body: input.body, note: input.note, published: input.published } as never)
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  } else {
    const { data: last } = await supabase.from('manual_sections').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>()
    const sort = (last?.sort_order ?? 0) + 10
    const { error } = await supabase
      .from('manual_sections')
      .insert({ title: input.title, body: input.body, note: input.note, published: input.published, sort_order: sort } as never)
    if (error) throw new Error(error.message)
  }
}

/** 本部：項目を削除。 */
export async function deleteSection(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('manual_sections').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 本部：並び替え（上下移動）。隣接項目と sort_order を入れ替える。 */
export async function moveSection(id: string, dir: 'up' | 'down'): Promise<void> {
  const supabase = createServiceRoleClient()
  const all = await listAllSections()
  const idx = all.findIndex((s) => s.id === id)
  if (idx < 0) return
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return
  const a = all[idx]
  const b = all[swapIdx]
  await supabase.from('manual_sections').update({ sort_order: b.sort_order } as never).eq('id', a.id)
  await supabase.from('manual_sections').update({ sort_order: a.sort_order } as never).eq('id', b.id)
}
