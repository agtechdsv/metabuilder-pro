import { test, expect } from '@playwright/test'
import { query } from './_db'

test.describe('cadastro de Clientes', () => {
  test('cria um cliente, ele aparece na lista e pode ser excluído', async ({ page }) => {
    await page.goto('/clientes/new')
    await page.locator('input[name="nome_empresa"]').fill('Cliente E2E')
    await page.locator('input[name="cnpj"]').fill('99.999.999/0001-99')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await page.waitForURL(url => !url.pathname.endsWith('/new'))

    await page.goto('/clientes')
    await page.locator('input[name="nome_empresa_filter"]').fill('Cliente E2E')
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: 'Cliente E2E' })
    await expect(linha).toHaveCount(1)

    // exclusão (com confirmação na janela do app)
    await linha.locator('button').last().click()
    await page.getByRole('button', { name: /excluir|confirmar/i }).last().click()
    // a exclusão é conferida no banco (a lista pode demorar a atualizar) e depois na tela
    await expect.poll(async () => (await query('SELECT 1 FROM clientes WHERE nome_empresa = $1', ['Cliente E2E'])).length).toBe(0)
    await page.reload()
    await expect(page.locator('tbody tr').filter({ hasText: 'Cliente E2E' })).toHaveCount(0)
  })

  test('edição abre com os dados do cliente e mostra a aba de pedidos com o título do Studio', async ({ page }) => {
    await page.goto('/clientes/1')
    await expect(page.locator('input[name="nome_empresa"]')).toHaveValue('Cliente 01')
    await expect(page.locator('input[name="cnpj"]')).toHaveValue('01.111.111/0001-01')
    await page.getByRole('button', { name: 'Meus Pedidos' }).click()
    // Cliente 01 tem 2 pedidos (150,00 e 80,50); as linhas vêm fechadas e abrem com os campos preenchidos
    await expect(page.getByText('Total de 2 registros').locator('visible=true')).toBeVisible()
    await page.getByRole('button', { name: 'Expandir Todos' }).click()
    await expect.poll(async () => (await page.locator('input').evaluateAll(els => els.map(e => (e as HTMLInputElement).value))).filter(v => /^(150|80[.,]5)/.test(v)).length).toBe(2)
  })
})
