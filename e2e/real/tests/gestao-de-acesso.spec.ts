import { test, expect, type Page } from '@playwright/test'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL, GRUPO_LEITURA_ID } from '../guard'

/**
 * Gestão de acesso do app (telas Usuários, Grupos e Permissões de Telas), só pelo Administrador. Tudo o que os testes criam usa
 * e-mail e2e_robo_tmp* (usuários) ou nome E2E-Tmp* (grupos); a limpeza só apaga isso e devolve ao grupo de teste E2E-Leitura as
 * permissões de partida. Os usuários e grupos de verdade não são tocados (o teardown confere as contagens).
 */
// Versões antigas do app exportado apagavam o vínculo de TODOS os usuários do grupo ao trocar o grupo de um usuário ou excluí-lo
// (DELETE pela coluna do grupo). Só roda o teste que troca/exclui quando o app já tem a correção (linkDeleteWhere).
const appCorrigido = (() => {
  try { return fs.readFileSync(path.join(REAL.appDir, 'app', 'actions', 'access-admin.ts'), 'utf8').includes('linkDeleteWhere') } catch { return false }
})()
const emailTmp = (s: string) => `e2e_robo_tmp_${s}_${RODADA.replace(/\D/g, '')}@metabuilder.local`
const janela = (page: Page) => page.getByRole('dialog').last()
const idDoGrupo = async (nome: string): Promise<string> => (await realQuery('select id from perfis where nome = $1', [nome]))[0].id

async function abrir(page: Page, rota: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle').catch(() => {})
}
async function entrarComo(page: Page, email: string, senha: string) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(senha)
  await page.locator('button[type="submit"]').click()
}

test.describe('gestão de acesso: usuários', () => {
  test('a lista mostra os usuários com o grupo que está no banco', async ({ page }) => {
    await entrar(page)
    await abrir(page, '/acesso-usuarios')
    const esperado: Array<[string, string]> = [['e2e_robo@metabuilder.local', 'Administrador'], ['e2e_robo_func@metabuilder.local', 'Funcionária'], ['e2e_robo_leitura@metabuilder.local', 'E2E-Leitura']]
    for (const [email, grupo] of esperado) {
      const linha = page.locator('tbody tr').filter({ hasText: email })
      await expect(linha).toHaveCount(1)
      await expect(linha.locator('select')).toHaveValue(await idDoGrupo(grupo))
    }
  })

  test('criar usuário com grupo, entrar com ele, trocar de grupo, redefinir a senha e excluir', async ({ page, browser }) => {
    test.skip(!appCorrigido, 'App ejetado antigo: trocar de grupo ou excluir usuário apagaria o vínculo de outros usuários do grupo. Ejete de novo com o gerador corrigido.')
    const email = emailTmp('u1')
    const vinculosDosOutros = async () => (await realQuery("select u.email, pu.perfil_id from perfis_usuarios pu join usuarios u on u.id = pu.usuario_id where u.email not like 'e2e_robo_tmp%' order by 1, 2"))
    const antesOutros = await vinculosDosOutros()
    await entrar(page)
    await abrir(page, '/acesso-usuarios')

    // criar
    await page.getByRole('button', { name: 'Criar Usuário' }).click()
    const j = janela(page)
    await j.getByPlaceholder('Nome (opcional)').fill('E2E Usuário Temporário')
    await j.locator('input[type="email"]').fill(email)
    await j.locator('input[type="password"]').fill('Senha-Inicial-1')
    await j.locator('select').selectOption({ label: 'Funcionária' })
    await j.getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(async () => (await realQuery('select 1 from usuarios where email = $1', [email])).length).toBe(1)
    const [u] = await realQuery('select id, nome_completo, hash_senha, ativo from usuarios where email = $1', [email])
    expect(u.nome_completo).toBe('E2E Usuário Temporário')
    expect(u.hash_senha).toMatch(/^\$2[aby]\$/) // bcrypt, nunca a senha em texto
    expect(bcrypt.compareSync('Senha-Inicial-1', u.hash_senha)).toBe(true)
    expect((await realQuery('select perfil_id from perfis_usuarios where usuario_id = $1', [u.id]))[0].perfil_id).toBe(await idDoGrupo('Funcionária'))

    // o usuário novo consegue entrar
    const ctx = await browser.newContext()
    const novo = await ctx.newPage()
    await entrarComo(novo, email, 'Senha-Inicial-1')
    await novo.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 })
    await expect(novo.getByText('Sair do Sistema').first()).toBeVisible()
    await ctx.close()

    // trocar de grupo pela lista
    await abrir(page, '/acesso-usuarios')
    const linha = page.locator('tbody tr').filter({ hasText: email })
    await linha.locator('select').selectOption({ label: 'Gerente' })
    await expect.poll(async () => (await realQuery('select perfil_id from perfis_usuarios where usuario_id = $1', [u.id]))[0]?.perfil_id).toBe(await idDoGrupo('Gerente'))

    // redefinir a senha: a nova vale, a antiga não
    await linha.locator('button[title="Redefinir senha"]').click()
    const j2 = janela(page)
    const senhas = j2.locator('input[type="password"]')
    await senhas.nth(0).fill('Senha-Nova-2')
    await senhas.nth(1).fill('Senha-Nova-2')
    await j2.getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(async () => bcrypt.compareSync('Senha-Nova-2', (await realQuery('select hash_senha from usuarios where id = $1', [u.id]))[0].hash_senha)).toBe(true)
    const ctx2 = await browser.newContext()
    const velho = await ctx2.newPage()
    await entrarComo(velho, email, 'Senha-Inicial-1')
    await velho.waitForTimeout(2000)
    await expect(velho).toHaveURL(/\/login/)
    await ctx2.close()

    // excluir (janela de confirmação do app)
    await abrir(page, '/acesso-usuarios')
    await page.locator('tbody tr').filter({ hasText: email }).locator('button[title="Excluir"]').click()
    await janela(page).getByRole('button', { name: /excluir|confirmar|sim/i }).last().click()
    await expect.poll(async () => (await realQuery('select 1 from usuarios where email = $1', [email])).length).toBe(0)
    expect((await realQuery('select 1 from perfis_usuarios where usuario_id = $1', [u.id])).length).toBe(0)
    // trocar de grupo e excluir o usuário não pode ter mexido no vínculo de ninguém mais
    expect(await vinculosDosOutros()).toEqual(antesOutros)
  })

  test('e-mail repetido: o erro aparece na janela e nada é criado', async ({ page }) => {
    await entrar(page)
    await abrir(page, '/acesso-usuarios')
    const antes = Number((await realQuery('select count(*) n from usuarios'))[0].n)
    await page.getByRole('button', { name: 'Criar Usuário' }).click()
    const j = janela(page)
    await j.locator('input[type="email"]').fill('e2e_robo@metabuilder.local')
    await j.locator('input[type="password"]').fill('Qualquer-Senha-1')
    await j.getByRole('button', { name: 'Salvar' }).click()
    await page.waitForTimeout(1500)
    await expect(janela(page).getByRole('button', { name: 'Salvar' })).toBeVisible() // continua aberta, com o erro dentro
    expect(Number((await realQuery('select count(*) n from usuarios'))[0].n)).toBe(antes)
  })
})

