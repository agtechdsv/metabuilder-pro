import { test, expect } from '@playwright/test'
import { query } from './_db'

// App exportado COM automações (npm run gen -- pg-node-bpm): o fluxo "Bloqueia cliente" (Antes de criar) e o "Registra produto" (Ao criar).
const NOME = 'E2E-BPM Cliente'

test.afterEach(async () => {
  await query("DELETE FROM clientes WHERE nome_empresa LIKE 'E2E-BPM%'")
  await query("DELETE FROM produtos WHERE nome LIKE 'Auto E2E-BPM%'")
  await query("DELETE FROM mb_bpm_runs WHERE workflow_id LIKE 'wf-%'").catch(() => {})
})

test('"Antes de criar" bloqueia o cadastro com a mensagem do fluxo e nada é gravado', async ({ page }) => {
  await page.goto('/clientes/new')
  await page.locator('input[name="nome_empresa"]').fill(NOME)
  await page.locator('textarea[name="observacoes"]').fill('BLOQUEAR')
  await page.getByRole('button', { name: 'Criar Registro' }).click()
  await expect(page.getByText(`Cliente ${NOME} bloqueado pelo fluxo`)).toBeVisible()
  expect(await query('SELECT id FROM clientes WHERE nome_empresa = $1', [NOME])).toHaveLength(0)
  expect(await query("SELECT id FROM produtos WHERE nome = $1", ['Auto ' + NOME])).toHaveLength(0) // o "Ao criar" também não rodou
})

test('cadastro permitido grava o cliente e o fluxo "Ao criar" registra o produto, com histórico em mb_bpm_runs', async ({ page }) => {
  await page.goto('/clientes/new')
  await page.locator('input[name="nome_empresa"]').fill(NOME)
  await page.locator('input[name="cnpj"]').fill('12345678000199')
  await page.getByRole('button', { name: 'Criar Registro' }).click()
  await page.waitForURL(url => !url.pathname.endsWith('/new'))
  expect(await query('SELECT id FROM clientes WHERE nome_empresa = $1', [NOME])).toHaveLength(1)
  // o "Ao criar" roda depois da gravação, sem travar a tela: espera aparecer
  await expect.poll(async () => (await query('SELECT id FROM produtos WHERE nome = $1', ['Auto ' + NOME])).length, { timeout: 10_000 }).toBe(1)
  const runs = await query("SELECT workflow_id, status, trigger_source FROM mb_bpm_runs WHERE workflow_id IN ('wf-block', 'wf-after') ORDER BY id")
  expect(runs.map(r => `${r.workflow_id}:${r.status}`)).toEqual(['wf-block:success', 'wf-after:success'])
})

test('webhook de entrada: sem segredo ou com segredo errado é recusado; com o segredo certo roda o fluxo', async ({ request }) => {
  const url = '/api/bpm/webhook/wf-hook'
  expect((await request.post(url, { data: { codigo: 'X1' } })).status()).toBe(401)
  expect((await request.post(url, { data: { codigo: 'X1' }, headers: { 'X-Webhook-Secret': 'errado' } })).status()).toBe(401)
  expect((await request.get(url, { headers: { 'X-Webhook-Secret': 'segredo-teste' } })).status()).toBe(405) // o fluxo só aceita POST
  expect((await request.post('/api/bpm/webhook/nao-existe', { data: {}, headers: { 'X-Webhook-Secret': 'segredo-teste' } })).status()).toBe(404)
  expect(await query("SELECT id FROM produtos WHERE nome = 'Hook X1'")).toHaveLength(0)
  const ok = await request.post(url, { data: { codigo: 'X1' }, headers: { Authorization: 'Bearer segredo-teste' } })
  expect(ok.status()).toBe(200)
  expect(await query("SELECT id FROM produtos WHERE nome = 'Hook X1'")).toHaveLength(1)
  await query("DELETE FROM produtos WHERE nome = 'Hook X1'")
})
