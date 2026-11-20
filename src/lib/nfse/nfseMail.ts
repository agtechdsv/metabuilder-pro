import { esc, type MailContent } from '@/lib/security/securityMailText'
import { formatDateBr, moneyBr } from './queue'

export interface NfseMailData {
  customerName?: string | null
  amount: number | string
  /** número da NFS-e, se informado */
  number?: string | null
  /** dia da emissão (AAAA-MM-DD) */
  issuedOn: string
}

/** E-mail que leva a NFS-e (PDF em anexo) ao cliente. Só em português: a nota é brasileira. Todo texto vindo de fora é escapado. */
export function nfseCustomerMail(d: NfseMailData): MailContent {
  const name = (d.customerName || '').trim()
  const hello = name ? `Olá, ${name}!` : 'Olá!'
  const num = (d.number || '').trim()
  const subject = num ? `Sua nota fiscal (NFS-e ${num}) do MetaBuilder PRO` : 'Sua nota fiscal (NFS-e) do MetaBuilder PRO'
  const lines = [
    hello,
    '',
    `Segue em anexo a nota fiscal de serviço (NFS-e) referente ao seu pagamento de ${moneyBr(d.amount)}, emitida em ${formatDateBr(d.issuedOn)}.`,
    'Guarde este arquivo: ele é o seu comprovante fiscal.',
    '',
    'Qualquer dúvida, é só responder este e-mail.',
    '',
    'MetaBuilder PRO · AG Tech',
  ]
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;max-width:560px">`
    + `<p>${esc(hello)}</p>`
    + `<p>Segue em anexo a nota fiscal de serviço (NFS-e) referente ao seu pagamento de <b>${esc(moneyBr(d.amount))}</b>, emitida em ${esc(formatDateBr(d.issuedOn))}.</p>`
    + `<p>Guarde este arquivo: ele é o seu comprovante fiscal.</p>`
    + `<p>Qualquer dúvida, é só responder este e-mail.</p>`
    + `<p style="color:#666;font-size:12px">MetaBuilder PRO · AG Tech</p></div>`
  return { subject: subject.replace(/[\r\n]+/g, ' ').slice(0, 200), text: lines.join('\n'), html }
}

export interface NfseDigestData { late: number; today: number; soon: number }

/** Aviso diário à equipe: quantas notas pedem atenção. Devolve null se não há nada a avisar. */
export function nfseDigestMail(d: NfseDigestData): MailContent | null {
  if (d.late + d.today <= 0) return null
  const parts: string[] = []
  if (d.today) parts.push(`${d.today} para emitir hoje`)
  if (d.late) parts.push(`${d.late} atrasada(s)`)
  if (d.soon) parts.push(`${d.soon} nos próximos 2 dias`)
  const subject = `Notas fiscais: ${parts.join(', ')}`
  const text = `${parts.join('\n')}\n\nAbra o Painel de Controle PRO > Clientes > Notas Fiscais para emitir.`
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5"><p><b>Notas fiscais pedindo atenção</b></p><ul>${parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul><p>Abra o Painel de Controle PRO &gt; Clientes &gt; Notas Fiscais para emitir.</p></div>`
  return { subject, text, html }
}
