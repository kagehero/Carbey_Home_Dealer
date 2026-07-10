import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, CheckCircle2, KeyRound } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getMember, listPayments } from '@/lib/portal/members'
import { listPlans } from '@/lib/portal/plans'
import { MEMBER_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { Badge } from '@/components/ui/Badge'
import { updateMemberAction, inviteMemberAction, issueCredentialsAction } from '../actions'
import MemberFormFields from '../MemberFormFields'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ invite?: string; msg?: string; cred?: string; pw?: string }>
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

      {/* 結果バナー */}
      {sp.cred === 'issued' && sp.pw && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <CheckCircle2 className="h-4 w-4" /> ログイン情報を発行しました
          </div>
          <p className="mt-1 text-xs text-green-700">下記の認証情報を加盟店へお伝えください。このパスワードは再表示できません。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-white px-3 py-2">
              <div className="text-[11px] text-slate-500">メールアドレス（ログインID）</div>
              <div className="font-mono text-sm text-slate-900">{member.email}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-white px-3 py-2">
              <div className="text-[11px] text-slate-500">パスワード</div>
              <div className="font-mono text-sm font-semibold text-slate-900">{sp.pw}</div>
            </div>
          </div>
        </div>
      )}
      {sp.cred === 'no_email' && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          ログイン発行にはメールアドレスが必要です。上部フォームでメールアドレスを登録してください。
        </div>
      )}
      {sp.cred === 'error' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">発行に失敗しました{sp.msg ? `: ${sp.msg}` : ''}</div>
      )}
      {sp.invite === 'sent' && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">招待メールを送信しました。</div>}
      {sp.invite === 'smtp_unconfigured' && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          SMTP が未設定のため招待メールを送信できません（環境変数 SMTP_HOST / SMTP_USER / SMTP_PASS）。
        </div>
      )}
      {sp.invite === 'error' && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">招待に失敗しました{sp.msg ? `: ${sp.msg}` : ''}</div>}

      {/* ===== ログイン発行（本部が直接パスワードを発行する発行型フロー） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-slate-900">ログイン発行・権限</h2>
          {member.user_id ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> アカウント連携済み</span>
          ) : (
            <span className="ml-auto text-xs text-slate-400">未発行</span>
          )}
        </div>

        {member.email ? (
          <form action={issueCredentialsAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={member.id} />
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">パスワード（空欄で自動生成）</label>
              <input name="password" placeholder="自動生成する場合は空欄" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">権限</label>
              <select disabled className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <option>加盟店（member）</option>
              </select>
            </div>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              {member.user_id ? 'パスワードを再発行' : 'ログイン情報を発行'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate-400">発行にはメールアドレスの登録が必要です。</p>
        )}

        <p className="mt-2 text-xs text-slate-400">
          発行後、メール・パスワードを加盟店へ共有すると、加盟店はそのままログインできます。
        </p>

        {/* 補助：メール招待（自分でパスワード設定させる従来方式） */}
        {member.email && (
          <form action={inviteMemberAction} className="mt-3 border-t border-slate-100 pt-3">
            <input type="hidden" name="id" value={member.id} />
            <button className="flex items-center gap-1.5 text-xs font-medium text-info-600 hover:underline">
              <Mail className="h-3.5 w-3.5" />
              または招待メールを送る（加盟店自身にパスワード設定させる）
            </button>
          </form>
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
