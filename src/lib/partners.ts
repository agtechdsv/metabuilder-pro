/** Tipos do programa de parceiros (indicador com comissão), compartilhados entre as server actions e as telas. Regras puras em supabase/functions/_shared/partnerCommission.ts. */
import type { CommissionSummary, PixKeyType } from '../../supabase/functions/_shared/partnerCommission'

export type { CommissionSummary, PixKeyType }

export interface PartnerSettings {
  defaultPercent: number
  graceDays: number
  minPayout: number
  payoutCap: number
}

export const DEFAULT_PARTNER_SETTINGS: PartnerSettings = { defaultPercent: 15, graceDays: 7, minPayout: 50, payoutCap: 5000 }

export interface PartnerInput {
  id?: string
  /** e-mail da conta MetaBuilder do parceiro (a pessoa precisa já ter cadastro) */
  userEmail?: string
  name: string
  document: string
  pixKey: string
  pixKeyType: PixKeyType | ''
  code: string
  /** vazio = usa o padrão global */
  commissionPercent: number | null
  status: 'active' | 'suspended'
  notes: string
}

export interface PartnerRow {
  id: string
  userId: string
  userEmail: string
  name: string
  document: string | null
  pixKey: string | null
  pixKeyType: PixKeyType | null
  code: string
  commissionPercent: number | null
  status: 'active' | 'suspended'
  notes: string | null
  referrals: number
  subscribed: number
  summary: CommissionSummary
}

export interface PayoutItemRow {
  id: string
  partnerId: string
  partnerName: string
  amount: number
  pixKey: string
  pixKeyType: string
  status: 'pending' | 'sending' | 'sent' | 'done' | 'failed'
  failReason: string | null
  receiptUrl: string | null
  asaasTransferId: string | null
}

export interface PayoutRow {
  id: string
  status: 'processing' | 'done' | 'partial' | 'failed'
  total: number
  note: string | null
  createdAt: string
  items: PayoutItemRow[]
}

export interface PartnerDashboard {
  partner: { name: string; code: string; status: 'active' | 'suspended'; percent: number; hasPixKey: boolean; pixKeyType: PixKeyType | null; pixKeyMasked: string | null } | null
  settings: { graceDays: number; minPayout: number }
  summary: CommissionSummary
  referrals: { id: string; email: string; status: 'registered' | 'subscribed' | 'canceled'; createdAt: string; paidAt: string | null; canceledAt: string | null }[]
  commissions: { id: string; referredEmail: string; gross: number; net: number; percent: number; amount: number; status: string; releaseAt: string; createdAt: string; revokedReason: string | null; clawback: boolean }[]
  payouts: { id: string; amount: number; status: string; createdAt: string; receiptUrl: string | null }[]
}

/** Erros que as server actions devolvem por código (a tela traduz). */
export type PartnerErrorCode =
  | 'not_authorized' | 'user_not_found' | 'code_invalid' | 'code_in_use' | 'pix_invalid' | 'document_invalid' | 'percent_invalid'
  | 'already_partner' | 'nothing_to_pay' | 'payout_cap_exceeded' | 'no_partners' | 'not_found' | 'unknown'
