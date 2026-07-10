import Image from 'next/image'
import Link from 'next/link'
import {
  CheckCircle2, Loader2, TrendingUp, Car, ClipboardPlus, Search, FileBarChart,
  MessageSquare, Sparkles, MapPin, Clock, ArrowRight, ChevronRight,
} from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getMemberByUserId } from '@/lib/portal/members'
import { getOwnOnboarding } from '@/lib/portal/onboarding'
import { listAnnouncements } from '@/lib/portal/announcements'
import { DarkCard, DarkCardHeader, DarkCardBody, DarkStat } from '@/components/portal-dark/DarkUI'
import { DarkDonut, DarkProgressRing, DarkLineChart, DarkRadar } from '@/components/portal-dark/DarkCharts'

export const dynamic = 'force-dynamic'

/* ===== ダミー（Phase 3/4 の売上・AI データ。実装時に差し替え） ===== */
const SALES_TREND = { labels: ['1月', '2月', '3月', '4月', '5月', '6月'], data: [1450, 1980, 2450, 2720, 2960, 3680] }
const SALES_STATUS = [
  { label: '成約済み', value: 18, color: '#f5362b' },
  { label: '商談中', value: 8, color: '#f59e0b' },
  { label: '仕入中', value: 4, color: '#64748b' },
]
const AI_INSIGHTS = [
  { icon: 'car', title: '高利益予測車種', main: 'クラウン（2020年式）', metric: '予測利益 +¥520,000' },
  { icon: 'map', title: '需要急上昇エリア', main: '大阪府', metric: '需要度 +34%' },
  { icon: 'clock', title: '仕入れ推奨タイミング', main: '今週末〜来週初め', metric: '成功率 78%' },
]

