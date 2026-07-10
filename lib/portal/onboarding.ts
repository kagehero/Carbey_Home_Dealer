import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { OnboardingTaskRow, OnboardingTaskStatus } from '@/types/database'

/** ステップ表示順（step_key の並び。migration 010 の定義に一致）。 */
const STEP_ORDER = ['contract', 'documents', 'funding', 'training', 'launch']

export type OnboardingStep = {
  key: string
  label: string
  tasks: OnboardingTaskRow[]
  total: number
  done: number
  status: 'done' | 'current' | 'todo'
  /** 前ステップ未完了のためロック中（飛ばせない） */
  locked: boolean
}

export type OnboardingView = {
  steps: OnboardingStep[]
  totalTasks: number
  doneTasks: number
  pct: number
  /** 全ステップ完了＝機能解放 */
  unlocked: boolean
}

/** 加盟店のオンボーディングタスク一覧（生）。 */
export async function listOnboardingTasks(memberId: string): Promise<OnboardingTaskRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('onboarding_tasks')
    .select('*')
    .eq('member_id', memberId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OnboardingTaskRow[]
}

/** タスクをステップ単位に畳み込んでビューを構築する。 */
export function buildOnboardingView(tasks: OnboardingTaskRow[]): OnboardingView {
  const byStep = new Map<string, OnboardingTaskRow[]>()
  for (const t of tasks) {
    const arr = byStep.get(t.step_key) ?? []
    arr.push(t)
    byStep.set(t.step_key, arr)
  }

  const keys = [...byStep.keys()].sort(
    (a, b) => (STEP_ORDER.indexOf(a) + 1 || 99) - (STEP_ORDER.indexOf(b) + 1 || 99),
  )

  let firstUnfinished = true
  let prevAllDone = true // 直前ステップまでが全完了か（ゲート判定用）
  const steps: OnboardingStep[] = keys.map((key) => {
    const arr = byStep.get(key)!
    const total = arr.length
    const done = arr.filter((t) => t.status === 'done').length
    // ゲート判定は optional（古物商など）を除いた必須タスクのみで行う（飛ばせるが任意）
    const required = arr.filter((t) => !t.optional)
    const stepDone = required.every((t) => t.status === 'done')
    let status: OnboardingStep['status']
    if (stepDone) {
      status = 'done'
    } else if (firstUnfinished) {
      status = 'current'
      firstUnfinished = false
    } else {
      status = 'todo'
    }
    // ロック: 完了しておらず、かつ直前ステップまでが未完了なら「飛ばせない」
    const locked = !stepDone && !prevAllDone
    prevAllDone = prevAllDone && stepDone
    return { key, label: arr[0].step_label, tasks: arr, total, done, status, locked }
  })

  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0
  // 機能解放は「必須タスクが全完了」で判定（optional は解放をブロックしない）
  const requiredTasks = tasks.filter((t) => !t.optional)
  const unlocked = requiredTasks.length > 0 && requiredTasks.every((t) => t.status === 'done')
  return { steps, totalTasks, doneTasks, pct, unlocked }
}

/** 加盟店が auto タスクを自己完了する（ゲート厳守・DB関数側でも順序検証）。 */
export async function completeOwnTask(userId: string, taskId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc('complete_own_task', { p_user_id: userId, p_task_id: taskId } as never)
  if (error) throw new Error(error.message)
}

/**
 * 実体（本人確認/資金/規約/マニュアル）→ タスク状態を同期する。
 * link_key 付きタスクを実体に合わせて done/todo に更新（自動化・飛ばせない）。
 */
export async function syncOnboardingStatus(memberId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc('sync_onboarding_status', { p_member_id: memberId } as never)
  if (error) throw new Error(error.message)
}

/** member.user_id から自分のオンボーディングビューを取得（加盟店側）。 */
export async function getOwnOnboarding(userId: string): Promise<OnboardingView | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()
  if (!member) return null
  // 実体（本人確認/資金/規約/マニュアル）→ タスク状態を先に同期してから読む
  await syncOnboardingStatus(member.id)
  const tasks = await listOnboardingTasks(member.id)
  return buildOnboardingView(tasks)
}

/** タスクの状態を変更する（本部）。done のとき completed_at を打刻。 */
export async function updateTaskStatus(taskId: string, status: OnboardingTaskStatus): Promise<void> {
  const supabase = createServiceRoleClient()
  const patch: Partial<OnboardingTaskRow> = {
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('onboarding_tasks').update(patch as never).eq('id', taskId)
  if (error) throw new Error(error.message)
}

/** 加盟店に既定タスクが無ければ生成する（本部画面を開いたときの保険）。 */
export async function ensureOnboardingTasks(memberId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { count } = await supabase
    .from('onboarding_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
  if ((count ?? 0) > 0) return
  // seed 関数（public ラッパー）を RPC で呼ぶ
  await supabase.rpc('seed_onboarding_tasks', { p_member_id: memberId } as never)
}
