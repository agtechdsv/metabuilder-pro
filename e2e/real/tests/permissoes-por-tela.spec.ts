import { test, expect } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery } from '../guard'

/**
 * Permissões por tela (Nenhum, Leitura, Escrita) no app real, com o robô "leitura": grupo de teste E2E-Leitura
 * (Clientes = só leitura, Departamentos = bloqueado; as demais telas seguem o padrão). Criado por `npm run real:robot:leitura`.
 * Só o grupo de teste é afetado: nenhum outro usuário ou grupo é alterado.
 */
test.describe('permissões por tela (grupo E2E-Leitura)', () => {
  test('tela bloqueada some do menu e não abre pelo endereço', async ({ page }) => {
    await entrar(page, 'leitura')
    const menu = (await page.locator('aside nav a[href^="/"]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).getAttribute('href')))) as string[]
    expect(menu).toContain('/clientes')
    expect(menu).not.toContain('/departamentos')

    await page.goto('/departamentos')
    await page.waitForLoadState('networkidle').catch(() => {})
    // bloqueada: nenhuma lista de departamentos aparece (volta ao início ou mostra aviso de acesso)
    await expect(page.locator('input[name="nome_filter"]')).toHaveCount(0)
    await expect(page.locator('tbody tr').filter({ hasText: /Logística|Vendas|Financeiro|RH/ })).toHaveCount(0)
  })

  test('tela só de leitura: abre e mostra os dados, mas não deixa criar, editar nem excluir', async ({ page }) => {
    // cliente criado pelo robô Administrador (que vê tudo): o robô leitura precisa estar na exceção por grupo ou ver só os seus
    const [robo] = await realQuery("select id from usuarios where email = 'e2e_robo_leitura@metabuilder.local'")
    const nome = `${RODADA} Cliente Leitura`
    const [cli] = await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now()) returning id", [nome, robo.id])
    await entrar(page, 'leitura')

    await page.goto('/clientes')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.locator('input[name="nome_empresa_filter"]').fill(nome)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: nome })
    await expect(linha).toHaveCount(1) // leitura: enxerga o que é dele
    // sem os controles de gravação na tela
    await expect(page.getByRole('link', { name: 'Novo Registro' })).toHaveCount(0)
    await expect(linha.locator('button[title="Excluir"]')).toHaveCount(0)
    await expect(linha.locator('a[title="Editar"]')).toHaveCount(0)

    // e o servidor recusa gravar mesmo se a pessoa forçar o endereço do formulário
    await page.goto('/clientes/' + cli.id)
    await page.waitForLoadState('networkidle').catch(() => {})
    const email = page.locator('input[name="email_contato"]')
    if (await email.count() && (await email.isEnabled())) {
      await email.fill('forcado@e2e.com.br')
      const salvar = page.getByRole('button', { name: 'Salvar Alterações' }).first()
      if (await salvar.count()) await salvar.click()
      await page.waitForTimeout(1500)
    }
    expect((await realQuery('select email_contato from clientes where id = $1', [cli.id]))[0].email_contato).toBeNull()

    await page.goto('/clientes/new')
    await page.waitForLoadState('networkidle').catch(() => {})
    const novo = page.locator('input[name="nome_empresa"]')
    if (await novo.count() && (await novo.isEnabled())) {
      await novo.fill(`${RODADA} Forcado`)
      const criar = page.getByRole('button', { name: 'Criar Registro' }).first()
      if (await criar.count()) await criar.click()
      await page.waitForTimeout(1500)
    }
    expect((await realQuery("select 1 from clientes where nome_empresa = $1", [`${RODADA} Forcado`])).length).toBe(0)
  })

  test('telas sem restrição no grupo seguem liberadas (Produtos abre e lista)', async ({ page }) => {
    await entrar(page, 'leitura')
    await page.goto('/produtos')
    await page.waitForLoadState('networkidle').catch(() => {})
    const total = Number((await realQuery('select count(*) n from produtos'))[0].n)
    await expect(page.locator('main img')).toHaveCount(total)
  })
})
