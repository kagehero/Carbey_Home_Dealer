import { Bell, Search } from 'lucide-react'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

/** コンテンツ上部のトップバー (検索 + 通知 + ユーザー)。 */
export default function Topbar({
  userName,
  roleLabel,
  notificationsHref,
  unread = 0,
  showSearch = false,
}: {
  userName: string
  roleLabel: string
  notificationsHref?: string
  unread?: number
  /** 検索バーを表示する (ダッシュボード等) */
  showSearch?: boolean
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      {showSearch && (
        <div className="relative hidden flex-1 sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="加盟店・車両・契約を検索... (Ctrl + K)"
          />
        </div>
      )}

      <div className={showSearch ? 'flex items-center gap-3' : 'ml-auto flex items-center gap-3'}>
        {notificationsHref && (
          <Link
            href={notificationsHref}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="通知"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        )}
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-slate-800">{userName}</div>
            <div className="text-[11px] text-slate-500">{roleLabel}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
