import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { applyExportProgress } from '../exportProgress'
import { verifyCommandSignature, signCommand } from '../commandSigning'

const req = createRequire(import.meta.url)
const cli = req('../../../../cli/security.js') as any
const { createProgressReporter } = req('../../../../cli/progressReporter.js') as any

const PID = '123e4567-e89b-42d3-a456-426614174000'
const JOB = '8f14e45f-ceea-467a-9575-e6c1a1b7c0aa'
const SECRET = 'segredo-do-projeto-0123456789abcdef'

/** Cliente de mentira: guarda o que foi gravado e devolve `rows` linhas atingidas. */
function fakeClient(rows = [{ id: JOB }]) {
  const calls: any = { update: null, filters: [] as any[] }
  const q: any = {
    eq: (k: string, v: any) => { calls.filters.push([k, v]); return q },
    in: (k: string, v: any) => { calls.filters.push([k, v]); return q },
    select: async () => ({ data: rows, error: null }),
  }
  return { calls, client: { from: () => ({ update: (u: any) => { calls.update = u; return q } }) } as any }
}
const base = (over: any = {}) => ({ jobId: JOB, status: 'completed', progress: 100, localPath: 'C:\\x\\a.xlsx', fileName: 'a.xlsx', recordCount: 2, ...over })
const run = (command: any, deps: any = {}) => applyExportProgress(PID, command, { token: async () => SECRET, seen: new Map(), ...deps })

describe('assinatura de quem chama o servidor', () => {
  it('o servidor confere a assinatura feita pelo CLI (mesmo formato nos dois lados)', () => {
    const cmd = cli.signCommand(SECRET, 'export_progress', PID, { jobId: JOB, status: 'completed' })
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, cmd).ok).toBe(true)
  })

  it('recusa assinatura errada, outro projeto, outro evento, hora fora da janela e repetição', () => {
    const cmd = signCommand(SECRET, 'export_progress', PID, { jobId: JOB, status: 'completed' })
    expect(verifyCommandSignature('outro-token-0123456789abcdef', 'export_progress', PID, cmd)).toEqual({ ok: false, reason: 'bad_signature' })
    expect(verifyCommandSignature(SECRET, 'export_progress', '99999999-9999-4999-8999-999999999999', cmd).ok).toBe(false)
    expect(verifyCommandSignature(SECRET, 'sql_query', PID, cmd).ok).toBe(false)
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, { ...cmd, status: 'failed' }).ok).toBe(false)
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, cmd, { now: cmd.ts + 3_600_000 })).toEqual({ ok: false, reason: 'expired' })
    const seen = new Map<string, number>()
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, cmd, { seen }).ok).toBe(true)
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, cmd, { seen })).toEqual({ ok: false, reason: 'replay' })
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, { jobId: JOB }).ok).toBe(false)
  })
})

