/**
 * 依存ライブラリなしの軽量 SVG チャート群（ダッシュボード用）。
 * データはすべて props で受け取る（実データを渡して使用する）。
 */

/* ---------- 折れ線チャート（売上・利益の推移） ---------- */

export type LineSeries = { name: string; color: string; data: number[] }

export function LineChart({
  series,
  labels,
  height = 220,
}: {
  series: LineSeries[]
  labels: string[]
  height?: number
}) {
  const W = 640
  const H = height
  const padX = 36
  const padY = 20
  const max = Math.max(1, ...series.flatMap((s) => s.data))
  const stepX = (W - padX * 2) / Math.max(1, labels.length - 1)
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2)
  const x = (i: number) => padX + i * stepX

  const path = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  // 横グリッド線 5本
  const grid = [0, 0.25, 0.5, 0.75, 1].map((r) => H - padY - r * (H - padY * 2))

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
        {grid.map((gy, i) => (
          <line key={i} x1={padX} x2={W - padX} y1={gy} y2={gy} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <path d={path(s.data)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="#fff" stroke={s.color} strokeWidth={2} />
            ))}
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 4} textAnchor="middle" className="fill-slate-400 text-[10px]">
            {l}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-center gap-5">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- ドーナツチャート（プラン別） ---------- */

export type DonutSlice = { label: string; value: number; color: string }

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[]
  centerLabel?: string
  centerValue?: string | number
}) {
  const total = Math.max(1, slices.reduce((s, x) => s + x.value, 0))
  const R = 60
  const C = 80
  const stroke = 22
  const circ = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
        <circle cx={C} cy={C} r={R} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {slices.map((s) => {
          const len = (s.value / total) * circ
          const seg = (
            <circle
              key={s.label}
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return seg
        })}
        {(centerValue != null || centerLabel) && (
          <g className="rotate-90" style={{ transformOrigin: '80px 80px' }}>
            {centerLabel && (
              <text x={C} y={C - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">
                {centerLabel}
              </text>
            )}
            {centerValue != null && (
              <text x={C} y={C + 12} textAnchor="middle" className="fill-slate-900 text-xl font-bold">
                {centerValue}
              </text>
            )}
          </g>
        )}
      </svg>
      <ul className="space-y-2">
        {slices.map((s) => {
          const pct = ((s.value / total) * 100).toFixed(1)
          return (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-slate-600">{s.label}</span>
              <span className="ml-auto font-medium text-slate-900">{s.value}</span>
              <span className="w-12 text-right text-xs text-slate-400">({pct}%)</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
