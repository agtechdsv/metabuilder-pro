import { expect, type Page } from '@playwright/test'
import { REAL, PREFIXO } from '../guard'

/** Identificador desta rodada: tudo o que o teste cria leva "E2E-<rodada>" no nome (e é a única coisa que a limpeza apaga). */
export const RODADA = PREFIXO + new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12) // E2E-2610181030

/** Entra no app exportado com o usuário robô. */
export async function entrar(page: Page, quem: 'admin' | 'func' | 'leitura' = 'admin') {
  const user = quem === 'func' ? REAL.userFunc : quem === 'leitura' ? REAL.userLeitura : REAL.user
  const password = quem === 'func' ? REAL.passwordFunc : quem === 'leitura' ? REAL.passwordLeitura : REAL.password
  if (!user || !password) throw new Error('Robô "' + quem + '" sem credenciais em e2e/.env.real (rode npm run real:robot ou real:robot:func).')
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(user)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await expect(page.getByText('Sair do Sistema').first()).toBeVisible()
}
