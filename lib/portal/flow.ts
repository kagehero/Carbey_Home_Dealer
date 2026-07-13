import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { FlowType, PlanRow } from '@/types/database'

/**
 * 加盟店の実行フローに関するロジック（レビュー⑳）。
 * プランの保有モデル（has_semi / has_auto）と members.active_flow から、
 * 実際に表示・実行すべきフロー種別を決める。
 */

type PlanModels = Pick<PlanRow, 'has_semi' | 'has_auto'>

/** プランが両モデル保有か（＝加盟店がフローを切り替えられるか）。 */
export function canSwitchFlow(plan: PlanModels | null | undefined): boolean {
  return !!plan?.has_semi && !!plan?.has_auto
}

/**
 * 実効フローを決定する。
 *   - active_flow が設定済みで、プランがそのモデルを保有していればそれを採用
 *   - 未設定/保有外なら既定を導出：
 *       両方保有 → 'auto'（既定）／auto のみ → 'auto'／semi のみ → 'semi'
 *   - プラン未割当 → 'semi'（安全側。半自動で開始）
 */
export function resolveFlow(plan: PlanModels | null | undefined, activeFlow: FlowType | null | undefined): FlowType {
  const hasSemi = !!plan?.has_semi
  const hasAuto = !!plan?.has_auto

  // 明示設定が保有モデルと整合していれば尊重
  if (activeFlow === 'auto' && hasAuto) return 'auto'
  if (activeFlow === 'semi' && hasSemi) return 'semi'

  // 既定導出
  if (hasAuto) return 'auto'
  if (hasSemi) return 'semi'
  return 'semi'
}

/** 加盟店がそのフローを選べるか（保有モデルの範囲内か）。 */
export function isFlowAllowed(plan: PlanModels | null | undefined, flow: FlowType): boolean {
  if (flow === 'auto') return !!plan?.has_auto
  if (flow === 'semi') return !!plan?.has_semi
  return false
}

const MANUAL_TITLE: Record<FlowType, string> = {
  semi: '実践マニュアル（半自動売買）の修了',
  auto: '実践マニュアル（自動売買）の修了',
}

/** user_id から自分の会員・プラン・実効フローを取得。 */
export async function getOwnFlow(userId: string): Promise<
  { memberId: string; plan: PlanModels | null; activeFlow: FlowType | null; flow: FlowType; canSwitch: boolean } | null
> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id, active_flow, plan:plans(has_semi, has_auto)')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; active_flow: FlowType | null; plan: PlanModels | null }>()
  if (!member) return null
  return {
    memberId: member.id,
    plan: member.plan,
    activeFlow: member.active_flow,
    flow: resolveFlow(member.plan, member.active_flow),
    canSwitch: canSwitchFlow(member.plan),
  }
}

/**
 * 加盟店が実行フローを切り替える（両モデル保有のみ）。
 * active_flow を更新し、マニュアルタスク（link_key='manual'）のタイトルを新フローに差し替える。
 * 他タスク・進捗は維持（sync がマニュアル判定を新フロー基準に自動更新）。
 */
export async function switchOwnFlow(userId: string, flow: FlowType): Promise<void> {
  const supabase = createServiceRoleClient()
  const own = await getOwnFlow(userId)
  if (!own) throw new Error('会員情報が紐付いていません')
  if (!own.canSwitch) throw new Error('このプランではフローを切り替えできません')
  if (!isFlowAllowed(own.plan, flow)) throw new Error('選択したフローはご契約のプランに含まれていません')

  // active_flow 更新
  const { error: mErr } = await supabase.from('members').update({ active_flow: flow } as never).eq('id', own.memberId)
  if (mErr) throw new Error(mErr.message)

  // マニュアルタスクのタイトルを差し替え（存在すれば）
  const { error: tErr } = await supabase
    .from('onboarding_tasks')
    .update({ title: MANUAL_TITLE[flow] } as never)
    .eq('member_id', own.memberId)
    .eq('link_key', 'manual')
  if (tErr) throw new Error(tErr.message)

  // 実体に合わせて再同期（新フローのマニュアル判定に更新）
  await supabase.rpc('sync_onboarding_status', { p_member_id: own.memberId } as never)
}
