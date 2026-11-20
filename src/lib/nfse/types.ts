import type { DueState, Issuer, NfseMode, NfseStatus } from './queue'

export interface NfseItemDto {
  id: string
  userId: string | null
  amount: number
  /** dia do pagamento (AAAA-MM-DD, Brasília) */
  paidOn: string
  /** dia em que a nota deve sair */
  emitOn: string
  status: NfseStatus
  name: string
  doc: string
  email: string
  nfseNumber: string | null
  issuedAt: string | null
  emailedAt: string | null
  /** o pagamento foi devolvido depois da emissão: cancelar a nota no emissor */
  refunded: boolean
  note: string | null
  issuer: Issuer
  due: { state: DueState; days: number }
}

export interface NfseOverview {
  mode: NfseMode
  waitDays: number
  autoAvailable: boolean
  /** hoje, em Brasília (AAAA-MM-DD) */
  today: string
  items: NfseItemDto[]
}

export type NfseErrorCode =
  | 'forbidden' | 'unknown' | 'not_found' | 'already_done' | 'mode_unavailable' | 'invalid_input'
  | 'pdf_empty' | 'pdf_too_big' | 'pdf_invalid' | 'email_invalid' | 'mail_failed'

export type NfseResult<T = object> = ({ success: true } & T) | { success: false; code: NfseErrorCode }
