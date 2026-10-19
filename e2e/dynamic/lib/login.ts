import { expect, type Page } from '@playwright/test'
import { CONFIG } from './config'

/** Entra no app exportado com o usuário de teste. */
export async function entrar(page: Page) {
  if (CONFIG.noAuth) return // app sem login
  await entrarComo(page, CONFIG.user, CONFIG.password)
}

/** Entra com um usuário qualquer (os testes de segurança entram com usuários temporários). */
export async function entrarComo(page: Page, email: string, senha: string) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(senha)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await expect(page.getByText('Sair do Sistema').first()).toBeVisible()
}
