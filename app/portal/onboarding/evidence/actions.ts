'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { uploadEvidence, deleteOwnEvidence } from '@/lib/portal/evidence'
import type { EvidenceKind, EvidenceDocType } from '@/types/database'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

const IDENTITY_DOCS: EvidenceDocType[] = ['license', 'mynumber', 'passport']

/** 加盟店がエビデンス（本人確認/古物商）をアップロードする。 */
export async function uploadEvidenceAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  const kind = String(formData.get('kind') ?? '') as EvidenceKind
  const docTypeRaw = String(formData.get('doc_type') ?? '')
  const file = formData.get('file')

  if (!['identity', 'antique_license', 'other'].includes(kind)) return { ok: false, error: '種別が不正です' }
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'ファイルを選択してください' }
  if (file.size > MAX_SIZE) return { ok: false, error: 'ファイルサイズは10MBまでです' }
  if (!ALLOWED.includes(file.type)) return { ok: false, error: '画像またはPDFを提出してください' }

  // 本人確認は顔写真付き身分証に限定
  let docType: EvidenceDocType | null = null
  if (kind === 'identity') {
    if (!IDENTITY_DOCS.includes(docTypeRaw as EvidenceDocType)) {
      return { ok: false, error: '免許証・マイナンバーカード・パスポートのいずれかを選択してください' }
    }
    docType = docTypeRaw as EvidenceDocType
  } else if (kind === 'antique_license') {
    docType = 'antique'
  }

  try {
    const buffer = await file.arrayBuffer()
    await uploadEvidence(session.userId, {
      kind,
      docType,
      file: { buffer, name: file.name, type: file.type, size: file.size },
    })
    revalidatePath('/portal/onboarding/evidence')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'アップロードに失敗しました' }
  }
}

/** 自分の未確認エビデンスを削除（再提出用）。 */
export async function deleteEvidenceAction(evidenceId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  try {
    await deleteOwnEvidence(session.userId, evidenceId)
    revalidatePath('/portal/onboarding/evidence')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}
