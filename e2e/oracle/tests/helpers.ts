import { expect, type Page } from '@playwright/test'
import { ORA, PREFIXO } from '../guard'

/** Identificador desta rodada: tudo o que o teste cria leva "E2E-<rodada>" no nome (e é a única coisa que a limpeza apaga). */
export const RODADA = PREFIXO + new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12)

/** Entra no app exportado (Node + Oracle) com o usuário robô. */
export async function entrar(page: Page, quem: 'admin' | 'func' | 'leitura' = 'admin') {
  const user = quem === 'func' ? ORA.userFunc : quem === 'leitura' ? ORA.userLeitura : ORA.user
  const password = quem === 'func' ? ORA.passwordFunc : quem === 'leitura' ? ORA.passwordLeitura : ORA.password
  if (!user || !password) throw new Error('Robô "' + quem + '" sem credenciais em e2e/.env.oracle (rode npm run ora:robot, ora:robot:func e ora:robot:leitura).')
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(user)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await expect(page.getByText('Sair do Sistema').first()).toBeVisible()
}
