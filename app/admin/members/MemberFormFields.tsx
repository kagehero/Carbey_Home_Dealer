import { MEMBER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/portal/labels'
import type { MemberStatus, PaymentStatus, PlanRow, MemberRow } from '@/types/database'

const field =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none'
const label = 'mb-1 block text-sm font-medium text-slate-700'

/** 会員フォームの入力欄 (要求書 5.2 登録・管理項目)。new(member=null) と edit で共用。 */
export default function MemberFormFields({
  plans,
  member = null,
  showPaymentStatus = false,
}: {
  plans: PlanRow[]
  member?: MemberRow | null
  showPaymentStatus?: boolean
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">基本情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>氏名 *</label>
            <input name="member_name" required defaultValue={member?.member_name ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>会社名</label>
            <input name="company_name" defaultValue={member?.company_name ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>メールアドレス</label>
            <input name="email" type="email" defaultValue={member?.email ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>携帯番号</label>
            <input name="phone_mobile" defaultValue={member?.phone_mobile ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>固定電話番号</label>
            <input name="phone_landline" defaultValue={member?.phone_landline ?? ''} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>住所</label>
            <input name="address" defaultValue={member?.address ?? ''} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">陸送先</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>陸送先名</label>
            <input name="delivery_name" defaultValue={member?.delivery_name ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>陸送先連絡先</label>
            <input name="delivery_contact" defaultValue={member?.delivery_contact ?? ''} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>陸送先住所</label>
            <input name="delivery_address" defaultValue={member?.delivery_address ?? ''} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">契約情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>プラン</label>
            <select name="plan_id" defaultValue={member?.plan_id ?? ''} className={field}>
              <option value="">未設定</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>契約日<span className="ml-1 text-xs font-normal text-slate-400">（稼働中にする場合は必須）</span></label>
            <input name="contract_date" type="date" defaultValue={member?.contract_date ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>契約ステータス</label>
            <select name="status" defaultValue={member?.status ?? 'pending'} className={field}>
              {(Object.keys(MEMBER_STATUS_LABEL) as MemberStatus[]).map((s) => (
                <option key={s} value={s}>
                  {MEMBER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          {showPaymentStatus && (
            <div>
              <label className={label}>支払ステータス</label>
              <select name="payment_status" defaultValue={member?.payment_status ?? 'unpaid'} className={field}>
                {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">財務情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>加盟金 (円)</label>
            <input name="joining_fee_yen" type="number" min="0" defaultValue={member?.joining_fee_yen ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>月額費用 (円)</label>
            <input name="monthly_fee_yen" type="number" min="0" defaultValue={member?.monthly_fee_yen ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>運転資金 (円)</label>
            <input name="working_capital_yen" type="number" min="0" defaultValue={member?.working_capital_yen ?? ''} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">管理メモ (内部)</h2>
        <textarea
          name="admin_notes"
          rows={3}
          defaultValue={member?.admin_notes ?? ''}
          placeholder="例: 資金調達支援を希望。AIパッケージに関心あり。"
          className={field}
        />
      </section>
    </div>
  )
}
