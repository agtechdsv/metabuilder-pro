import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

// Exportar na grid de Clientes: Excel, CSV e JSON, com todas as linhas ou só as marcadas. Depois a Central de Downloads.
async function baixar(page: Page, formato: RegExp) {
  await page.getByRole('button', { name: /^Exportar/ }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: formato }).click()])
  const file = await download.path()
  return { name: download.suggestedFilename(), buf: fs.readFileSync(file!) }
}

test.describe('exportação', () => {
  test('CSV traz todos os 30 clientes (com BOM e ;)', async ({ page }) => {
    await page.goto('/clientes')
    const { name, buf } = await baixar(page, /csv/i)
    expect(name).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = buf.toString('utf8')
    expect(text.charCodeAt(0)).toBe(0xfeff)
    const linhas = text.split('\r\n').filter(Boolean)
    expect(linhas).toHaveLength(31) // cabeçalho + 30
    expect(linhas[0]).toContain(';')
    expect(text).toContain('Cliente 30')
  })

  test('Excel é um arquivo .xlsx válido', async ({ page }) => {
    await page.goto('/clientes')
    const { name, buf } = await baixar(page, /excel|xlsx/i)
    expect(name).toMatch(/\.xlsx$/)
    expect(buf.subarray(0, 2).toString()).toBe('PK')
    expect(buf.length).toBeGreaterThan(1000)
  })

  test('com linhas marcadas exporta só elas', async ({ page }) => {
    await page.goto('/clientes')
    const marcas = page.locator('tbody input[type="checkbox"]')
    await marcas.nth(0).check()
    await marcas.nth(1).check()
    await expect(page.getByRole('button', { name: /^Exportar \(2\)/ })).toBeVisible()
    const { buf } = await baixar(page, /json/i)
    expect(JSON.parse(buf.toString('utf8'))).toHaveLength(2)
  })

  test('marcar todas pelo cabeçalho e desmarcar', async ({ page }) => {
    await page.goto('/clientes')
    await page.locator('thead input[type="checkbox"]').check()
    await expect(page.getByRole('button', { name: /^Exportar \(25\)/ })).toBeVisible()
    await page.locator('thead input[type="checkbox"]').uncheck()
    await expect(page.getByRole('button', { name: /^Exportar$/ })).toBeVisible()
  })

  test('Central de Downloads lista as exportações, baixa e exclui', async ({ page }) => {
    await page.goto('/clientes')
    await baixar(page, /csv/i)
    await page.goto('/downloads')
    const arquivos = page.getByText(/^clientes-\d{8}-\d{6}-[0-9a-f]{4}\.csv$/)
    await expect(arquivos.first()).toBeVisible()
    const antes = await arquivos.count()

    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('a[title="Baixar"]').first().click()])
    expect(fs.readFileSync((await dl.path())!).toString('utf8')).toContain('Cliente 30')

    await page.locator('button[title="Excluir"]').first().click()
    await expect(arquivos).toHaveCount(antes - 1)
  })
})
