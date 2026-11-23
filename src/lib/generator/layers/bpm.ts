import type { AppAST, BpmExport, ModelNode } from '../ast'
import { BPM_RUNTIME_FILES } from '../bpmRuntimeFiles.generated'
import { bpmTableName } from '../bpmExport'

/**
 * Automações (BPM) no app Node exportado (docs/bpm-exportacao-desenho.md):
 *  - lib/bpm/core.js (+ .d.ts e modelos de e-mail): o MESMO núcleo que o Agente CLI usa (scripts/gen-bpm-runtime.mjs);
 *  - lib/bpm/workflows.json: retrato dos fluxos ativos no momento da geração;
 *  - lib/bpm/runtime.ts: liga as portas do núcleo ao banco do app, ao SMTP do cliente (.env), ao agendador e à tabela mb_bpm_runs;
 *  - instrumentation.ts: liga o agendador quando o servidor sobe; rota de webhook de entrada; ganchos nas ações de criar/editar/excluir.
 * Sem fluxos (ou em outra stack), NADA disto é gerado e o app fica idêntico ao de antes.
 */

export function generateBpmLayer(ast: AppAST, files: Map<string, string>) {
  const bpm = ast.bpm
  if (!bpm) return

  for (const [path, content] of Object.entries(BPM_RUNTIME_FILES)) files.set(path, content)

  files.set('lib/bpm/workflows.json', JSON.stringify({ models: bpm.models, workflows: bpm.flows }, null, 2))
  files.set('lib/bpm/runtime.ts', bpmRuntimeSource(bpm))
  files.set('instrumentation.ts', INSTRUMENTATION)
  if (bpm.hasWebhook) files.set('app/api/bpm/webhook/[workflowId]/route.ts', WEBHOOK_ROUTE)

  // dependências: e-mail (SMTP do cliente) e agendador
  const pkg = JSON.parse(files.get('package.json') ?? '{}')
  pkg.dependencies = { ...(pkg.dependencies || {}), nodemailer: '^6.9.15', 'node-cron': '^3.0.3' }
  pkg.devDependencies = { ...(pkg.devDependencies || {}), '@types/nodemailer': '^6.4.17', '@types/node-cron': '^3.0.11' }
  files.set('package.json', JSON.stringify(pkg, null, 2))
}

/** Ids dos fluxos ligados a botões (ações customizadas) em qualquer tela: só esses podem ser disparados pelo navegador. */
export function bpmLinkedFlowIds(ast: AppAST): string[] {
  const known = new Set((ast.bpm?.flows || []).map(f => f.id))
  const found = new Set<string>()
  const seen = new Set<any>()
  const walk = (v: any) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) { v.forEach(walk); return }
    for (const [k, val] of Object.entries(v)) {
      if (k === 'linkedBpmWorkflows' && Array.isArray(val)) val.forEach(id => { if (known.has(String(id))) found.add(String(id)) })
      else walk(val)
    }
  }
  walk(ast.routes)
  return [...found].sort()
}

const BUTTON_IMPORT = "import { runBpmAction } from '@/app/actions/bpm'\n"
const BUTTON_BRANCH = `    // botão ligado a fluxos de automação (BPM): roda no servidor do app e recarrega a tela
    if (action.linkedBpmWorkflows && action.linkedBpmWorkflows.length > 0) {
      runBpmAction(action.linkedBpmWorkflows, item?.id)
        .then(() => router.refresh())
        .catch((err: any) => alert(err?.message || 'Não foi possível executar a automação.'))
      return
    }

`

/**
 * Formulário: um "Antes de criar/editar" que bloqueia devolve { __bpmError: mensagem } (em produção o Next esconde a mensagem de um erro lançado
 * numa action); o formulário passa a mostrar essa mensagem no aviso de erro. Só mexe quando alguma tabela tem gatilho.
 */
function patchBpmForm(ast: AppAST, files: Map<string, string>) {
  if (!ast.bpm || ast.bpm.hookedTables.length === 0) return
  for (const [path, src] of files) {
    if (!path.endsWith('.tsx') || !src.includes('const created: any = await createAction(payload)')) continue
    const createLine = 'const created: any = await createAction(payload)\n'
    const updateLine = '      await updateAction(id, payload)\n'
    const next = src
      .replace(createLine, createLine + '        if (created && created.__bpmError) throw new Error(created.__bpmError)\n')
      .replace(updateLine, '      const updated: any = await updateAction(id, payload)\n      if (updated && updated.__bpmError) throw new Error(updated.__bpmError)\n')
    if (next !== src) files.set(path, next)
  }
}

