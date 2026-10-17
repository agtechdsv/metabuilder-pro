import { test, expect, type Page } from '@playwright/test'

// Listagem de Clientes: 30 registros fixos ("Cliente 01" a "Cliente 30"), página padrão de 25 linhas (items_per_page do Studio).
const rows = (page: Page) => page.locator('tbody tr').filter({ hasText: /Cliente \d\d/ })

test.describe('grid de Clientes', () => {
  test('mostra a primeira página com o tamanho configurado no Studio e o total', async ({ page }) => {
    await page.goto('/clientes')
    await expect(rows(page)).toHaveCount(25)
    await expect(page.getByText('Total:').locator('..')).toContainText('30')
  })

  test('paginação leva às 5 linhas restantes', async ({ page }) => {
    await page.goto('/clientes')
    await page.getByRole('link', { name: '2', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(rows(page)).toHaveCount(5)
  })

  test('filtro por nome encontra só o cliente', async ({ page }) => {
    await page.goto('/clientes')
    await page.locator('input[name="nome_empresa_filter"]').fill('Cliente 07')
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('07.111.111/0001-07')
  })

  test('botões do topo na ordem da plataforma: Exportar antes de Novo Registro', async ({ page }) => {
    await page.goto('/clientes')
    const exportar = await page.getByRole('button', { name: /^Exportar/ }).boundingBox()
    const novo = await page.getByRole('link', { name: 'Novo Registro' }).boundingBox()
    expect(exportar!.x).toBeLessThan(novo!.x)
  })
})
