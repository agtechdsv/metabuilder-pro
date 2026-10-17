import { test, expect } from '@playwright/test'

// Campo "produto_id" configurado no Studio como Autocomplete (busca dinâmica no servidor, mínimo 2 caracteres).
test('autocomplete do produto busca no servidor, escolhe e grava', async ({ page }) => {
  await page.goto('/itens/new')
  const busca = page.getByPlaceholder('Digite para pesquisar...')
  await busca.fill('M')
  await expect(page.getByText(/pelo menos 2 caracteres/i)).toBeVisible()
  await busca.fill('M8')
  await expect(page.getByText('Parafuso M8')).toBeVisible()
  await expect(page.getByText('Porca M8')).toBeVisible()
  await expect(page.getByText('Martelo')).toHaveCount(0)
  await page.getByText('Parafuso M8').click()
  await expect(page.locator('input[name="produto_id"]')).toHaveValue('1')
  await page.locator('input[name="qtd"]').fill('3')
  await page.getByRole('button', { name: 'Criar Registro' }).click()
  await page.waitForURL(url => !url.pathname.endsWith('/new'))
})
