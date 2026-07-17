import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, Loader2, Info } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getMember } from '@/lib/portal/members'
import { listOnboardingTasks, buildOnboardingView, ensureOnboardingTasks, syncOnboardingStatus } from '@/lib/portal/onboarding'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { setTaskStatusAction, seedTasksAction, clearTaskOverrideAction } from '../actions'

export const dynamic = 'force-dynamic'

const STATUS_BADGE = {
  done: 'bg-emerald-50 text-emerald-700',
  current: 'bg-brand-50 text-brand-700',
  todo: 'bg-slate-100 text-slate-500',
} as const

export default async function AdminOnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature('members')
  const { id } = await params
  const member = await getMember(id)
  if (!member) notFound()

  // タスクが無ければ生成（初回・保険）→ 実体（本人確認/資金/規約/マニュアル）と同期
  await ensureOnboardingTasks(id)
  await syncOnboardingStatus(id)
  const tasks = await listOnboardingTasks(id)
  const view = buildOnboardingView(tasks)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/onboarding" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> オンボーディング一覧へ
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{member.company_name ?? member.member_name}</h1>
          <p className="text-sm text-slate-500">スタートアップ進捗の監視</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{view.pct}%</div>
          <div className="text-xs text-slate-500">{view.doneTasks}/{view.totalTasks} タスク完了</div>
        </div>
      </div>

      {/* 自動化の説明バナー（完全自動化・レビュー⑯） */}
      <div className="flex items-start gap-2 rounded-xl border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-600" />
        <div>
          <p className="font-semibold">進捗はほぼ自動で進みます</p>
          <p className="mt-0.5 text-[13px] leading-relaxed">
            契約日の登録・加盟店の手続き（本人確認提出／資金／規約／マニュアル）に応じてタスクは自動で完了します。
            本部の手動操作が必要なのは<span className="font-semibold">本人確認書類の承認</span>のみです（下記「対応画面へ」から）。
            なお、動作確認や例外対応が必要な場合は<span className="font-semibold">自動判定のタスクも本部が強制的に切り替えられます</span>
            （上書き中は自動判定が止まります。「自動判定に戻す」で元の自動運用へ戻せます）。
          </p>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${view.pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${view.pct}%` }} />
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardBody className="flex items-center justify-between">
            <p className="text-sm text-slate-500">タスクがまだ生成されていません。</p>
            <form action={seedTasksAction}>
              <input type="hidden" name="member_id" value={id} />
              <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">既定タスクを生成</button>
            </form>
          </CardBody>
        </Card>
      ) : (
        view.steps.map((step) => (
          <Card key={step.key}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {step.label}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[step.status]}`}>
                    {step.status === 'done' ? '完了' : step.status === 'current' ? '進行中' : '未着手'}
                  </span>
                </span>
              }
              action={<span className="text-xs text-slate-400">{step.done}/{step.total}</span>}
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-100">
                {step.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3">
                    <span className={`flex items-center gap-2 text-sm ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                      {t.status === 'done'
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : t.status === 'in_progress'
                          ? <Loader2 className="h-4 w-4 text-brand-500" />
                          : <Circle className="h-4 w-4 text-slate-300" />}
                      {t.title}
                      {t.optional && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">任意</span>}
                    </span>
                    {/* ⑪-① 自動判定タスクも本部が強制的に切り替えられる（上書き＝sync対象外）。
                           上書き中は「自動判定に戻す」で実体に再同期できる。 */}
                    <div className="flex items-center gap-2">
                      {t.link_key && (
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Link href={`/admin/members/${id}`} className="text-brand-600 hover:underline">対応画面へ</Link>
                          {t.admin_override ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">上書き中</span>
                          ) : (
                            <span>・自動判定</span>
                          )}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        {(['todo', 'in_progress', 'done'] as const).map((s) => (
                          <form key={s} action={setTaskStatusAction}>
                            <input type="hidden" name="task_id" value={t.id} />
                            <input type="hidden" name="member_id" value={id} />
                            <input type="hidden" name="status" value={s} />
                            <button
                              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                                t.status === s
                                  ? s === 'done' ? 'bg-emerald-500 text-white' : s === 'in_progress' ? 'bg-brand-500 text-white' : 'bg-slate-600 text-white'
                                  : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                              title={t.link_key ? '自動判定を上書きします（テスト・例外運用）' : undefined}
                            >
                              {s === 'todo' ? '未着手' : s === 'in_progress' ? '進行中' : '完了'}
                            </button>
                          </form>
                        ))}
                        {t.link_key && t.admin_override && (
                          <form action={clearTaskOverrideAction}>
                            <input type="hidden" name="task_id" value={t.id} />
                            <input type="hidden" name="member_id" value={id} />
                            <button className="ml-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50" title="上書きを解除し、実体（提出・同意の状況）に合わせて再判定します">
                              自動判定に戻す
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  )
}
