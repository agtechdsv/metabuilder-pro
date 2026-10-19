import { expect, type Page } from '@playwright/test'
import { CONFIG } from './config'

/** Entra no app exportado com o usuário de teste. */
export async function entrar(page: Page) {
  if (CONFIG.noAuth) return // app sem login
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(CONFIG.user)
  await page.locator('input[name="password"]').fill(CONFIG.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await expect(page.getByText('Sair do Sistema').first()).toBeVisible()
}
