import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyAutomationDownload, cleanFileName, AUTOMATION_DOWNLOAD_EVENT, MAX_DOWNLOAD_RECIPIENTS } from '../automationDownload'
import { signCommand, verifyCommandSignature } from '../commandSigning'
import { deletableLocalPaths } from '../../downloads/sharedFiles'

const req = createRequire(import.meta.url)
const { createDownloadDelivery, EVENT } = req('../../../../cli/automationDownload.js') as any

const PID = '123e4567-e89b-42d3-a456-426614174000'
const SECRET = 'segredo-do-projeto-0123456789abcdef'
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

/** Cliente de mentira: projeto -> workspace e o que foi inserido em download_jobs. */
function fakeClient(over: { project?: any; workspace?: any; insertError?: boolean } = {}) {
  const calls: any = { inserted: null as any }
  const client: any = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === 'projects' ? (over.project ?? { workspace_id: 'w1' }) : (over.workspace ?? { slug: 'kika-projetos' }), error: null }) }),
      }),
      insert: (rows: any[]) => { calls.inserted = rows; return { select: async () => (over.insertError ? { data: null, error: { message: 'x' } } : { data: rows.map((_, i) => ({ id: 'j' + i })), error: null }) } },
    }),
  }
  return { calls, client }
}
const payload = (over: any = {}) => ({ recipients: [U1, U2], fileName: 'Pedidos.xlsx', fileType: 'xlsx', recordCount: 7, localPath: 'C:\\Exports\\2026_ab_Pedidos.xlsx', title: 'Automação: Relatório', ...over })
const run = (command: any, deps: any = {}) => applyAutomationDownload(PID, command, { token: async () => SECRET, seen: new Map(), ...deps })

