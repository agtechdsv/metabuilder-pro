'use server'

import nodemailer from 'nodemailer'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getOrCreateChatRoom, sendChatMessage } from '@/app/actions/community'
import {
  STACK_INTEREST_STACKS,
  fillStackTemplate,
  type StackInterestSummaryRow,
  type StackInterestUser,
  type StackMessageResult,
} from '@/lib/stackInterest'

const VALID_STACKS = new Set<string>(STACK_INTEREST_STACKS.map(s => s.id))

/** Só o super admin da plataforma pode ver o interesse de todos e enviar mensagens */
async function requireSuperAdmin(): Promise<{ id: string; name: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_super_admin, full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_super_admin) throw new Error('Acesso restrito ao administrador da plataforma')
  return { id: user.id, name: profile.full_name || 'Equipe MetaBuilder PRO' }
}

export async function getStackInterestSummary(): Promise<{ success: boolean; rows?: StackInterestSummaryRow[]; error?: string }> {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()
    const { data, error } = await admin.from('stack_interest').select('stack')
    if (error) throw error
    const counts = new Map<string, number>()
    for (const r of data || []) counts.set(r.stack, (counts.get(r.stack) || 0) + 1)
    return { success: true, rows: Array.from(counts, ([stack, total]) => ({ stack, total })) }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function getStackInterestUsers(stack: string): Promise<{ success: boolean; users?: StackInterestUser[]; error?: string }> {
  try {
    await requireSuperAdmin()
    if (!VALID_STACKS.has(stack)) throw new Error('Stack inválida')
    const admin = createAdminClient()
    const { data: rows, error } = await admin
      .from('stack_interest')
      .select('user_id, created_at')
      .eq('stack', stack)
      .order('created_at', { ascending: false })
    if (error) throw error
    const ids = (rows || []).map(r => r.user_id)
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id, full_name, email, avatar_url').in('id', ids)
      : { data: [] as any[] }
    const byId = new Map((profiles || []).map((p: any) => [p.id, p]))
    const users: StackInterestUser[] = (rows || []).map(r => {
      const p: any = byId.get(r.user_id)
      return {
        userId: r.user_id,
        name: p?.full_name || p?.email || 'Usuário',
        email: p?.email || null,
        avatarUrl: p?.avatar_url || null,
        createdAt: r.created_at,
      }
    })
    return { success: true, users }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Mesmo visual do e-mail de convite do owner para os devs (cabeçalho verde/azul, cartão central, botão verde) */
function buildEmailHtml(opts: { name: string; title: string; message: string; ctaLabel: string; ctaUrl: string }) {
  const body = escapeHtml(opts.message).replace(/\r?\n/g, '<br>')
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;margin:40px auto;background-color:#ffffff;border-radius:24px;overflow:hidden;">
    <tr><td style="padding:44px 40px;text-align:center;background:linear-gradient(135deg,#10b981 0%,#3b82f6 100%);">
      <h1 style="color:#ffffff;margin:0;font-size:30px;font-weight:900;letter-spacing:-0.5px;">MetaBuilder <span style="color:#a7f3d0;">PRO</span></h1>
    </td></tr>
    <tr><td style="padding:36px 40px 12px 40px;text-align:center;">
      <h2 style="color:#0f172a;margin:0 0 16px 0;font-size:24px;font-weight:800;">${escapeHtml(opts.title)}</h2>
      <p style="color:#475569;font-size:15px;line-height:24px;margin:0 0 20px 0;text-align:left;">Olá, <strong>${escapeHtml(opts.name)}</strong>!</p>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:22px 24px;margin:0 0 28px 0;text-align:left;color:#334155;font-size:15px;line-height:24px;">${body}</div>
      <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;background-color:#10b981;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;padding:16px 36px;border-radius:12px;">${escapeHtml(opts.ctaLabel)}</a>
    </td></tr>
    <tr><td style="padding:28px 40px 32px 40px;text-align:center;">
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px 0;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px 0;">© ${new Date().getFullYear()} MetaBuilder PRO</p>
      <p style="color:#cbd5e1;font-size:11px;margin:0;">Você recebeu este e-mail porque pediu para ser avisado sobre novidades na plataforma.</p>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Envia a mensagem aos interessados em uma stack: por e-mail (SMTP) e pelo chat do MetaBuilders.
 * `userIds` precisam estar de fato na lista de interessados dessa stack.
 */
export async function sendStackInterestMessage(input: {
  stack: string
  userIds: string[]
  subject: string
  message: string
}): Promise<{ success: boolean; results?: StackMessageResult[]; error?: string }> {
  try {
    await requireSuperAdmin()
    if (!VALID_STACKS.has(input.stack)) throw new Error('Stack inválida')
    const rawSubject = input.subject.trim()
    const rawMessage = input.message.trim()
    if (!rawSubject || !rawMessage) throw new Error('Informe o assunto e a mensagem')
    const stackLabel = STACK_INTEREST_STACKS.find(s => s.id === input.stack)?.label || input.stack
    if (!input.userIds.length) throw new Error('Nenhum destinatário')
    if (input.userIds.length > 500) throw new Error('Destinatários demais para um envio')

    const admin = createAdminClient()
    // Só quem realmente registrou interesse nesta stack
    const { data: interested, error } = await admin
      .from('stack_interest').select('user_id').eq('stack', input.stack).in('user_id', input.userIds)
    if (error) throw error
    const allowed = (interested || []).map(r => r.user_id)
    if (!allowed.length) throw new Error('Nenhum dos destinatários está na lista desta stack')
    const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', allowed)

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
    const smtpOk = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)
    const transporter = smtpOk
      ? nodemailer.createTransport({
          host: SMTP_HOST, port: Number(SMTP_PORT || 465), secure: Number(SMTP_PORT || 465) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        })
      : null
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://metabuilderpro.com'

    const results: StackMessageResult[] = []
    for (const p of profiles || []) {
      const name = p.full_name || p.email || 'Usuário'
      const vars = { nome: (p.full_name || '').trim().split(/\s+/)[0] || 'tudo bem', stack: stackLabel }
      const subject = fillStackTemplate(rawSubject, vars)
      const message = fillStackTemplate(rawMessage, vars)
      const r: StackMessageResult = { userId: p.id, name, email: { ok: false }, chat: { ok: false } }

      // E-mail
      if (!transporter) r.email.error = 'SMTP não configurado no servidor'
      else if (!p.email) r.email.error = 'Usuário sem e-mail'
      else {
        try {
          await transporter.sendMail({
            from: `"MetaBuilder PRO" <${SMTP_USER}>`,
            to: p.email,
            subject,
            html: buildEmailHtml({ name, title: subject, message, ctaLabel: 'Abrir o MetaBuilder PRO', ctaUrl: appUrl }),
          })
          r.email.ok = true
        } catch (e: any) { r.email.error = e.message || 'Falha no envio' }
      }

      // Chat do MetaBuilders (sala entre o administrador e o usuário)
      try {
        const room = await getOrCreateChatRoom(p.id)
        if (!room.success || !room.roomId) throw new Error(room.error || 'Não foi possível abrir a conversa')
        const sent = await sendChatMessage(room.roomId, `${subject}\n\n${message}`)
        if (!sent.success) throw new Error(sent.error || 'Falha ao enviar')
        r.chat.ok = true
      } catch (e: any) { r.chat.error = e.message || 'Falha no chat' }

      results.push(r)
    }
    return { success: true, results }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
