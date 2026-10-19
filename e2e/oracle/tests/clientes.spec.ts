import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Clientes no app exportado (Node + Oracle): cadastro, edição, exclusão e ícones da linha. Cada nome leva o prefixo E2E-<rodada>;
 * a limpeza (global-teardown) só apaga o que tem esse prefixo. No projeto Vendas ORA as telas não têm regra por linha
 * (todo usuário vê todos os clientes) nem aba de pedidos dentro do cliente.
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id

async function filtrar(page: Page, nome: string) {
  await page.goto('/clientes')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.locator('input[name="NOME_EMPRESA_filter"]').fill(nome)
  await page.getByRole('button', { name: 'Pesquisar' }).click()
  return page.locator('tbody tr').filter({ hasText: nome })
}

test.describe('clientes no app Oracle', () => {
  test('cadastrar um cliente: grava os dados e a auditoria do robô (criado_por)', async ({ page }) => {
    const nome = `${RODADA} Cliente Novo`
    const robo = await idDoRobo()
    await entrar(page)
    await page.goto('/clientes/new')
    await page.locator('input[name="NOME_EMPRESA"]').fill(nome)
    await page.locator('input[name="EMAIL_CONTATO"]').fill('novo@e2e.com.br')
    await page.locator('select[name="STATUS_LEAD"]').selectOption('Em Negociação')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from clientes where nome_empresa = $1', [nome])).length).toBe(1)
    const [c] = await realQuery('select * from clientes where nome_empresa = $1', [nome])
    expect(c).toMatchObject({ email_contato: 'novo@e2e.com.br', status_lead: 'Em Negociação', criado_por: robo })
    expect(c.id).toMatch(/^[0-9A-F]{32}$/i) // id gerado pelo banco (SYS_GUID, 32 caracteres hexadecimais), nunca vazio
  })

  test('nome da empresa é obrigatório: salvar vazio não cria registro', async ({ page }) => {
    const antes = Number((await realQuery('select count(*) n from clientes'))[0].n)
    await entrar(page)
    await page.goto('/clientes/new')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await page.waitForTimeout(1500)
    expect(Number((await realQuery('select count(*) n from clientes'))[0].n)).toBe(antes)
  })

  test('edição e exclusão só do cliente criado pelo teste', async ({ page }) => {
    const nome = `${RODADA} Cliente Edicao`
    const robo = await idDoRobo()
    const [cli] = await realQuery(
      "insert into clientes (id, nome_empresa, status_lead, email_contato, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', 'antes@e2e.com.br', $2, now()) returning id", [nome, robo])
    await entrar(page)

    // edição: muda o e-mail e o status e salva (a auditoria grava quem alterou)
    await page.goto('/clientes/' + cli.id)
    await expect(page.locator('input[name="EMAIL_CONTATO"]')).toHaveValue('antes@e2e.com.br')
    await page.locator('input[name="EMAIL_CONTATO"]').fill('depois@e2e.com.br')
    await page.locator('select[name="STATUS_LEAD"]').selectOption('Contactado')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select email_contato, status_lead, atualizado_por from clientes where id = $1', [cli.id]))[0])
      .toMatchObject({ email_contato: 'depois@e2e.com.br', status_lead: 'Contactado', atualizado_por: robo })

    // exclusão pela lista (janela de confirmação do app)
    const linha = await filtrar(page, nome)
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Excluir"]').click()
    await page.getByRole('button', { name: /excluir|confirmar/i }).last().click()
    await expect.poll(async () => (await realQuery('select 1 from clientes where id = $1', [cli.id])).length).toBe(0)
  })

  test('ícones da linha: Visualizar, Editar e Excluir, nessa ordem', async ({ page }) => {
    const nome = `${RODADA} Cliente Icones`
    const robo = await idDoRobo()
    await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now())", [nome, robo])
    await entrar(page)
    const linha = await filtrar(page, nome)
    await expect(linha).toHaveCount(1)
    const titulos = await linha.locator('button, a').evaluateAll(els => els.map(e => (e as HTMLElement).title).filter(Boolean))
    expect(titulos).toEqual(['Visualizar', 'Editar', 'Excluir'])
  })

  test('Funcionário (sem regra por linha neste projeto) também enxerga os clientes existentes', async ({ page }) => {
    const [existente] = await realQuery("select nome_empresa from clientes where nome_empresa not like 'E2E-%' fetch first 1 rows only")
    await entrar(page, 'func')
    const linha = await filtrar(page, existente.nome_empresa)
    await expect(linha).not.toHaveCount(0)
  })
})