/**
 * Botões (ações customizadas) ligados a fluxos BPM: o componente chama a action do servidor. Só mexe no botão quando algum botão está ligado
 * a um fluxo; sem isso, os componentes ficam idênticos aos de antes.
 */
export function patchBpmCustomActions(ast: AppAST, files: Map<string, string>) {
  patchBpmForm(ast, files)
  const ids = bpmLinkedFlowIds(ast)
  if (ids.length === 0) return
  files.set('app/actions/bpm.ts', `'use server'
// ARQUIVO GERADO pelo MetaBuilder — dispara os fluxos de automação (BPM) ligados a botões. Só os fluxos ligados a algum botão podem ser chamados.
import { runBpmCustomAction } from '@/lib/bpm/runtime'

const ALLOWED = new Set<string>(${JSON.stringify(ids)})

export async function runBpmAction(workflowIds: string[], recordId: unknown) {
  const ids = (Array.isArray(workflowIds) ? workflowIds : []).map(String).filter(id => ALLOWED.has(id))
  if (ids.length === 0) throw new Error('Automação indisponível.')
  // só o id do registro vem do navegador; o fluxo lê o registro do banco
  await runBpmCustomAction(ids, recordId === undefined || recordId === null ? {} : { id: recordId })
  return { success: true }
}
`)
  const path = 'components/ui/custom-action-button.tsx'
  let src = files.get(path)
  if (!src) return
  src = src.replace('  linkTarget?: string\n}', '  linkTarget?: string\n  linkedBpmWorkflows?: string[]\n}')
  const at = src.indexOf('    if (onClick) {\n      onClick(action, item)')
  if (at < 0 || !src.includes('linkedBpmWorkflows?: string[]')) return // forma inesperada: melhor sem o gancho do que quebrar o componente
  src = src.slice(0, at) + BUTTON_BRANCH + src.slice(at)
  const m = src.match(/^(['"]use client['"]\n)/)
  files.set(path, m ? m[1] + BUTTON_IMPORT + src.slice(m[1].length) : BUTTON_IMPORT + src)
}

/** Rotas públicas do proxy (o webhook de entrada tem o próprio segredo por fluxo, sem sessão). */
export function bpmPublicPaths(ast: AppAST): string[] {
  return ast.bpm?.hasWebhook ? ['/api/bpm/webhook'] : []
}

// ─────────────────────────────────────────────────────────────────────────────
// Ganchos nas ações de criar/editar/excluir
// ─────────────────────────────────────────────────────────────────────────────

const IMPORT_LINE = "import { bpmBefore, bpmAfter } from '@/lib/bpm/runtime'\n"

/**
 * Embrulha create/update/delete da tabela com os gatilhos do BPM: "Antes de..." roda ANTES de gravar (pode bloquear com mensagem ou mudar os
 * dados) e "Ao criar/editar/excluir" roda DEPOIS, sem atrasar nem derrubar a gravação. Só as tabelas que algum fluxo escuta ganham isto.
 */
export function applyBpmHooks(content: string, model: ModelNode, bpm: BpmExport | undefined): string {
  if (!bpm) return content
  const table = bpmTableName(model.dbTable)
  if (!bpm.hookedTables.includes(table)) return content
  const oracle = bpm.dialect === 'oracle'
  const M = model.name
  const pk = model.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const tableRef = oracle
    ? `"${model.dbTable}"`
    : model.dbTable.includes('.') ? model.dbTable.split('.').map(p => `"${p}"`).join('.') : `"${model.dbTable}"`

  let out = content
  for (const kind of ['create', 'update', 'delete']) {
    const sig = `export async function ${kind}${M}(`
    const at = out.indexOf(sig)
    if (at < 0) return content // forma inesperada da ação: não mexe (melhor sem gancho do que quebrar o app)
    out = out.slice(0, at) + `async function __bpm_${kind}${M}(` + out.slice(at + sig.length)
  }

  const fetchRow = oracle
    ? `const rows: any[] = await query('SELECT * FROM ${tableRef} WHERE "${pk}" = :1', [id]); return rows[0] || null`
    : `const res = await query('SELECT * FROM ${tableRef} WHERE "${pk}" = $1', [id]); return res.rows[0] || null`

  out += `
// ── Automações (BPM): gatilhos da tabela ${table} ──
const __bpmTable = ${JSON.stringify(table)}

async function __bpmRow(id: any): Promise<Record<string, any> | null> {
  try { ${fetchRow} } catch { return null }
}

export async function create${M}(formData: FormData | Record<string, any>) {
  // "Antes de criar": o fluxo pode bloquear ou mudar os dados. O bloqueio volta como resultado (o navegador não vê a mensagem de um erro lançado em produção)
  let b: { data: Record<string, any>; message: string | null }
  try { b = await bpmBefore(__bpmTable, 'INSERT', parsePayload(formData)) } catch (err: any) { return { __bpmError: err?.message || 'Ação bloqueada pelo fluxo.' } as any }
  const res: any = await __bpm_create${M}(b.data)
  const newId = res ? res[${JSON.stringify(pk)}] : undefined
  const full = newId != null ? await __bpmRow(newId) : null
  bpmAfter(__bpmTable, 'INSERT', full || { ...b.data, ...(res || {}) })
  return res
}

export async function update${M}(id: string, formData: FormData | Record<string, any>) {
  const parsed = parsePayload(formData)
  if (Object.keys(parsed).length === 0) return __bpm_update${M}(id, parsed)
  const before = (await __bpmRow(id)) || {}
  const merged: Record<string, any> = { ...before, ...parsed }
  // "Antes de editar": o fluxo vê o registro inteiro (o atual com as mudanças) e pode bloquear ou mudar campos
  let b: { data: Record<string, any>; message: string | null }
  try { b = await bpmBefore(__bpmTable, 'UPDATE', merged) } catch (err: any) { return { __bpmError: err?.message || 'Ação bloqueada pelo fluxo.' } as any }
  const out: Record<string, any> = { ...parsed }
  for (const k of Object.keys(b.data)) if (b.data[k] !== merged[k] && allowedColumns.has(k)) out[k] = b.data[k]
  const res: any = await __bpm_update${M}(id, out)
  bpmAfter(__bpmTable, 'UPDATE', (await __bpmRow(id)) || b.data)
  return res
}

export async function delete${M}(id: string) {
  const before = await __bpmRow(id)
  try {
    // "Antes de excluir": o fluxo pode bloquear a exclusão
    await bpmBefore(__bpmTable, 'DELETE', before || { ${JSON.stringify(pk)}: id })
  } catch (err: any) {
    return { success: false, error: err?.message || 'Exclusão bloqueada pelo fluxo.' }
  }
  const res: any = await __bpm_delete${M}(id)
  if (res && res.success) bpmAfter(__bpmTable, 'DELETE', before || { ${JSON.stringify(pk)}: id })
  return res
}
`
  // o import vem logo depois do 'use server'
  const m = out.match(/^(['"]use server['"]\n)/)
  return m ? m[1] + IMPORT_LINE + out.slice(m[1].length) : IMPORT_LINE + out
}

// ─────────────────────────────────────────────────────────────────────────────
// instrumentation.ts e rota de webhook
// ─────────────────────────────────────────────────────────────────────────────

const INSTRUMENTATION = `// ARQUIVO GERADO pelo MetaBuilder — liga as automações (BPM) agendadas quando o servidor sobe.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBpm } = await import('@/lib/bpm/runtime')
    await startBpm()
  }
}
`

const WEBHOOK_ROUTE = `// ARQUIVO GERADO pelo MetaBuilder — webhook de entrada das automações (BPM).
// O segredo do fluxo vem em "Authorization: Bearer <segredo>" ou "X-Webhook-Secret" (nunca na URL). Sem segredo configurado no fluxo, não aceita chamadas.
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { findBpmWebhook, runBpmWebhook } from '@/lib/bpm/runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024
const MAX_FIELDS = 100

function secretMatches(presented: string | null, storedHash: string | null): boolean {
  if (!presented || !storedHash || !/^[0-9a-f]{64}$/i.test(storedHash)) return false
  const a = Buffer.from(createHash('sha256').update(presented).digest('hex'), 'hex')
  const b = Buffer.from(storedHash.toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function presentedSecret(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  const m = auth ? /^Bearer\\s+(.+)$/i.exec(auth.trim()) : null
  if (m) return m[1].trim()
  const custom = req.headers.get('x-webhook-secret')
  return custom ? custom.trim() : null
}

/** Objeto plano para {{webhook.campo}}: só chaves simples, valores primitivos e com limites. */
function toFlowData(input: unknown): Record<string, any> {
  const out: Record<string, any> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  let count = 0
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_FIELDS) break
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) continue
    if (value === null || typeof value === 'number' || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'string') out[key] = value.slice(0, 4000)
    else out[key] = JSON.stringify(value).slice(0, 4000)
    count++
  }
  return out
}

async function handle(req: NextRequest, ctx: { params: Promise<{ workflowId: string }> }, method: 'GET' | 'POST') {
  const { workflowId } = await ctx.params
  const hook = findBpmWebhook(workflowId)
  if (!hook) return NextResponse.json({ error: 'Fluxo não encontrado.' }, { status: 404 })
  if (hook.method !== method) return NextResponse.json({ error: 'Método não permitido para este fluxo.' }, { status: 405 })
  if (!secretMatches(presentedSecret(req), hook.secretHash)) return NextResponse.json({ error: 'Segredo inválido.' }, { status: 401 })

  let data: Record<string, any> = {}
  if (method === 'GET') {
    data = toFlowData(Object.fromEntries(req.nextUrl.searchParams.entries()))
  } else {
    const text = await req.text()
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return NextResponse.json({ error: 'Corpo grande demais.' }, { status: 413 })
    if (text.trim()) {
      try { data = toFlowData(JSON.parse(text)) } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }
    }
  }

  await runBpmWebhook(workflowId, data)
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ workflowId: string }> }) { return handle(req, ctx, 'POST') }
export async function GET(req: NextRequest, ctx: { params: Promise<{ workflowId: string }> }) { return handle(req, ctx, 'GET') }
`

// ─────────────────────────────────────────────────────────────────────────────
// lib/bpm/runtime.ts
// ─────────────────────────────────────────────────────────────────────────────

function bpmRuntimeSource(bpm: BpmExport): string {
  const oracle = bpm.dialect === 'oracle'
  const rows = oracle ? '(res || [])' : '(res.rows || [])'
  const ensure = oracle
    ? `[
  "BEGIN EXECUTE IMMEDIATE 'CREATE TABLE mb_bpm_runs (id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, workflow_id VARCHAR2(100), workflow_name VARCHAR2(300), status VARCHAR2(20), trigger_source VARCHAR2(200), started_at TIMESTAMP, finished_at TIMESTAMP, duration_ms NUMBER, error_message VARCHAR2(2000), details CLOB)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;",
  "BEGIN EXECUTE IMMEDIATE 'CREATE TABLE mb_bpm_locks (name VARCHAR2(300) PRIMARY KEY, created_at TIMESTAMP DEFAULT SYSTIMESTAMP)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;",
]`
    : `[
  'CREATE TABLE IF NOT EXISTS mb_bpm_runs (id bigserial PRIMARY KEY, workflow_id text, workflow_name text, status text, trigger_source text, started_at timestamptz, finished_at timestamptz, duration_ms integer, error_message text, details jsonb)',
  'CREATE TABLE IF NOT EXISTS mb_bpm_locks (name text PRIMARY KEY, created_at timestamptz DEFAULT now())',
]`
  const insertRun = oracle
    ? `await dbQuery('INSERT INTO mb_bpm_runs (workflow_id, workflow_name, status, trigger_source, started_at, finished_at, duration_ms, error_message, details) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)', [r.workflow_id, r.workflow_name, r.status, r.trigger_source, new Date(r.started_at), new Date(r.finished_at), r.duration_ms, r.error_message ? String(r.error_message).slice(0, 2000) : null, JSON.stringify(r.details || {})])`
    : `await dbQuery('INSERT INTO mb_bpm_runs (workflow_id, workflow_name, status, trigger_source, started_at, finished_at, duration_ms, error_message, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)', [r.workflow_id, r.workflow_name, r.status, r.trigger_source, r.started_at, r.finished_at, r.duration_ms, r.error_message || null, JSON.stringify(r.details || {})])`
  const acquire = oracle
    ? `try { await dbQuery('INSERT INTO mb_bpm_locks (name) VALUES (:1)', [name]); return true } catch { return false }`
    : `const rows = await dbQuery('INSERT INTO mb_bpm_locks (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING name', [name]); return rows.length > 0`
  const cleanup = oracle
    ? `await dbQuery("DELETE FROM mb_bpm_runs WHERE started_at < SYSTIMESTAMP - NUMTODSINTERVAL(:1, 'DAY')", [days])
    await dbQuery("DELETE FROM mb_bpm_locks WHERE created_at < SYSTIMESTAMP - NUMTODSINTERVAL(1, 'DAY')", [])`
    : `await dbQuery('DELETE FROM mb_bpm_runs WHERE started_at < now() - make_interval(days => $1)', [days])
    await dbQuery("DELETE FROM mb_bpm_locks WHERE created_at < now() - interval '1 day'", [])`

  return `// ARQUIVO GERADO pelo MetaBuilder — automações (BPM) do app: liga o núcleo (lib/bpm/core.js, o mesmo do Agente CLI) ao banco do app,
// ao SMTP do cliente (.env), ao agendador e ao registro de execuções (tabela mb_bpm_runs, criada sozinha na primeira execução).
// Os fluxos são um RETRATO (lib/bpm/workflows.json): o app só muda quando o projeto é exportado/sincronizado de novo.
import * as nodemailer from 'nodemailer'
import * as cron from 'node-cron'
import { query } from '@/app/actions/db'
import { BpmCore } from './core'
import { wrapEmailInTemplate } from './emailTemplates'
import data from './workflows.json'

const g = globalThis as any
const WORKFLOWS: any[] = (data as any).workflows || []
const MODELS: Record<string, string> = (data as any).models || {}
const KNOWN_TABLES = new Set(Object.values(MODELS))

async function dbQuery(sql: string, params: any[] = []): Promise<any[]> {
  const res: any = await query(sql, params)
  return ${rows}
}

// ── tabelas de apoio (criadas sozinhas) ──
function ensureTables(): Promise<void> {
  if (!g.__mbBpmTables) {
    g.__mbBpmTables = (async () => {
      for (const sql of ${ensure}) await dbQuery(sql, [])
    })().catch((e: any) => { g.__mbBpmTables = null; throw e })
  }
  return g.__mbBpmTables
}

// ── e-mail (SMTP do cliente, no .env) ──
async function sendMail(msg: { to: string; subject: string; body: string; template: string }) {
  const host = process.env.SMTP_HOST
  if (!host) throw new Error('SMTP não configurado: defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASSWORD no .env.')
  if (!g.__mbBpmMailer) {
    const port = Number(process.env.SMTP_PORT || 587)
    g.__mbBpmMailer = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } : undefined,
    })
  }
  await g.__mbBpmMailer.sendMail({
    from: process.env.BPM_MAIL_FROM || process.env.SMTP_USER,
    to: msg.to,
    subject: msg.subject,
    html: wrapEmailInTemplate(msg.template, msg.body),
  })
}

// ── agendador: só liga em startBpm() e só uma instância executa cada disparo (trava na tabela mb_bpm_locks) ──
async function acquireLock(name: string): Promise<boolean> {
  try {
    await ensureTables()
    ${acquire}
  } catch (e: any) {
    console.error('[BPM] Não foi possível obter a trava do agendamento:', e?.message)
    return false
  }
}

const scheduler = {
  schedule(expr: string, fn: () => any) {
    if (!g.__mbBpmSchedulerOn || process.env.BPM_SCHEDULER === 'off') return { stop() {} }
    const seq = g.__mbBpmSchedSeq = (g.__mbBpmSchedSeq || 0) + 1
    const task = cron.schedule(expr, async () => {
      const key = 'sched#' + seq + ':' + expr + ':' + new Date().toISOString().slice(0, 16)
      if (await acquireLock(key)) await fn()
    }, { timezone: process.env.BPM_TIMEZONE || 'America/Sao_Paulo' })
    return { stop: () => task.stop() }
  },
}

// ── núcleo ──
export function getBpm(): BpmCore {
  if (!g.__mbBpm) {
    g.__mbBpm = new BpmCore({
      db: { dialect: ${JSON.stringify(bpm.dialect)}, query: dbQuery },
      models: { tableOf: async (id: string) => MODELS[id] || null, isKnownTable: async (name: string) => KNOWN_TABLES.has(name) },
      http: {
        async request(cfg: any) {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), cfg.timeout || 10000)
          try {
            const hasBody = cfg.data !== undefined && cfg.data !== null
            const headers: Record<string, string> = { ...(cfg.headers || {}) }
            if (hasBody && typeof cfg.data !== 'string' && !Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json'
            const res = await fetch(cfg.url, { method: cfg.method, headers, body: hasBody ? (typeof cfg.data === 'string' ? cfg.data : JSON.stringify(cfg.data)) : undefined, signal: ctrl.signal, redirect: 'follow' })
            if (!res.ok) { const e: any = new Error('HTTP ' + res.status); e.status = res.status; throw e }
            return { status: res.status, statusText: res.statusText }
          } finally {
            clearTimeout(timer)
          }
        },
      },
      mail: { send: sendMail, fallbackTo: () => process.env.BPM_MAIL_FALLBACK || process.env.SMTP_USER || '' },
      scheduler,
      runs: {
        async report(r: any) {
          await ensureTables()
          ${insertRun}
          if (r.status !== 'success' && process.env.BPM_ERROR_EMAIL) {
            sendMail({ to: process.env.BPM_ERROR_EMAIL, subject: 'Falha na automação: ' + r.workflow_name, body: 'O fluxo "' + r.workflow_name + '" terminou com status ' + r.status + '.<br/>' + String(r.error_message || ''), template: 'alert' })
              .catch((e: any) => console.error('[BPM] Não foi possível enviar o aviso de falha:', e?.message))
          }
        },
      },
      log: {
        info: (m: string) => console.log(m),
        ok: (m: string) => console.log(m),
        warn: (m: string) => console.warn(m),
        error: (m: string) => console.error(m),
      },
      // modo mínimo: os dados dos registros (dados pessoais) não vão para o log; BPM_VERBOSE=1 liga o modo detalhado
      verbose: process.env.BPM_VERBOSE === '1',
    })
    g.__mbBpm.setWorkflows(WORKFLOWS)
  }
  return g.__mbBpm as BpmCore
}

/** "Antes de..." roda antes de gravar: se o fluxo bloqueia, lança erro com a mensagem dele; senão devolve os dados (possivelmente mudados pelo fluxo). */
export async function bpmBefore(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', row: Record<string, any>): Promise<{ data: Record<string, any>; message: string | null }> {
  const r = await getBpm().processSyncEvent(table, 'BEFORE_' + type, row)
  if (!r.success) throw new Error(r.error || 'Ação bloqueada pelo fluxo.')
  return { data: r.data, message: r.message }
}

/** "Ao criar/editar/excluir": depois de gravar, sem atrasar nem derrubar a gravação. */
export function bpmAfter(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', row: Record<string, any>): void {
  getBpm().processEvent(table, type, row).catch((e: any) => console.error('[BPM] Erro ao processar ' + type + ':', e?.message))
}

/** O gatilho de webhook de entrada do fluxo (segredo guardado só como hash SHA-256). */
export function findBpmWebhook(workflowId: string): { secretHash: string | null; method: 'GET' | 'POST' } | null {
  const flow = WORKFLOWS.find(w => w.id === workflowId)
  for (const node of flow?.flow_data?.nodes || []) {
    if (node?.type !== 'trigger') continue
    const raw = node.data?.triggerType
    const types: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((t: any) => String(t).toLowerCase())
    if (!types.includes('webhook')) continue
    return {
      secretHash: typeof node.data?.triggerWebhookSecretHash === 'string' ? node.data.triggerWebhookSecretHash : null,
      method: String(node.data?.triggerWebhookMethod || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST',
    }
  }
  return null
}

/** Botão ligado a fluxos: cada fluxo roda com a tabela do próprio gatilho (é dela que vêm as variáveis {{tabela.campo}}). */
export async function runBpmCustomAction(workflowIds: string[], row: Record<string, any>): Promise<void> {
  for (const id of workflowIds) {
    const flow = WORKFLOWS.find(w => w.id === id)
    const trigger = (flow?.flow_data?.nodes || []).find((n: any) => n?.type === 'trigger')
    const table = trigger ? MODELS[trigger.data?.triggerModelId] : undefined
    await getBpm().processCustomAction([id], table || '', row)
  }
}

export async function runBpmWebhook(workflowId: string, payload: Record<string, any>): Promise<void> {
  await getBpm().processWebhook(workflowId, payload)
}

/** Liga os agendamentos (chamado pelo instrumentation.ts quando o servidor sobe) e a limpeza diária do histórico. */
export async function startBpm(): Promise<void> {
  if (g.__mbBpmStarted) return
  g.__mbBpmStarted = true
  const bpm = getBpm()
  if (process.env.BPM_SCHEDULER !== 'off') {
    g.__mbBpmSchedulerOn = true
    g.__mbBpmSchedSeq = 0
    bpm.setWorkflows(WORKFLOWS)
  }
  const days = Math.max(1, Number(process.env.BPM_RUNS_RETENTION_DAYS || 30))
  const cleanup = async () => {
    try {
      await ensureTables()
      ${cleanup}
    } catch (e: any) {
      console.error('[BPM] Limpeza do histórico falhou:', e?.message)
    }
  }
  setTimeout(cleanup, 30_000).unref?.()
  setInterval(cleanup, 24 * 60 * 60 * 1000).unref?.()
}
`
}