export default async function MemberDashboardPage() {
  const session = await requireMember()
  const [member, onboarding, announcements] = await Promise.all([
    getMemberByUserId(session.userId),
    getOwnOnboarding(session.userId),
    listAnnouncements(true, 3),
  ])

  const name = member?.member_name ?? session.name ?? 'ゲスト'
  const obPct = onboarding?.pct ?? 0
  const remainingSteps = onboarding ? onboarding.steps.filter((s) => s.status !== 'done').length : 0
  const currentStep = onboarding?.steps.find((s) => s.status === 'current')
  const totalSales = SALES_STATUS.reduce((s, x) => s + x.value, 0)

  return (
    <div className="space-y-5">
      {/* ===== ヒーロー ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-carbon-700 bg-carbon-900">
        <Image src="/login-hero.png" alt="" fill priority sizes="100vw" className="object-cover object-right opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/85 to-transparent" />
        <div className="relative px-6 py-8 sm:px-10 sm:py-12">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">ようこそ、{name} 様</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
            Carbey Home Dealer 加盟店プラットフォームへようこそ。
            <br />
            未来の中古車ビジネスを、データとAIで加速しましょう。
          </p>
        </div>
      </div>

      {/* ===== KPI 5枚 ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <DarkStat label="今月の売上高" value="¥28,600,000" trend={{ value: '18.6%', dir: 'up' }} sub="前月比"
          visual={<Sparkline color="#f5362b" />} />
        <DarkStat label="成約台数（今月）" value="18" unit="台" trend={{ value: '12.5%', dir: 'up' }} sub="前月比"
          visual={<Sparkline color="#f5362b" />} />
        <DarkStat label="平均利益率" value="22.4" unit="%" trend={{ value: '3.1pt', dir: 'up' }} sub="前月比"
          visual={<Bars color="#f5362b" />} />
        <DarkStat label="オンボーディング進捗" value={obPct} unit="%" sub={remainingSteps > 0 ? `次のステップまであと${remainingSteps}項目` : '完了'}
          visual={<DarkProgressRing pct={obPct} />} />
        <DarkStat label="AIスコア（仕入判断）" value="A+" accent sub="非常に良好"
          visual={<DarkRadar axes={['需要', '価格', '収益性', 'リスク', '相場']} values={[85, 70, 90, 60, 80]} size={92} />} />
      </div>

      {/* ===== オンボーディング進捗 + お知らせ ===== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DarkCard className="lg:col-span-2">
          <DarkCardHeader title="オンボーディング進捗"
            action={<Link href="/portal/onboarding" className="flex items-center gap-1 text-xs text-brand-400 hover:underline">詳細を見る <ChevronRight className="h-3 w-3" /></Link>} />
          <DarkCardBody>
            {onboarding && onboarding.steps.length > 0 ? (
              <>
                {/* ステップ横タイムライン */}
                <ol className="flex items-start">
                  {onboarding.steps.map((step, i) => (
                    <li key={step.key} className="flex flex-1 items-start last:flex-none">
                      <div className="flex flex-col items-center text-center">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                          step.status === 'done' ? 'bg-brand-500 text-white'
                            : step.status === 'current' ? 'border-2 border-brand-500 bg-brand-500/15 text-brand-400'
                            : 'border-2 border-carbon-600 bg-carbon-800 text-slate-500'
                        }`}>
                          {step.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                        </span>
                        <span className="mt-2 max-w-[70px] text-[10px] leading-tight text-slate-400">{step.label}</span>
                        <span className={`mt-0.5 text-[10px] ${step.status === 'done' ? 'text-brand-400' : step.status === 'current' ? 'text-brand-400' : 'text-slate-600'}`}>
                          {step.status === 'done' ? '完了' : step.status === 'current' ? '進行中' : ''}
                        </span>
                      </div>
                      {i < onboarding.steps.length - 1 && (
                        <div className={`mt-4 h-0.5 flex-1 ${step.status === 'done' ? 'bg-brand-500' : 'bg-carbon-600'}`} />
                      )}
                    </li>
                  ))}
                </ol>

                {/* 現在のタスク */}
                {currentStep && (
                  <div className="mt-6 flex items-center justify-between rounded-xl border border-carbon-700 bg-carbon-800/60 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">{currentStep.label}に進みましょう</div>
                        <div className="text-xs text-slate-400">未完了のタスクを進めてください。</div>
                      </div>
                    </div>
                    <Link href="/portal/onboarding" className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white glow-brand hover:bg-brand-600">
                      設定を開始する
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">オンボーディング情報がありません。</p>
            )}
          </DarkCardBody>
        </DarkCard>

        {/* お知らせ */}
        <DarkCard>
          <DarkCardHeader title="お知らせ"
            action={<Link href="/portal/announcements" className="flex items-center gap-1 text-xs text-brand-400 hover:underline">すべて見る <ChevronRight className="h-3 w-3" /></Link>} />
          <DarkCardBody className="p-0">
            {announcements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">お知らせはありません。</p>
            ) : (
              <ul className="divide-y divide-carbon-700">
                {announcements.map((a) => (
                  <li key={a.id} className="flex gap-2.5 px-5 py-3">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.level === 'important' ? 'bg-brand-500' : 'bg-slate-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-slate-200">{a.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{a.body}</div>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-600">{new Date(a.created_at).toLocaleDateString('ja-JP')}</span>
                  </li>
                ))}
              </ul>
            )}
          </DarkCardBody>
        </DarkCard>
      </div>

      {/* ===== 売上推移 + 販売状況 + AIインサイト + クイックアクセス ===== */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        {/* 売上推移 */}
        <DarkCard className="xl:col-span-2">
          <DarkCardHeader title="売上推移（直近6ヶ月）"
            action={<span className="rounded-md border border-carbon-600 px-2 py-1 text-xs text-slate-400">直近6ヶ月</span>} />
          <DarkCardBody>
            <DarkLineChart labels={SALES_TREND.labels} data={SALES_TREND.data} valueFormat={(v) => v.toLocaleString()} />
            <p className="mt-1 text-center text-[10px] text-slate-600">（万円）</p>
          </DarkCardBody>
        </DarkCard>

        {/* 販売状況 */}
        <DarkCard>
          <DarkCardHeader title="販売状況（今月）" />
          <DarkCardBody>
            <div className="flex items-center justify-center">
              <DarkDonut slices={SALES_STATUS} centerTop="合計" centerMain={totalSales} centerUnit="台" />
            </div>
            <ul className="mt-4 space-y-2">
              {SALES_STATUS.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-slate-300">{s.label}</span>
                  <span className="ml-auto font-medium text-white">{s.value}台</span>
                  <span className="w-12 text-right text-xs text-slate-500">({Math.round((s.value / totalSales) * 100)}%)</span>
                </li>
              ))}
            </ul>
          </DarkCardBody>
        </DarkCard>

        {/* AI分析インサイト */}
        <DarkCard>
          <DarkCardHeader title="AI分析インサイト" action={<span className="text-[10px] text-slate-500">今月の注目ポイント</span>} />
          <DarkCardBody className="space-y-3">
            {AI_INSIGHTS.map((ins) => (
              <div key={ins.title} className="flex items-start gap-3 rounded-lg border border-carbon-700 bg-carbon-800/40 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
                  {ins.icon === 'car' ? <Car className="h-4 w-4" /> : ins.icon === 'map' ? <MapPin className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-500">{ins.title}</div>
                  <div className="truncate text-sm font-semibold text-white">{ins.main}</div>
                  <div className="text-[11px] text-brand-400">{ins.metric}</div>
                </div>
              </div>
            ))}
          </DarkCardBody>
        </DarkCard>
      </div>

      {/* ===== クイックアクセス ===== */}
      <DarkCard>
        <DarkCardHeader title="クイックアクセス" />
        <DarkCardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <QuickBtn icon={<Car className="h-5 w-5" />} label="車両登録" href="/portal/vehicles" soon />
            <QuickBtn icon={<ClipboardPlus className="h-5 w-5" />} label="オーダー作成" href="/portal/orders" />
            <QuickBtn icon={<Search className="h-5 w-5" />} label="AI相場検索" href="/portal/ai" soon />
            <QuickBtn icon={<FileBarChart className="h-5 w-5" />} label="レポート出力" href="/portal/reports" soon />
            <QuickBtn icon={<MessageSquare className="h-5 w-5" />} label="チャットを開く" href="/portal/chat" primary />
          </div>
        </DarkCardBody>
      </DarkCard>
    </div>
  )
}

function QuickBtn({ icon, label, href, primary = false, soon = false }: { icon: React.ReactNode; label: string; href: string; primary?: boolean; soon?: boolean }) {
  // 未実装（準備中）はクリック不可・バッジ表示
  if (soon) {
    return (
      <div className="relative flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-carbon-700 bg-carbon-800/20 p-4 text-center text-xs font-medium text-slate-600" title="準備中">
        <span className="absolute right-2 top-2 rounded bg-carbon-700 px-1.5 py-0.5 text-[9px] text-slate-500">準備中</span>
        <span className="text-slate-600">{icon}</span>
        {label}
      </div>
    )
  }
  return (
    <Link href={href} className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-xs font-medium transition ${
      primary ? 'border-brand-500/40 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20'
        : 'border-carbon-700 bg-carbon-800/40 text-slate-300 hover:border-carbon-600 hover:bg-carbon-800'
    }`}>
      <span className={primary ? 'text-brand-400' : 'text-slate-400'}>{icon}</span>
      {label}
    </Link>
  )
}

/* 小型スパークライン（KPI用ダミー） */
function Sparkline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 72 32" className="h-8 w-16">
      <polyline points="0,26 12,22 24,24 36,14 48,16 60,8 72,4" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function Bars({ color }: { color: string }) {
  const hs = [8, 12, 10, 16, 14, 20, 24]
  return (
    <svg viewBox="0 0 72 32" className="h-8 w-16">
      {hs.map((h, i) => (
        <rect key={i} x={i * 10} y={32 - h} width="6" height={h} rx="1" fill={color} opacity={0.55 + i * 0.06} />
      ))}
    </svg>
  )
}
