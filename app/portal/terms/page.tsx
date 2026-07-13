import { ScrollText, CheckCircle2 } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { hasConsented } from '@/lib/portal/agreements'
import { DarkCard, DarkCardBody } from '@/components/portal-dark/DarkUI'
import ConsentButton from './ConsentButton'

export const dynamic = 'force-dynamic'

export default async function MemberTermsPage() {
  const session = await requireMember()
  const { agreement, consented } = await hasConsented(session.userId)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <ScrollText className="h-5 w-5 text-brand-400" /> 利用規約
        </h1>
        <p className="text-sm text-slate-400">内容をご確認のうえ、同意してください。</p>
      </div>

      {!agreement ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          現在、公開中の利用規約がありません。本部にお問い合わせください。
        </div>
      ) : (
        <>
          <DarkCard>
            <DarkCardBody>
              <h2 className="mb-3 text-base font-bold text-white">{agreement.title}<span className="ml-2 text-xs font-normal text-slate-500">v{agreement.version}</span></h2>
              <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-carbon-700 bg-carbon-900/60 p-4 text-sm leading-relaxed text-slate-300 scrollbar-dark">
                {agreement.body}
              </div>
            </DarkCardBody>
          </DarkCard>

          {consented ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-300">
              <CheckCircle2 className="h-4 w-4" /> この利用規約に同意済みです。
            </div>
          ) : (
            <ConsentButton />
          )}
        </>
      )}
    </div>
  )
}
