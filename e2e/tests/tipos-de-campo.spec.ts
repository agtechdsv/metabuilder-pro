import { test, expect } from '@playwright/test'
import { query, apagarCliente } from './_db'

// Um campo de cada tipo no cadastro de Clientes: texto, máscara (CNPJ), data, booleano, número, opções fixas, texto longo e relação.
test.describe('tipos de campo no cadastro de Clientes', () => {
  test('edição mostra o que está no banco em cada tipo (Cliente 02)', async ({ page }) => {
    await page.goto('/clientes/2')
    await expect(page.locator('input[name="nome_empresa"]')).toHaveValue('Cliente 02')
    await expect(page.locator('input[name="cnpj"]')).toHaveValue('02.111.111/0001-02')
    await expect(page.locator('input[name="data_cadastro"]')).toHaveValue('2025-01-03')
    await expect(page.locator('input[name="ativo"]')).toBeChecked()
    await expect(page.locator('input[name="limite_credito"]')).toHaveValue('2001.00')
    await expect(page.locator('select[name="status"]')).toHaveValue('Bloqueado')
    await expect(page.locator('textarea[name="observacoes"]')).toHaveValue('Observação do cliente 02')
    await expect(page.locator('select[name="cliente_pai_id"]')).toHaveValue('1') // auto-relação: filial do Cliente 01
  })

  test('cliente sem marca de ativo abre desmarcado (Cliente 01)', async ({ page }) => {
    await page.goto('/clientes/1')
    await expect(page.locator('input[name="ativo"]')).not.toBeChecked()
    await expect(page.locator('select[name="cliente_pai_id"]')).toHaveValue('')
  })

  test('opções fixas e relação oferecem as opções certas', async ({ page }) => {
    await page.goto('/clientes/new')
    await expect(page.locator('select[name="status"] option')).toHaveCount(4)
    // o pai pode ser qualquer cliente (30 + "Selecione")
    await expect(page.locator('select[name="cliente_pai_id"] option')).toHaveCount(31)
  })

  test('máscara de CNPJ formata ao digitar', async ({ page }) => {
    await page.goto('/clientes/new')
    const cnpj = page.locator('input[name="cnpj"]')
    await cnpj.pressSequentially('12345678000190')
    await expect(cnpj).toHaveValue('12.345.678/0001-90')
  })

  test('cria com todos os tipos, grava no banco e reabre igual', async ({ page }) => {
    const nome = 'Cliente Tipos E2E'
    await apagarCliente(nome)
    try {
      await page.goto('/clientes/new')
      await page.locator('input[name="nome_empresa"]').fill(nome)
      await page.locator('input[name="cnpj"]').pressSequentially('12345678000190')
      await page.locator('input[name="data_cadastro"]').fill('2026-02-15')
      await page.locator('input[name="ativo"]').check()
      await page.locator('input[name="limite_credito"]').fill('1234.56')
      await page.locator('select[name="status"]').selectOption('Ativo')
      await page.locator('textarea[name="observacoes"]').fill('linha 1\nlinha 2')
      await page.locator('select[name="cliente_pai_id"]').selectOption({ label: 'Cliente 03' })
      await page.getByRole('button', { name: 'Criar Registro' }).first().click()
      await page.waitForURL(url => /\/clientes\/\d+/.test(url.pathname) || url.pathname === '/clientes')

      const [row] = await query('SELECT * FROM clientes WHERE nome_empresa = $1', [nome])
      expect(row).toBeTruthy()
      expect(row.cnpj).toBe('12.345.678/0001-90')
      expect(new Date(row.data_cadastro).toISOString().slice(0, 10)).toBe('2026-02-15')
      expect(row.ativo).toBe(true)
      expect(Number(row.limite_credito)).toBe(1234.56)
      expect(row.status).toBe('Ativo')
      expect(row.observacoes).toBe('linha 1\nlinha 2')
      expect(row.cliente_pai_id).toBe(3)

      await page.goto('/clientes/' + row.id)
      await expect(page.locator('input[name="data_cadastro"]')).toHaveValue('2026-02-15')
      await expect(page.locator('input[name="ativo"]')).toBeChecked()
      await expect(page.locator('select[name="status"]')).toHaveValue('Ativo')
      await expect(page.locator('textarea[name="observacoes"]')).toHaveValue('linha 1\nlinha 2')
    } finally {
      await apagarCliente(nome)
    }
  })

  test('desmarcar o booleano e salvar a edição grava falso', async ({ page }) => {
    const nome = 'Cliente Booleano E2E'
    await apagarCliente(nome)
    await query("INSERT INTO clientes (nome_empresa, ativo, status) VALUES ($1, true, 'Ativo')", [nome])
    try {
      const [{ id }] = await query('SELECT id FROM clientes WHERE nome_empresa = $1', [nome])
      await page.goto('/clientes/' + id)
      await expect(page.locator('input[name="ativo"]')).toBeChecked()
      await page.locator('input[name="ativo"]').uncheck()
      await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
      await expect.poll(async () => (await query('SELECT ativo FROM clientes WHERE id = $1', [id]))[0].ativo).toBe(false)
    } finally {
      await apagarCliente(nome)
    }
  })
})
