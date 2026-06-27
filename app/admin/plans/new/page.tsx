import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { createPlanAction } from '../actions'

export const dynamic = 'force-dynamic'

const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'
const label = 'mb-1 block text-sm font-medium text-slate-700'

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/admin/plans" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        プラン管理へ
      </Link>
      <h1 className="mb-6 text-xl font-bold text-slate-900">プランを追加</h1>

      {sp.error === 'required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">コードとプラン名は必須です。</div>
      )}

      <form action={createPlanAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>コード *</label>
            <input name="code" required placeholder="例: platinum" className={`${field} font-mono`} />
          </div>
          <div>
            <label className={label}>種別</label>
            <select name="plan_type" defaultValue="full_auto" className={field}>
              <option value="full_auto">全自動</option>
              <option value="semi_auto">半自動</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>プラン名 *</label>
          <input name="name" required className={field} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>月額 (円)</label>
            <input name="monthly_fee_yen" type="number" min="0" defaultValue="0" className={field} />
          </div>
          <div>
            <label className={label}>加盟金 (円)</label>
            <input name="joining_fee_yen" type="number" min="0" defaultValue="0" className={field} />
          </div>
          <div>
            <label className={label}>表示順</label>
            <input name="display_order" type="number" defaultValue="0" className={field} />
          </div>
        </div>
        <div>
          <label className={label}>説明</label>
          <input name="description" className={field} />
        </div>
        <div>
          <label className={label}>機能 (1行1項目)</label>
          <textarea name="features" rows={3} className={field} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" defaultChecked />
          有効にする
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin/plans" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            キャンセル
          </Link>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            追加する
          </button>
        </div>
      </form>
    </div>
  )
}
