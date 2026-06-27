import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPublicSupabaseConfig, getServiceRoleKey } from '@/lib/env'

/**
 * Service-role クライアント (RLS バイパス)。サーバー専用。
 * portal スキーマをデフォルトにする。
 */
export function createServiceRoleClient() {
  const { url } = getPublicSupabaseConfig()
  const key = getServiceRoleKey()
  return createClient<Database, 'portal'>(url, key, {
    db: { schema: 'portal' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
