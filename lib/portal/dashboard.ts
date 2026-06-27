import { createServiceRoleClient } from '@/lib/supabase/admin'

export type AdminStats = {
  members: { total: number; active: number; pending: number; suspended: number; cancelled: number }
  planDistribution: { code: string; name: string; count: number }[]
  monthlyRevenueYen: number
  newOrders: number
  unreadChats: number
}

/** 本部ダッシュボードの集計。Phase 1 では orders/chats は未実装のため 0。 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createServiceRoleClient()

  const [membersRes, plansRes, paymentsRes] = await Promise.all([
    supabase.from('members').select('status, plan_id'),
    supabase.from('plans').select('id, code, name, display_order').order('display_order'),
    supabase.from('payments').select('amount_yen, payment_date, status'),
  ])

  const m = (membersRes.data ?? []) as { status: string; plan_id: string | null }[]
  const plans = (plansRes.data ?? []) as { id: string; code: string; name: string }[]
  const payments = (paymentsRes.data ?? []) as {
    amount_yen: number
    payment_date: string
    status: string
  }[]
  const counts = {
    total: m.length,
    active: m.filter((x) => x.status === 'active').length,
    pending: m.filter((x) => x.status === 'pending').length,
    suspended: m.filter((x) => x.status === 'suspended').length,
    cancelled: m.filter((x) => x.status === 'cancelled').length,
  }

  const planDistribution = plans.map((p) => ({
    code: p.code,
    name: p.name,
    count: m.filter((x) => x.plan_id === p.id).length,
  }))

  // 今月の確定入金合計
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthlyRevenueYen = payments
    .filter((p) => p.status === 'confirmed' && String(p.payment_date).startsWith(ym))
    .reduce((s, p) => s + (p.amount_yen ?? 0), 0)

  return {
    members: counts,
    planDistribution,
    monthlyRevenueYen,
    newOrders: 0, // Phase 2
    unreadChats: 0, // Phase 2
  }
}

export type RecentMember = {
  id: string
  member_name: string
  company_name: string | null
  status: string
  created_at: string
}

/** 最近登録された加盟店 (ダッシュボードの最近の動き)。 */
export async function getRecentMembers(limit = 5): Promise<RecentMember[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('members')
    .select('id, member_name, company_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as RecentMember[]
}