describe('servidor: registra o arquivo da ação Download na Central de cada destinatário', () => {
  it('uma linha por destinatário, concluída, com o mesmo arquivo e o workspace do projeto', async () => {
    const { calls, client } = fakeClient()
    const r = await run(signCommand(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, payload()), { client })
    expect(r).toEqual({ ok: true, delivered: 2 })
    expect(calls.inserted).toHaveLength(2)
    expect(calls.inserted.map((x: any) => x.user_id)).toEqual([U1, U2])
    for (const row of calls.inserted) {
      expect(row).toMatchObject({ workspace_slug: 'kika-projetos', project_id: PID, view_name: 'Automação: Relatório', file_name: 'Pedidos.xlsx', file_type: 'xlsx', progress: 100, status: 'completed', record_count: 7, local_path: 'C:\\Exports\\2026_ab_Pedidos.xlsx' })
    }
  })

  it('o CLI e o servidor concordam no formato da assinatura e no evento', () => {
    expect(EVENT).toBe(AUTOMATION_DOWNLOAD_EVENT)
    const cmd = req('../../../../cli/security.js').signCommand(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, payload())
    expect(verifyCommandSignature(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, cmd).ok).toBe(true)
  })

  it('recusa assinatura errada, outro evento, adulteração e repetição (replay)', async () => {
    const { client } = fakeClient()
    const cmd = signCommand(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, payload())
    expect(await run(cmd, { client, token: async () => 'outro-token-0123456789abcdef' })).toMatchObject({ ok: false, status: 401 })
    expect(await run(signCommand(SECRET, 'export_progress', PID, payload()), { client })).toMatchObject({ ok: false, status: 401 })
    expect(await run({ ...cmd, recipients: [U1, U2, '33333333-3333-4333-8333-333333333333'] }, { client })).toMatchObject({ ok: false, status: 401 })
    const seen = new Map<string, number>()
    expect(await run(cmd, { client, seen })).toMatchObject({ ok: true })
    expect(await run(cmd, { client, seen })).toMatchObject({ ok: false, status: 401 })
  })

  it('valida os destinatários (UUID, sem repetir, até o limite) e os campos', async () => {
    const { calls, client } = fakeClient()
    const sign = (over: any) => signCommand(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, payload(over))
    expect(await run(sign({ recipients: [U1, U1, U2] }), { client })).toEqual({ ok: true, delivered: 2 })
    expect(calls.inserted).toHaveLength(2)
    for (const bad of [{ recipients: [] }, { recipients: 'x' }, { recipients: [U1, '42'] }, { recipients: [U1, "x'; drop table"] }, { fileType: 'exe' }, { fileType: undefined }, { fileName: '' }, { fileName: '...' }, { localPath: '' }, { localPath: 'a\0b' }]) {
      expect(await run(sign(bad), { client })).toMatchObject({ ok: false, status: 400 })
    }
    const many = Array.from({ length: MAX_DOWNLOAD_RECIPIENTS + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(await run(sign({ recipients: many }), { client })).toMatchObject({ ok: false, status: 400 })
  })

  it('o nome do arquivo é limpo no servidor também (sem caminho, sem ponto no começo)', () => {
    expect(cleanFileName('../etc/passwd')).toBe('_etc_passwd')
    expect(cleanFileName('Relatório 1.xlsx')).toBe('Relat_rio_1.xlsx')
    expect(cleanFileName(5)).toBe('')
  })

  it('projeto ou workspace que não existem, e erro ao gravar, dão erro claro', async () => {
    const cmd = () => signCommand(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, payload())
    expect(await run(cmd(), { client: fakeClient({ project: { workspace_id: null } }).client })).toMatchObject({ ok: false, status: 404 })
    expect(await run(cmd(), { client: fakeClient({ workspace: { slug: null } }).client })).toMatchObject({ ok: false, status: 404 })
    expect(await run(cmd(), { client: fakeClient({ insertError: true }).client })).toMatchObject({ ok: false, status: 502 })
    expect(await applyAutomationDownload('nao-e-uuid', cmd(), { token: async () => SECRET })).toMatchObject({ ok: false, status: 400 })
    expect(await run(cmd(), { client: fakeClient().client, token: async () => null })).toMatchObject({ ok: false, status: 404 })
  })
})

describe('Agente CLI: grava o arquivo na pasta de exportações e avisa o servidor', () => {
  const dataset = { name: 'pedidos', columns: [{ key: 'id', label: 'Pedido', type: 'integer' }], rows: [{ id: 1 }, { id: 2 }] }
  const mkdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mbdl-'))

  it('grava o arquivo (nome único) e manda o comando ASSINADO que o servidor aceita', async () => {
    const dir = mkdir()
    const sent: any[] = []
    const deliver = createDownloadDelivery({ apiBase: 'https://x.test/api/metadata/sync', projectId: PID, secretToken: SECRET, downloadPath: dir, post: async (url: string, body: string) => { sent.push({ url, body: JSON.parse(body) }); return { ok: true, status: 200, data: { delivered: 2 } } } })
    const r = await deliver({ dataset, format: 'json', fileName: 'Pedidos.json', recipientIds: [U1, U2], title: 'Automação: x' })
    expect(r).toEqual({ delivered: 2 })
    expect(sent[0].url).toBe('https://x.test/api/automations/download')
    const { projectId, command } = sent[0].body
    expect(projectId).toBe(PID)
    expect(verifyCommandSignature(SECRET, AUTOMATION_DOWNLOAD_EVENT, PID, command).ok).toBe(true)
    expect(command).toMatchObject({ recipients: [U1, U2], fileName: 'Pedidos.json', fileType: 'json', recordCount: 2, title: 'Automação: x' })
    // o arquivo existe dentro da pasta, com nome único, e tem o conteúdo certo
    expect(command.localPath.startsWith(dir)).toBe(true)
    expect(path.basename(command.localPath)).toMatch(/^\d{14}_[0-9a-f]{6}_Pedidos\.json$/)
    expect(JSON.parse(fs.readFileSync(command.localPath, 'utf8'))).toEqual([{ Pedido: 1 }, { Pedido: 2 }])
    // o que o servidor valida de fato aceita este comando
    const { client } = fakeClient()
    expect(await applyAutomationDownload(PID, command, { token: async () => SECRET, client, seen: new Map() })).toEqual({ ok: true, delivered: 2 })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('duas entregas com o mesmo nome não se sobrescrevem', async () => {
    const dir = mkdir()
    const deliver = createDownloadDelivery({ apiBase: 'https://x.test', projectId: PID, secretToken: SECRET, downloadPath: dir, post: async () => ({ ok: true, status: 200, data: {} }) })
    await deliver({ dataset, format: 'csv', fileName: 'R.csv', recipientIds: [U1], title: 't' })
    await deliver({ dataset, format: 'csv', fileName: 'R.csv', recipientIds: [U1], title: 't' })
    expect(fs.readdirSync(dir)).toHaveLength(2)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('se o servidor recusar, o arquivo recém-criado é apagado e o erro volta ao fluxo', async () => {
    const dir = mkdir()
    const deliver = createDownloadDelivery({ apiBase: 'https://x.test', projectId: PID, secretToken: SECRET, downloadPath: dir, post: async () => ({ ok: false, status: 404, data: { error: 'Projeto sem token.' } }) })
    await expect(deliver({ dataset, format: 'xlsx', fileName: 'R.xlsx', recipientIds: [U1], title: 't' })).rejects.toThrow(/Projeto sem token/)
    expect(fs.readdirSync(dir)).toHaveLength(0)
    const down = createDownloadDelivery({ apiBase: 'https://x.test', projectId: PID, secretToken: SECRET, downloadPath: dir, post: async () => { throw new Error('rede caiu') } })
    await expect(down({ dataset, format: 'xlsx', fileName: 'R.xlsx', recipientIds: [U1], title: 't' })).rejects.toThrow(/rede caiu/)
    expect(fs.readdirSync(dir)).toHaveLength(0)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('sem servidor configurado ou sem destinatários, recusa antes de gravar qualquer coisa', async () => {
    const dir = mkdir()
    const noBase = createDownloadDelivery({ apiBase: '', projectId: PID, secretToken: SECRET, downloadPath: dir, post: async () => ({ ok: true, status: 200 }) })
    await expect(noBase({ dataset, format: 'csv', fileName: 'R.csv', recipientIds: [U1], title: 't' })).rejects.toThrow(/endereço do servidor/)
    const ok = createDownloadDelivery({ apiBase: 'https://x.test', projectId: PID, secretToken: SECRET, downloadPath: dir, post: async () => ({ ok: true, status: 200 }) })
    await expect(ok({ dataset, format: 'csv', fileName: 'R.csv', recipientIds: [], title: 't' })).rejects.toThrow(/sem destinatários/)
    expect(fs.readdirSync(dir)).toHaveLength(0)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('arquivo compartilhado: só sai do disco quando a última linha some', () => {
  function client(rows: Array<{ id: string; local_path: string }>, fail = false) {
    return {
      from: () => ({ select: () => ({ eq: () => ({ in: async (_c: string, paths: string[]) => (fail ? { data: null, error: { message: 'x' } } : { data: rows.filter(r => paths.includes(r.local_path)), error: null }) }) }) }),
    } as any
  }
  const A = { id: 'a', local_path: '/p/1.xlsx' }
  const B = { id: 'b', local_path: '/p/1.xlsx' }
  const C = { id: 'c', local_path: '/p/2.xlsx' }
  const all = [A, B, C]

  it('mantém o arquivo enquanto outra linha o usa', async () => {
    expect(await deletableLocalPaths(client(all), PID, [A])).toEqual([])
    expect(await deletableLocalPaths(client(all), PID, [A, B])).toEqual(['/p/1.xlsx'])
    expect(await deletableLocalPaths(client(all), PID, [C])).toEqual(['/p/2.xlsx'])
    expect(await deletableLocalPaths(client(all), PID, [A, C])).toEqual(['/p/2.xlsx'])
  })

  it('linhas sem arquivo e erro ao consultar nunca apagam nada', async () => {
    expect(await deletableLocalPaths(client(all), PID, [{ id: 'z', local_path: null }, { id: 'y' }])).toEqual([])
    expect(await deletableLocalPaths(client(all, true), PID, [C])).toEqual([])
  })
})
