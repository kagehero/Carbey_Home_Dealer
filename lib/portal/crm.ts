import { createServiceRoleClient } from '@/lib/supabase/admin'
import type {
  CrmCustomerRow,
  CrmCustomerInsert,
  CrmPurchaseRow,
  CrmDealRow,
  CrmDealInsert,
  CrmDealNoteRow,
} from '@/types/database'

/**
 * CRM データアクセス (要求書 5.12: エンドユーザー(購入者)・購入履歴・商談管理)。
 * 呼び出し側で can_crm (admin / crm_staff) 済みであること。
 */

// --- 顧客 (エンドユーザー) ---

export async function listCustomers(q?: string): Promise<CrmCustomerRow[]> {
  const supabase = createServiceRoleClient()
  let query = supabase.from('crm_customers').select('*').order('created_at', { ascending: false })
  if (q) {
    const like = `%${q}%`
    query = query.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmCustomerRow[]
}

export async function getCustomer(id: string): Promise<CrmCustomerRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('crm_customers')
    .select('*')
    .eq('id', id)
    .maybeSingle<CrmCustomerRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function createCustomer(input: CrmCustomerInsert): Promise<CrmCustomerRow> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('crm_customers')
    .insert(input as never)
    .select('*')
    .single<CrmCustomerRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function updateCustomer(id: string, patch: Partial<CrmCustomerInsert>): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('crm_customers').update(patch as never).eq('id', id)
  if (error) throw new Error(error.message)
}

// --- 購入履歴 ---

export async function listPurchases(customerId: string): Promise<CrmPurchaseRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('crm_purchases')
    .select('*')
    .eq('customer_id', customerId)
    .order('purchased_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmPurchaseRow[]
}

export async function addPurchase(
  customerId: string,
  vehicle: string,
  priceYen: number | null,
  purchasedAt: string | null,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('crm_purchases').insert({
    customer_id: customerId,
    vehicle_name: vehicle,
    price_yen: priceYen,
    purchased_at: purchasedAt,
  } as never)
  if (error) throw new Error(error.message)
}

// --- 商談 ---

export async function listDeals(customerId: string): Promise<CrmDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('crm_deals')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmDealRow[]
}

export async function createDeal(input: CrmDealInsert): Promise<CrmDealRow> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('crm_deals')
    .insert(input as never)
    .select('*')
    .single<CrmDealRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function updateDealStatus(id: string, status: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('crm_deals').update({ status } as never).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listDealNotes(dealId: string): Promise<CrmDealNoteRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('crm_deal_notes')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmDealNoteRow[]
}

export async function addDealNote(dealId: string, body: string, authorId: string | null): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('crm_deal_notes')
    .insert({ deal_id: dealId, body, author_id: authorId } as never)
  if (error) throw new Error(error.message)
}