describe('aviso de andamento da exportação', () => {
  it('conclusão assinada grava só os campos de andamento, no job DAQUELE projeto', async () => {
    const f = fakeClient()
    const r = await run(signCommand(SECRET, 'export_progress', PID, base()), { client: f.client })
    expect(r).toEqual({ ok: true })
    expect(f.calls.update).toMatchObject({ status: 'completed', progress: 100, local_path: 'C:\\x\\a.xlsx', file_name: 'a.xlsx', record_count: 2 })
    expect(f.calls.filters).toContainEqual(['id', JOB])
    expect(f.calls.filters).toContainEqual(['project_id', PID])
    // nada além dos campos de andamento
    expect(Object.keys(f.calls.update).sort()).toEqual(['file_name', 'local_path', 'progress', 'record_count', 'status', 'updated_at'])
  })

  it('não aceita campos extras (user_id, project_id) nem status inventado', async () => {
    const f = fakeClient()
    await run(signCommand(SECRET, 'export_progress', PID, base({ user_id: 'x', project_id: 'y', file_url: 'z' })), { client: f.client })
    expect(f.calls.update.user_id).toBeUndefined()
    expect(f.calls.update.project_id).toBeUndefined()
    expect(f.calls.update.file_url).toBeUndefined()
    expect(await run(signCommand(SECRET, 'export_progress', PID, base({ status: 'pending' })), { client: fakeClient().client })).toMatchObject({ ok: false, status: 400 })
    expect(await run(signCommand(SECRET, 'export_progress', PID, base({ jobId: 'abc' })), { client: fakeClient().client })).toMatchObject({ ok: false, status: 400 })
  })

  it('andamento não volta atrás: "processando" só atinge jobs ainda em andamento; falha grava a mensagem curta', async () => {
    const f = fakeClient()
    await run(signCommand(SECRET, 'export_progress', PID, { jobId: JOB, status: 'processing', progress: 150 }), { client: f.client })
    expect(f.calls.update.progress).toBe(100)
    expect(f.calls.filters).toContainEqual(['status', ['pending', 'processing']])
    const g = fakeClient()
    await run(signCommand(SECRET, 'export_progress', PID, { jobId: JOB, status: 'failed', error: 'x'.repeat(2000) }), { client: g.client })
    expect(g.calls.update.error_message).toHaveLength(500)
  })

  it('sem assinatura válida, sem projeto ou sem job: recusa', async () => {
    expect(await run({ jobId: JOB, status: 'completed' })).toMatchObject({ ok: false, status: 401 })
    expect(await run(signCommand('outro-0123456789abcdef', 'export_progress', PID, base()))).toMatchObject({ ok: false, status: 401 })
    expect(await applyExportProgress('lixo', {}, {})).toMatchObject({ ok: false, status: 400 })
    expect(await run(signCommand(SECRET, 'export_progress', PID, base()), { client: fakeClient([]).client })).toMatchObject({ ok: false, status: 404 })
    expect(await applyExportProgress(PID, signCommand(SECRET, 'export_progress', PID, base()), { token: async () => null })).toMatchObject({ ok: false, status: 404 })
  })
})

describe('Agente: reporta ao servidor e só cai na gravação direta se o servidor não responder', () => {
  const direct = () => { const u: any[] = []; return { u, supabase: { from: () => ({ update: (x: any) => { u.push(x); return { eq: async () => ({ error: null }) } } }) } } }

  it('manda o aviso ASSINADO para /api/export/progress e não grava direto', async () => {
    const d = direct()
    const post = vi.fn(async () => ({ ok: true, status: 200 }))
    const report = createProgressReporter({ apiBase: 'https://app.exemplo.com/api/metadata/sync', projectId: PID, secretToken: SECRET, supabase: d.supabase, fetchImpl: post })
    expect(await report(JOB, { status: 'completed', fileName: 'a.xlsx', recordCount: 2 })).toBe(true)
    const [url, init] = post.mock.calls[0] as any
    expect(url).toBe('https://app.exemplo.com/api/export/progress')
    const body = JSON.parse(init.body)
    expect(body.projectId).toBe(PID)
    expect(verifyCommandSignature(SECRET, 'export_progress', PID, body.command).ok).toBe(true)
    expect(JSON.stringify(body)).not.toContain(SECRET)
    expect(d.u).toHaveLength(0)
  })

  it('servidor fora do ar ou sem a rota: usa a gravação direta (compatibilidade)', async () => {
    const d = direct()
    const report = createProgressReporter({ apiBase: 'https://x', projectId: PID, secretToken: SECRET, supabase: d.supabase, fetchImpl: async () => { throw new Error('rede') } })
    expect(await report(JOB, { status: 'processing', progress: 40 })).toBe(true)
    expect(d.u[0]).toMatchObject({ status: 'processing', progress: 40 })
    const notFound = createProgressReporter({ apiBase: 'https://x', projectId: PID, secretToken: SECRET, supabase: d.supabase, fetchImpl: async () => ({ ok: false, status: 404 }) })
    await notFound(JOB, { status: 'failed', error: 'x' })
    expect(d.u[1]).toMatchObject({ status: 'failed', error_message: 'x' })
  })
})
