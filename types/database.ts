/**
 * Carbey Portal の DB 型 (portal スキーマ, 要求事項定義書 v1.2 準拠)。
 * supabase gen types を導入したら差し替える。
 */

// 要求書 5.1: 管理者 / 加盟店 / CRM入力担当 / チャット専用
export type UserRole = 'admin' | 'member' | 'crm_staff' | 'chat_only'
export type UserStatus = 'active' | 'suspended'
export type MemberStatus = 'pending' | 'active' | 'suspended' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'overdue'
export type PlanType = 'semi_auto' | 'full_auto'
export type DealStatus = 'lead' | 'negotiating' | 'quoted' | 'won' | 'lost'

export type PlanRow = {
  id: string
  code: string
  name: string
  plan_type: PlanType
  monthly_fee_yen: number
  joining_fee_yen: number
  display_order: number
  description: string | null
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}
export type PlanInsert = {
  code: string
  name: string
  plan_type: PlanType
  monthly_fee_yen?: number
  joining_fee_yen?: number
  display_order?: number
  description?: string | null
  features?: string[]
  is_active?: boolean
}

export type PortalUserRow = {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export type MemberRow = {
  id: string
  user_id: string | null
  company_name: string | null
  member_name: string
  phone_mobile: string | null
  phone_landline: string | null
  email: string | null
  address: string | null
  delivery_name: string | null
  delivery_address: string | null
  delivery_contact: string | null
  plan_id: string | null
  contract_date: string | null
  status: MemberStatus
  joining_fee_yen: number | null
  monthly_fee_yen: number | null
  working_capital_yen: number | null
  payment_status: PaymentStatus
  registration_date: string
  last_login_at: string | null
  onboarding_total: number
  onboarding_done: number
  admin_notes: string | null
  created_at: string
  updated_at: string
}
export type MemberInsert = {
  user_id?: string | null
  company_name?: string | null
  member_name: string
  phone_mobile?: string | null
  phone_landline?: string | null
  email?: string | null
  address?: string | null
  delivery_name?: string | null
  delivery_address?: string | null
  delivery_contact?: string | null
  plan_id?: string | null
  contract_date?: string | null
  status?: MemberStatus
  joining_fee_yen?: number | null
  monthly_fee_yen?: number | null
  working_capital_yen?: number | null
  payment_status?: PaymentStatus
  registration_date?: string
  admin_notes?: string | null
}

export type PaymentRow = {
  id: string
  member_id: string
  amount_yen: number
  payment_date: string
  kind: 'joining' | 'monthly' | 'other'
  status: 'pending' | 'confirmed' | 'failed'
  note: string | null
  created_at: string
}

// CRM (要求書 5.12): エンドユーザー(購入者)・購入履歴・商談
export type CrmCustomerRow = {
  id: string
  member_id: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  note: string | null
  created_at: string
  updated_at: string
}
export type CrmCustomerInsert = {
  member_id?: string | null
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  note?: string | null
}

export type CrmPurchaseRow = {
  id: string
  customer_id: string
  vehicle_name: string | null
  price_yen: number | null
  purchased_at: string | null
  note: string | null
  created_at: string
}

export type CrmDealRow = {
  id: string
  customer_id: string
  title: string | null
  status: DealStatus
  amount_yen: number | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}
export type CrmDealInsert = {
  customer_id: string
  title?: string | null
  status?: DealStatus
  amount_yen?: number | null
}

export type CrmDealNoteRow = {
  id: string
  deal_id: string
  author_id: string | null
  body: string
  created_at: string
}

export type NotificationRow = {
  id: string
  user_id: string | null
  audience: 'user' | 'admin'
  kind: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

export type AnnouncementRow = {
  id: string
  title: string
  body: string
  level: 'info' | 'important'
  published: boolean
  author_id: string | null
  created_at: string
  updated_at: string
}

export type ChatConversationRow = {
  id: string
  member_id: string
  last_message_at: string | null
  created_at: string
}

export type ChatMessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: UserRole
  sender_name: string | null
  body: string | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
  read_at: string | null
  edited_at: string | null
  deleted_at: string | null
  created_at: string
}

export type FundingMethod = 'self' | 'loan'

export type FundingRow = {
  id: string
  member_id: string
  method: FundingMethod | null
  self_amount_yen: number | null
  self_confirmed: boolean
  step_status: Record<string, 'todo' | 'done'>
  status: 'in_progress' | 'completed'
  created_at: string
  updated_at: string
}

export type AgreementRow = {
  id: string
  title: string
  body: string
  version: number
  published: boolean
  author_id: string | null
  created_at: string
  updated_at: string
}

export type AgreementConsentRow = {
  id: string
  member_id: string
  agreement_id: string | null
  agreed_at: string
  /** 同意時点のスナップショット（証拠保全） */
  agreement_version: number | null
  agreement_title: string | null
  user_id: string | null
}

export type ManualSectionRow = {
  id: string
  title: string
  body: string | null
  note: string | null
  sort_order: number
  published: boolean
  created_at: string
  updated_at: string
}

export type ManualProgressRow = {
  id: string
  member_id: string
  section_id: string
  checked_at: string
}

export type SupportItemRow = {
  id: string
  title: string
  body: string | null
  note: string | null
  sort_order: number
  published: boolean
  created_at: string
  updated_at: string
}

export type EvidenceKind = 'identity' | 'antique_license' | 'other'
export type EvidenceDocType = 'license' | 'mynumber' | 'passport' | 'antique' | 'other'
export type EvidenceStatus = 'pending' | 'approved' | 'rejected'

export type EvidenceRow = {
  id: string
  member_id: string
  kind: EvidenceKind
  doc_type: EvidenceDocType | null
  storage_path: string
  file_name: string
  file_type: string | null
  file_size: number | null
  status: EvidenceStatus
  reviewed_by: string | null
  reviewed_at: string | null
  note: string | null
  created_at: string
}

export type OrderStatus = 'received' | 'in_progress' | 'completed' | 'cancelled'

export type OrderRow = {
  id: string
  order_number: string | null
  member_id: string
  maker: string | null
  car_model: string
  year: string | null
  budget_yen: number | null
  preferred_color: string | null
  mileage_max: number | null
  notes: string | null
  status: OrderStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export type OnboardingTaskStatus = 'todo' | 'in_progress' | 'done'

export type OnboardingTaskRow = {
  id: string
  member_id: string
  step_key: string
  step_label: string
  title: string
  status: OnboardingTaskStatus
  completion_type: 'auto' | 'manual'
  /** 実体機能への接続キー（identity/antique_license/funding/terms/manual）。null=手動/自動ボタン */
  link_key: string | null
  /** ゲート対象外（古物商など・未提出でも先へ進める） */
  optional: boolean
  sort_order: number
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  portal: {
    Tables: {
      plans: { Row: PlanRow; Insert: PlanInsert; Update: Partial<PlanInsert> }
      users: { Row: PortalUserRow; Insert: Partial<PortalUserRow>; Update: Partial<PortalUserRow> }
      members: { Row: MemberRow; Insert: MemberInsert; Update: Partial<MemberInsert> }
      payments: { Row: PaymentRow; Insert: Partial<PaymentRow>; Update: Partial<PaymentRow> }
      crm_customers: { Row: CrmCustomerRow; Insert: CrmCustomerInsert; Update: Partial<CrmCustomerInsert> }
      crm_purchases: { Row: CrmPurchaseRow; Insert: Partial<CrmPurchaseRow>; Update: Partial<CrmPurchaseRow> }
      crm_deals: { Row: CrmDealRow; Insert: CrmDealInsert; Update: Partial<CrmDealInsert> }
      crm_deal_notes: { Row: CrmDealNoteRow; Insert: Partial<CrmDealNoteRow>; Update: Partial<CrmDealNoteRow> }
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow> }
      onboarding_tasks: { Row: OnboardingTaskRow; Insert: Partial<OnboardingTaskRow>; Update: Partial<OnboardingTaskRow> }
      orders: { Row: OrderRow; Insert: Partial<OrderRow>; Update: Partial<OrderRow> }
      evidences: { Row: EvidenceRow; Insert: Partial<EvidenceRow>; Update: Partial<EvidenceRow> }
      agreements: { Row: AgreementRow; Insert: Partial<AgreementRow>; Update: Partial<AgreementRow> }
      agreement_consents: { Row: AgreementConsentRow; Insert: Partial<AgreementConsentRow>; Update: Partial<AgreementConsentRow> }
      manual_sections: { Row: ManualSectionRow; Insert: Partial<ManualSectionRow>; Update: Partial<ManualSectionRow> }
      manual_progress: { Row: ManualProgressRow; Insert: Partial<ManualProgressRow>; Update: Partial<ManualProgressRow> }
      support_items: { Row: SupportItemRow; Insert: Partial<SupportItemRow>; Update: Partial<SupportItemRow> }
      funding_applications: { Row: FundingRow; Insert: Partial<FundingRow>; Update: Partial<FundingRow> }
      chat_conversations: { Row: ChatConversationRow; Insert: Partial<ChatConversationRow>; Update: Partial<ChatConversationRow> }
      chat_messages: { Row: ChatMessageRow; Insert: Partial<ChatMessageRow>; Update: Partial<ChatMessageRow> }
      announcements: { Row: AnnouncementRow; Insert: Partial<AnnouncementRow>; Update: Partial<AnnouncementRow> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
}