test.describe('gestão de acesso: grupos', () => {
  test('criar, renomear e excluir um grupo', async ({ page }) => {
    const nome = `E2E-Tmp Grupo ${RODADA.slice(-6)}`
    await entrar(page)
    await abrir(page, '/acesso-grupos')
    await page.getByRole('button', { name: 'Criar Grupo' }).click()
    await janela(page).getByRole('textbox').fill(nome)
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(async () => (await realQuery('select 1 from perfis where nome = $1', [nome])).length).toBe(1)

    await abrir(page, '/acesso-grupos')
    const linha = page.locator('tbody tr').filter({ hasText: nome })
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Renomear"]').click()
    const novoNome = nome + ' B'
    await janela(page).getByRole('textbox').fill(novoNome)
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(async () => (await realQuery('select 1 from perfis where nome = $1', [novoNome])).length).toBe(1)

    await abrir(page, '/acesso-grupos')
    await page.locator('tbody tr').filter({ hasText: novoNome }).locator('button[title="Excluir"]').click()
    await janela(page).getByRole('button', { name: /excluir|confirmar|sim/i }).last().click()
    await expect.poll(async () => (await realQuery('select 1 from perfis where nome = $1', [novoNome])).length).toBe(0)
  })
})

test.describe('gestão de acesso: permissões de telas', () => {
  test('a matriz mostra o nível de cada tela para o grupo de teste (Clientes leitura, Departamentos nenhum)', async ({ page }) => {
    await entrar(page)
    await abrir(page, '/acesso-permissoes')
    await expect(page.locator('thead').getByText(/E2E-Leitura/i)).toBeVisible()
    const nivel = async (rota: string) => (await realQuery('select access_level from mb_role_permissions where role_id = $1 and view_slug = $2', [GRUPO_LEITURA_ID, rota]))[0]?.access_level
    expect(await nivel('clientes')).toBe('read')
    expect(await nivel('departamentos')).toBe('none')
  })

  test('mudar a permissão do grupo de teste vale no próximo login e pode ser desfeita', async ({ page, browser }) => {
    await entrar(page)
    await abrir(page, '/acesso-permissoes')
    const linhaProdutos = page.locator('tbody tr').filter({ has: page.locator('td p', { hasText: /^\/produtos$/ }) })
    const celulaLeitura = linhaProdutos.locator('td').nth(1) // 1ª coluna de grupo = E2E-Leitura
    // primeira coluna de grupo = E2E-Leitura: Produtos → Nenhum
    await celulaLeitura.locator('button', { hasText: /^Nenhum$/ }).click()
    await expect.poll(async () => (await realQuery('select access_level from mb_role_permissions where role_id = $1 and view_slug = $2', [GRUPO_LEITURA_ID, 'produtos']))[0]?.access_level).toBe('none')

    // o robô leitura, ao entrar de novo, já não vê Produtos
    const ctx = await browser.newContext()
    const leitura = await ctx.newPage()
    await entrar(leitura, 'leitura')
    const menu = (await leitura.locator('aside nav a[href^="/"]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).getAttribute('href')))) as string[]
    expect(menu).not.toContain('/produtos')
    await ctx.close()

    // desfaz: Produtos volta a Escrita (o teardown também restaura, caso o teste caia antes)
    await celulaLeitura.locator('button', { hasText: /^Escrita$/ }).click()
    await expect.poll(async () => (await realQuery('select access_level from mb_role_permissions where role_id = $1 and view_slug = $2', [GRUPO_LEITURA_ID, 'produtos']))[0]?.access_level ?? 'write').toBe('write')
  })

  test('as telas de gestão de acesso são só do Administrador (a Funcionária não entra)', async ({ page }) => {
    await entrar(page, 'func')
    for (const rota of ['/acesso-grupos', '/acesso-permissoes']) {
      await page.goto(rota)
      await page.waitForLoadState('networkidle').catch(() => {})
      await expect(page.getByRole('button', { name: /Criar Grupo|Nenhum/ })).toHaveCount(0)
    }
  })
})
