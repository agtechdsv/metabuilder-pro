import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'
import { parseRunReport, failureRecipients, failureEmail } from '@/lib/automations/runReport'

export const dynamic = 'force-dynamic'

// Tentativas com token errado, por origem: impede adivinhar o token do projeto
const failedAuth = new RateLimiter(10, 60_000)
// Execuções gravadas por projeto (um fluxo em loop não pode encher o banco)
const runsPerMinute = new RateLimiter(120, 60_000)
// Avisos por e-mail: no máximo 1 a cada 5 minutos por fluxo e 10 por hora por projeto
const mailPerWorkflow = new RateLimiter(1, 300_000)
const mailPerProject = new RateLimiter(10, 3_600_000)

const originOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip'

/**
 * POST /api/automations/runs — o Agente CLI reporta o resultado de cada execução de fluxo (autenticado pelo secret_token do projeto).
 * Grava em bpm_runs e, se falhou, avisa o e-mail configurado no módulo Automações (Studio).
 */
export async function POST(req: NextRequest) {
  try {
    const origin = originOf(req)
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
    const { project_id, token } = body || {}
    if (!project_id || !token || typeof project_id !== 'string' || typeof token !== 'string') {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios.' }, { status: 400 })
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', project_id)
      .eq('secret_token', token)
      .maybeSingle()
    if (projectError || !project) {
      if (!failedAuth.allow(origin)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 })
      return NextResponse.json({ error: 'Credenciais inválidas (secret_token).' }, { status: 401 })
    }

    if (!runsPerMinute.allow(project_id)) return NextResponse.json({ error: 'Limite de registros atingido. Tente novamente em instantes.' }, { status: 429 })

    const parsed = parseRunReport(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const run = parsed.run

    // o fluxo precisa ser deste projeto (id de outro projeto vira "sem fluxo", mas a execução é gravada)
    let workflowId = run.workflowId
    let workflowName = run.workflowName
    if (workflowId) {
      const { data: wf } = await supabase.from('bpm_workflows').select('id, name').eq('id', workflowId).eq('project_id', project_id).maybeSingle()
      if (wf) workflowName = workflowName || wf.name
      else workflowId = null
    }

    const { error: insertError } = await supabase.from('bpm_runs').insert({
      project_id,
      workflow_id: workflowId,
      workflow_name: workflowName,
      status: run.status,
      trigger_source: run.triggerSource,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      duration_ms: run.durationMs,
      error_message: run.errorMessage,
      details: run.details,
    })
    if (insertError) {
      console.error('[automations/runs] falha ao gravar a execução:', insertError.message)
      return NextResponse.json({ error: 'Não foi possível registrar a execução.' }, { status: 500 })
    }

    // aviso de falha por e-mail (erro ou loop). Falha no envio não derruba o registro.
    let notified = false
    if (run.status !== 'success') {
      const { data: automations } = await supabase.from('ui_views').select('layout_config').eq('project_id', project_id).eq('slug', 'automations').maybeSingle()
      const to = failureRecipients(automations?.layout_config)
      const key = `${project_id}:${workflowId || workflowName}`
      if (to.length > 0 && process.env.SMTP_HOST && mailPerWorkflow.allow(key) && mailPerProject.allow(project_id)) {
        try {
          const { subject, html } = failureEmail(project.name || '', { ...run, workflowId, workflowName })
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 465,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          })
          await transporter.sendMail({ from: `"MetaBuilder PRO" <${process.env.SMTP_USER}>`, to, subject, html })
          notified = true
        } catch (e: any) {
          console.error('[automations/runs] falha ao enviar o aviso por e-mail:', e?.message)
        }
      }
    }

    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error('[automations/runs] erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
