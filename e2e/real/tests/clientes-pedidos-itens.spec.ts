import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Cenário real (app exportado + banco crm): cadastrar um cliente com dados completos, um pedido e itens do pedido, tudo em uma tela,
 * como se faz à mão. Cada nome leva o prefixo E2E-<rodada>; a limpeza (global-teardown) só apaga o que tem esse prefixo.
 * As tabelas clientes, pedidos e itens_pedido têm regra por linha (criado_por = usuário): o robô só enxerga o que ele mesmo criou.
 */
const aba = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true }).first().click()
const visivel = (page: Page, sel: string) => page.locator(sel).locator('visible=true')

async function escolherProduto(page: Page, linha: number, nomeProduto: string) {
  const busca = page.getByPlaceholder('Digite para pesquisar...').locator('visible=true').nth(linha)
  await busca.fill(nomeProduto.slice(0, 6))
  await page.getByText(nomeProduto, { exact: true }).locator('visible=true').first().click()
}

async function idDoRobo(): Promise<string> {
  return (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id
}

test.describe('cliente + pedido + itens no app real', () => {
  test('cadastro completo: cliente, pedido com 2 itens, tudo salvo junto', async ({ page }) => {
    const nome = `${RODADA} Cliente Completo`
    await entrar(page)
    await page.goto('/clientes/new')

    // 1. dados do cliente
    await page.locator('input[name="nome_empresa"]').fill(nome)
    await page.locator('input[name="cnpj_cpf"]').pressSequentially('12345678000190')
    await page.locator('input[name="email_contato"]').fill('contato@e2e.com.br')
    await page.locator('input[name="endereco"]').fill('Rua dos Testes, 100 - São Paulo/SP')
    await page.locator('input[name="latitude"]').fill('-23.5505')
    await page.locator('input[name="longitude"]').fill('-46.6333')
    await page.locator('select[name="status_lead"]').selectOption('Novo')

    // 2. dados do pedido
    await aba(page, 'Pedidos')
    await page.getByRole('button', { name: 'Adicionar na Lista' }).locator('visible=true').first().click()
    await visivel(page, 'input[name="data_pedido"]').first().fill('2026-10-18T10:30')
    await visivel(page, 'select[name="status"]').first().selectOption('Pendente')
    await visivel(page, 'select[name="funcionario_id"]').first().selectOption({ label: 'Carlos Moura Silva' })

    // 3. itens do pedido: 2 produtos (máscara de moeda: os dígitos entram como centavos, 150000 -> 1.500,00)
    await page.locator('button[title="Adicionar"]').locator('visible=true').first().click()
    await escolherProduto(page, 0, 'Plataforma ERP Cloud')
    await visivel(page, 'input[name="quantidade"]').nth(0).fill('2')
    await visivel(page, 'input[name="preco_unitario"]').nth(0).pressSequentially('150000')
    await expect(visivel(page, 'input[name="preco_unitario"]').nth(0)).toHaveValue('1.500,00')

    await page.locator('button[title="Adicionar"]').locator('visible=true').first().click()
    await escolherProduto(page, 1, 'Switch de Rede 48-portas')
    await visivel(page, 'input[name="quantidade"]').nth(1).fill('3')
    await visivel(page, 'input[name="preco_unitario"]').nth(1).pressSequentially('80000')
    await expect(visivel(page, 'input[name="preco_unitario"]').nth(1)).toHaveValue('800,00')

    // 4. salvar tudo junto (cliente + pedido + itens)
    await aba(page, 'Clientes')
    await page.getByRole('button', { name: 'Criar Registro' }).first().click()
    await page.waitForURL(url => /\/clientes\/[0-9a-f-]{36}/.test(url.pathname), { timeout: 20_000 })

    const robo = await idDoRobo()
    const [cli] = await realQuery('select * from clientes where nome_empresa = $1', [nome])
    expect(cli, 'cliente gravado').toBeTruthy()
    expect(cli).toMatchObject({ email_contato: 'contato@e2e.com.br', status_lead: 'Novo', criado_por: robo })
    expect(cli.cnpj_cpf.replace(/\D/g, '')).toBe('12345678000190')
    expect(Number(cli.latitude)).toBeCloseTo(-23.5505, 4)

    const pedidos = await realQuery('select * from pedidos where cliente_id = $1', [cli.id])
    expect(pedidos, 'um pedido').toHaveLength(1)
    expect(pedidos[0]).toMatchObject({ status: 'Pendente', criado_por: robo })

    const itens = await realQuery(
      'select p.nome, i.quantidade, i.preco_unitario, i.criado_por from itens_pedido i join produtos p on p.id = i.produto_id where i.pedido_id = $1 order by p.nome', [pedidos[0].id])
    expect(itens.map(i => [i.nome, i.quantidade, Number(i.preco_unitario)])).toEqual([
      ['Plataforma ERP Cloud', 2, 1500],
      ['Switch de Rede 48-portas', 3, 800],
    ])
    expect(itens.every(i => i.criado_por === robo)).toBe(true)
  })

  test('edição e exclusão só do cliente criado pelo teste', async ({ page }) => {
    const nome = `${RODADA} Cliente Edicao`
    const robo = await idDoRobo()
    // cliente do teste, criado pelo robô (a regra por linha faz o robô enxergar só o que criou)
    const [cli] = await realQuery(
      "insert into clientes (id, nome_empresa, status_lead, email_contato, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', 'antes@e2e.com.br', $2, now()) returning id", [nome, robo])
    await entrar(page)

    // edição: muda o e-mail e o status e salva
    await page.goto('/clientes/' + cli.id)
    await expect(page.locator('input[name="email_contato"]')).toHaveValue('antes@e2e.com.br')
    await page.locator('input[name="email_contato"]').fill('depois@e2e.com.br')
    await page.locator('select[name="status_lead"]').selectOption('Contactado')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select email_contato, status_lead, atualizado_por from clientes where id = $1', [cli.id]))[0])
      .toMatchObject({ email_contato: 'depois@e2e.com.br', status_lead: 'Contactado', atualizado_por: robo })

    // exclusão pela lista (janela de confirmação do app)
    await page.goto('/clientes')
    await page.locator('input[name="nome_empresa_filter"]').fill(nome)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: nome })
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Excluir"]').click()
    await page.getByRole('button', { name: /excluir|confirmar/i }).last().click()
    await expect.poll(async () => (await realQuery('select 1 from clientes where id = $1', [cli.id])).length).toBe(0)
  })

  test('regra por linha: o robô não enxerga clientes criados por outras pessoas', async ({ page }) => {
    const [existente] = await realQuery("select id, nome_empresa from clientes where nome_empresa not like 'E2E-%' limit 1")
    await entrar(page)
    await page.goto('/clientes')
    await page.locator('input[name="nome_empresa_filter"]').fill(existente.nome_empresa)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(page.locator('tbody tr').filter({ hasText: existente.nome_empresa })).toHaveCount(0)
    // e abrir pelo endereço também não entrega o registro de outra pessoa
    await page.goto('/clientes/' + existente.id)
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByText(existente.nome_empresa)).toHaveCount(0)
    await expect(page.locator('input[name="nome_empresa"]')).toHaveCount(0)
  })
})
