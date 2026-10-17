import { test, expect, type Page } from '@playwright/test'
import { query, apagarCliente } from './_db'

// Relações no cadastro de Clientes: dois detalhes no mesmo mestre (Meus Pedidos e Contatos), subdetalhe (Itens sob cada pedido) e auto-relação.
const visivel = (page: Page, texto: string | RegExp) => page.getByText(texto).locator('visible=true')

test.describe('relações: detalhes e subdetalhe', () => {
  test('aba Contatos lista os contatos do cliente (Cliente 01 tem 2; Cliente 03 nenhum)', async ({ page }) => {
    await page.goto('/clientes/1')
    await page.getByRole('button', { name: 'Contatos' }).click()
    await expect(visivel(page, 'Total de 2 registros')).toBeVisible()
    await page.getByRole('button', { name: 'Expandir Todos' }).locator('visible=true').first().click()
    await expect.poll(async () => (await page.locator('input[name="nome"]').locator('visible=true').evaluateAll(els => els.map(e => (e as HTMLInputElement).value))).sort())
      .toEqual(['Ana Souza', 'Bruno Lima'])

    await page.goto('/clientes/3')
    await page.getByRole('button', { name: 'Contatos' }).click()
    await expect(visivel(page, /Total de 0 registros|Nenhum/i).first()).toBeVisible()
  })

  test('subdetalhe: os itens aparecem sob cada pedido', async ({ page }) => {
    await page.goto('/clientes/1')
    await page.getByRole('button', { name: 'Meus Pedidos' }).click()
    await page.getByRole('button', { name: 'Expandir Todos' }).locator('visible=true').first().click()
    // pedido 1: Parafuso M8 e Porca M8; pedido 2: Arruela
    await expect(visivel(page, 'Parafuso M8')).toBeVisible()
    await expect(visivel(page, 'Porca M8')).toBeVisible()
    await expect(visivel(page, 'Arruela')).toBeVisible()
  })

  test('pedido com data e hora abre com a hora (14:30 do pedido 1)', async ({ page }) => {
    await page.goto('/clientes/1')
    await page.getByRole('button', { name: 'Meus Pedidos' }).click()
    await page.getByRole('button', { name: 'Expandir Todos' }).locator('visible=true').first().click()
    const campos = page.locator('input[name="data_pedido"]').locator('visible=true')
    await expect(campos.first()).toHaveAttribute('type', 'datetime-local')
    await expect.poll(async () => (await campos.evaluateAll(els => els.map(e => (e as HTMLInputElement).value))).sort())
      .toEqual(['2025-03-10T14:30', '2025-03-11T09:00'])
  })

  test('editar um pedido e salvar mantém a hora e grava a alteração', async ({ page }) => {
    await query("UPDATE pedidos SET status = 'Fechado', data_pedido = '2025-03-11 09:00:00' WHERE id = 2")
    try {
      await page.goto('/clientes/1')
      await page.getByRole('button', { name: 'Meus Pedidos' }).click()
      await page.getByRole('button', { name: 'Expandir Todos' }).locator('visible=true').first().click()
      // a linha do pedido de 80,50 (id 2) está Fechada: passa para Aberto
      const linha = page.locator('select[name="status"]').locator('visible=true').filter({ has: page.locator('option[value="Fechado"]:checked') })
      await linha.first().selectOption('Aberto')
      await page.getByRole('button', { name: 'Salvar Alterações' }).locator('visible=true').last().click()
      await expect.poll(async () => (await query("SELECT status, to_char(data_pedido, 'YYYY-MM-DD HH24:MI') AS quando FROM pedidos WHERE id = 2"))[0]).toEqual({ status: 'Aberto', quando: '2025-03-11 09:00' })
    } finally {
      await query("UPDATE pedidos SET status = 'Fechado', data_pedido = '2025-03-11 09:00:00' WHERE id = 2")
    }
  })

  test('cria o cliente já com contato e pedido preenchidos antes de o mestre existir', async ({ page }) => {
    const nome = 'Cliente Relacoes E2E'
    await apagarCliente(nome)
    try {
      await page.goto('/clientes/new')
      await page.locator('input[name="nome_empresa"]').fill(nome)

      // cada aba começa vazia: "Adicionar na Lista" abre uma linha para preencher (gravada junto com o mestre)
      await page.getByRole('button', { name: 'Contatos' }).click()
      await page.getByRole('button', { name: 'Adicionar na Lista' }).locator('visible=true').click()
      await page.locator('input[name="nome"]').locator('visible=true').fill('Carla Dias')
      await page.locator('input[name="email"]').locator('visible=true').fill('carla@e2e.com')

      await page.getByRole('button', { name: 'Meus Pedidos' }).click()
      await page.getByRole('button', { name: 'Adicionar na Lista' }).locator('visible=true').click()
      await page.locator('input[name="total"]').locator('visible=true').fill('99,90')
      await page.locator('select[name="status"]').locator('visible=true').selectOption('Aberto')
      await page.getByRole('button', { name: 'Clientes', exact: true }).click()
      await page.getByRole('button', { name: 'Criar Registro' }).first().click()
      await page.waitForURL(url => /\/clientes\/\d+/.test(url.pathname))

      const [cli] = await query('SELECT id FROM clientes WHERE nome_empresa = $1', [nome])
      expect(cli).toBeTruthy()
      await expect.poll(async () => (await query('SELECT nome, email FROM contatos WHERE cliente_id = $1', [cli.id]))[0]).toEqual({ nome: 'Carla Dias', email: 'carla@e2e.com' })
      await expect.poll(async () => (await query('SELECT total, status FROM pedidos WHERE cliente_id = $1', [cli.id]))[0]).toMatchObject({ status: 'Aberto' })
      const [ped] = await query('SELECT total FROM pedidos WHERE cliente_id = $1', [cli.id])
      expect(Number(ped.total)).toBe(99.9)
    } finally {
      await apagarCliente(nome)
    }
  })
})
