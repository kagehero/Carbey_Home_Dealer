'use server'

import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { reviewEvidence } from '@/lib/portal/evidence'

/** 本部がエビデンスを承認/却下する。 */
export async function reviewEvidenceAction(formData: FormData) {
  const session = await requireFeature('members')
  const evidenceId = String(formData.get('evidence_id') ?? '')
  const memberId = String(formData.get('member_id') ?? '')
  const status = String(formData.get('status') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null
  if (!evidenceId || (status !== 'approved' && status !== 'rejected')) return

  await reviewEvidence(evidenceId, session.userId, status, note)
  revalidatePath(`/admin/members/${memberId}`)
}
