import { test, expect } from '@playwright/test'
import { entrar } from './helpers'

// Teste de fumaça no app real: o robô entra e abre cada tela do menu. Não grava nada.
test.describe('app real: entrada e telas', () => {
  test('login do robô funciona e a senha errada é recusada', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[name="email"]').fill('e2e_robo@metabuilder.local')
    await page.locator('input[name="password"]').fill('senha-errada-de-proposito')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/login/)
    await entrar(page)
  })

  test('todas as telas do menu abrem sem erro', async ({ page }) => {
    await entrar(page)
    const hrefs = await page.locator('aside nav a[href^="/"]').evaluateAll(as => Array.from(new Set(as.map(a => (a as HTMLAnchorElement).getAttribute('href') as string))))
    expect(hrefs.length).toBeGreaterThan(0)
    const problemas: string[] = []
    for (const href of hrefs) {
      page.on('pageerror', e => problemas.push(`${href}: erro de página: ${e.message.slice(0, 160)}`))
      const resp = await page.goto(href)
      if (!resp || resp.status() >= 400) problemas.push(`${href}: HTTP ${resp?.status()}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const texto = (await page.locator('body').innerText()).slice(0, 4000)
      if (/Application error|Internal Server Error|Unhandled Runtime Error|Erro ao carregar/i.test(texto)) problemas.push(`${href}: tela mostra erro`)
      await expect(page.locator('main').first()).toBeVisible()
    }
    expect(problemas, 'telas com problema:\n' + problemas.join('\n')).toEqual([])
  })
})
