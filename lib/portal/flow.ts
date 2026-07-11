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
