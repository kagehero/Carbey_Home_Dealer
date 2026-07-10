import Link from 'next/link'
import { LifeBuoy, ScrollText, Info, ArrowRight, MessageSquare } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

/**
 * 本部サポート（フェーズ⑥-4）。
 * 重要（非弁類似リスク回避）: 本部は業務を「代行」しない。
 *   古物商取得は「取得業者の紹介」名目で扱う。文言に「代行」を使わない。
 * 今後サポート項目が増える想定の入口ページ。
 */

const SUPPORT_ITEMS = [
  {
    key: 'antique',
    title: '古物商取得サポート（業者の紹介）',
    desc: '古物商許可の取得を希望する加盟店へ、行政書士・取得サポート業者を紹介します。手続きの申請自体は加盟店ご本人または紹介先の有資格者が行います。',
    note: '本部は申請の代行は行いません（有資格者の紹介・取次のみ）。',
    icon: ScrollText,
  },
] as const

export default async function AdminSupportPage() {
  await requireFeature('members')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <LifeBuoy className="h-5 w-5 text-brand-500" /> 本部サポート
        </h1>
        <p className="mt-1 text-sm text-slate-500">加盟店の開業をサポートするメニューです。</p>
      </div>

      {/* 法務上の位置づけ（非弁類似リスク回避） */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-amber-800">
          <p className="font-semibold">サポートの位置づけについて</p>
          <p className="mt-0.5 text-[13px] leading-relaxed">
            本部は、資格を要する手続き（古物商許可の申請等）を<span className="font-semibold">代行しません</span>。
            有資格の専門業者・行政書士を<span className="font-semibold">紹介・取次</span>する形で支援します。
            実際の申請は加盟店ご本人、または紹介先の有資格者が行います。
          </p>
        </div>
      </div>

      {/* サポート項目 */}
      <div className="space-y-4">
        {SUPPORT_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.key}>
              <CardHeader title={<span className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand-500" /> {item.title}</span>} />
              <CardBody className="space-y-2">
                <p className="text-sm text-slate-600">{item.desc}</p>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{item.note}</p>
                <div className="pt-1">
                  <Link href="/admin/chat" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                    <MessageSquare className="h-3.5 w-3.5" /> チャットで加盟店に案内する <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-slate-400">
        今後、サポート項目（資金調達サポート等）を追加できます。追加をご希望の場合は開発までご連絡ください。
      </p>
    </div>
  )
}
