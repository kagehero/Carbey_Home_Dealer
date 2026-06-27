import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listPlans } from '@/lib/portal/plans'
import { createMemberAction } from '../actions'
import MemberFormFields from '../MemberFormFields'

export const dynamic = 'force-dynamic'

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireFeature('members')
  const [plans, sp] = await Promise.all([listPlans(false), searchParams])

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/members" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        会員一覧へ
      </Link>
      <h1 className="mb-6 text-xl font-bold text-slate-900">会員を登録</h1>

      {sp.error === 'name_required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">担当者氏名は必須です。</div>
      )}

      <form action={createMemberAction}>
        <MemberFormFields plans={plans} />
        <div className="mt-6 flex justify-end gap-3">
          <Link href="/admin/members" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            キャンセル
          </Link>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            登録する
          </button>
        </div>
      </form>
    </div>
  )
}
