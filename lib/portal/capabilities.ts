import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveFlow, canSwitchFlow } from '@/lib/portal/flow'
import { computeAntiqueGrace } from '@/lib/portal/trading'
import type { FlowType, PlanRow } from '@/types/database'

/**
 * 加盟店ごとの「利用可能機能」を集約する（レビュー㉕）。
 * 手動の個別権限ではなく、プラン・フロー・オンボーディング完了・古物商猶予から
 * 実効的に何が使えるかを自動判定して可視化する（自動化方針と整合）。
 */

export type MemberCapability = {
  key: string
  label: string
  /** 利用可否 */
  allowed: boolean
  /** 制限中の理由（allowed=false のとき） */
  reason?: string
}

export type MemberCapabilities = {
  planName: string | null
  hasSemi: boolean
  hasAuto: boolean
  flow: FlowType
  canSwitchFlow: boolean
  onboardingDone: boolean
  onboardingPct: number
  tradingAllowed: boolean
  antiqueState: 'ok' | 'warning' | 'expired' | 'approved'
  capabilities: MemberCapability[]
}

type MemberRow = {
  id: string
  contract_date: string | null
  active_flow: FlowType | null
  onboarding_total: number
  onboarding_done: number
  plan: (Pick<PlanRow, 'name' | 'has_semi' | 'has_auto'>) | null
}

/** member.id から利用可能機能を集約。 */
export async function getMemberCapabilities(memberId: string): Promise<MemberCapabilities | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id, contract_date, active_flow, onboarding_total, onboarding_done, plan:plans(name, has_semi, has_auto)')
    .eq('id', memberId)
    .maybeSingle<MemberRow>()
  if (!member) return null

  const plan = member.plan
  const hasSemi = !!plan?.has_semi
  const hasAuto = !!plan?.has_auto
  const flow = resolveFlow(plan, member.active_flow)

  const onboardingPct = member.onboarding_total
    ? Math.round((member.onboarding_done / member.onboarding_total) * 100)
    : 0
  const onboardingDone = member.onboarding_total > 0 && member.onboarding_done >= member.onboarding_total

  // 古物商が承認済みかは evidences を見る（取引ロック判定に必要）
  const { data: antique } = await supabase
    .from('evidences')
    .select('id')
    .eq('member_id', memberId)
    .eq('kind', 'antique_license')
    .eq('status', 'approved')
    .limit(1)
  const grace = computeAntiqueGrace(member.contract_date, (antique?.length ?? 0) > 0)

  // 実効的な利用可能機能（プラン・フロー・完了・猶予から自動判定）
  const capabilities: MemberCapability[] = [
    {
      key: 'flow_semi',
      label: '半自動売買フロー',
      allowed: hasSemi,
      reason: hasSemi ? undefined : 'ご契約プランに含まれていません',
    },
    {
      key: 'flow_auto',
      label: '自動売買フロー',
      allowed: hasAuto,
      reason: hasAuto ? undefined : 'ご契約プランに含まれていません',
    },
    {
      key: 'flow_switch',
      label: '売買フローの切り替え',
      allowed: canSwitchFlow(plan),
      reason: canSwitchFlow(plan) ? undefined : '両モデルを保有するプランのみ',
    },
    {
      key: 'trading',
      label: '仕入れオーダー（取引）',
      allowed: onboardingDone && grace.tradingAllowed,
      reason: !onboardingDone
        ? 'オンボーディング未完了'
        : !grace.tradingAllowed
          ? '古物商許可証の提出期限を超過'
          : undefined,
    },
    {
      key: 'self_manage',
      label: '本人情報・資金管理',
      allowed: true, // 常時利用可
    },
    {
      key: 'ai',
      label: 'AI分析',
      allowed: true, // プラン任意。取引ロック中も継続利用可
    },
  ]

  return {
    planName: plan?.name ?? null,
    hasSemi,
    hasAuto,
    flow,
    canSwitchFlow: canSwitchFlow(plan),
    onboardingDone,
    onboardingPct,
    tradingAllowed: grace.tradingAllowed,
    antiqueState: grace.state,
    capabilities,
  }
}
