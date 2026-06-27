import Logo from '@/components/Logo'
import { cn } from '@/lib/cn'

/**
 * CARBAY FC ロゴタイプ。アイコン + 「CARBAY」+ 赤い「FC」+ サブタイトル。
 * デザインカンプ準拠。
 */
export default function Wordmark({
  subtitle = '加盟店プラットフォーム',
  theme = 'light',
  size = 'md',
  className,
}: {
  subtitle?: string | null
  theme?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const iconSize = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const textSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl'
  const carbayColor = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const subColor = theme === 'dark' ? 'text-white/55' : 'text-slate-500'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Logo variant="icon" className={cn(iconSize, 'rounded-xl')} priority />
      <div className="leading-tight">
        <div className={cn('font-extrabold tracking-tight', textSize)}>
          <span className={carbayColor}>CARBAY</span>{' '}
          <span className="text-brand-500">FC</span>
        </div>
        {subtitle && <div className={cn('text-[11px] font-medium', subColor)}>{subtitle}</div>}
      </div>
    </div>
  )
}
