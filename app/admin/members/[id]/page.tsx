import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getMember, listPayments } from '@/lib/portal/members'
import { listPlans } from '@/lib/portal/plans'
import { MEMBER_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { Badge } from '@/components/ui/Badge'
import { updateMemberAction, inviteMemberAction } from '../actions'
import MemberFormFields from '../MemberFormFields'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ invite?: string; msg?: string }>
}) {
  await requireFeature('members')
  const { id } = await params
  const sp = await searchParams
  const [member, plans, payments] = await Promise.all([getMember(id), listPlans(false), listPayments(id)])
  if (!member) notFound()

  const onboardingPct = member.onboarding_total
    ? Math.round((member.onboarding_done / member.onboarding_total) * 100)
    : 0

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/members" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        加盟店一覧へ
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-lg font-semibold text-white">
          {member.member_name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{member.member_name}</h1>
            <Badge tone={member.status === 'active' ? 'green' : member.status === 'pending' ? 'amber' : member.status === 'suspended' ? 'red' : 'slate'}>
              {MEMBER_STATUS_LABEL[member.status]}
            </Badge>
          </div>
          {member.company_name && <p className="text-sm text-slate-500">{member.company_name}</p>}
        </div>
      </div>

      {/* 招待結果バナー */}
      {sp.invite === 'sent' && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          招待メールを送信しました。
        </div>
      )}
      {sp.invite === 'smtp_unconfigured' && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          SMTP が未設定のため招待メールを送信できません（環境変数 SMTP_HOST / SMTP_USER / SMTP_PASS）。
        </div>
      )}
      {sp.invite === 'error' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          招待に失敗しました{sp.msg ? `: ${sp.msg}` : ''}
        </div>
      )}

      {/* アカウント招待 */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm">
          {member.user_id ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-slate-700">ログインアカウント連携済み</span>
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">未招待（ログインアカウント未連携）</span>
            </>
          )}
        </div>
        {member.email ? (
          <form action={inviteMemberAction}>
            <input type="hidden" name="id" value={member.id} />
            <button className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
              <Mail className="h-4 w-4" />
              {member.user_id ? '招待メールを再送' : '招待メールを送信'}
            </button>
          </form>
        ) : (
          <span className="text-xs text-slate-400">招待にはメールアドレスが必要です</span>
        )}
      </div>

      {/* サマリ行 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">プラン</div>
          <div className="text-sm font-semibold text-slate-900">{member.plan?.name ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">登録日</div>
          <div className="text-sm font-semibold text-slate-900">{member.registration_date}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">月額</div>
          <div className="text-sm font-semibold text-slate-900">{yen(member.monthly_fee_yen)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">オンボーディング</div>
          <div className="text-sm font-semibold text-slate-900">
            {member.onboarding_done}/{member.onboarding_total}（{onboardingPct}%）
          </div>
        </div>
      </div>

      {/* 編集フォーム */}
      <form action={updateMemberAction}>
        <input type="hidden" name="id" value={member.id} />
        <MemberFormFields plans={plans} member={member} showPaymentStatus />
        <div className="mt-6 flex justify-end">
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            変更を保存
          </button>
        </div>
      </form>

      {/* 入金履歴 */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">入金履歴</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">日付</th>
                <th className="px-4 py-2 font-medium">種別</th>
                <th className="px-4 py-2 font-medium">金額</th>
                <th className="px-4 py-2 font-medium">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    入金履歴はありません。
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-slate-700">{p.payment_date}</td>
                  <td className="px-4 py-2 text-slate-700">{p.kind}</td>
                  <td className="px-4 py-2 text-slate-900">{yen(p.amount_yen)}</td>
                  <td className="px-4 py-2 text-slate-700">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
