import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Editar e excluir DENTRO da aba Pedidos do cliente (pedido e itens) e excluir um cliente que já tem pedidos e itens, no app real.
 * Cliente, pedido e itens de partida são criados no banco com o prefixo E2E-<rodada> e criado_por = robô.
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id
const visivel = (page: Page, sel: string) => page.locator(sel).locator('visible=true')
const aba = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true }).first().click()

async function semear(sufixo: string) {
  const robo = await idDoRobo()
  const nome = `${RODADA} ${sufixo}`
  const [cli] = await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now()) returning id", [nome, robo])
  const [ped] = await realQuery("insert into pedidos (id, cliente_id, status, data_pedido, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Pendente', '2026-10-08 12:00:00-03', $2, now()) returning id", [cli.id, robo])
  const [a] = await realQuery("select id from produtos where nome = 'Plataforma ERP Cloud'")
  const [b] = await realQuery("select id from produtos where nome = 'Consultoria Javaaa'")
  await realQuery("insert into itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, criado_por, atualizado_em) values (gen_random_uuid(), $1, $2, 2, 1500, $3, now())", [ped.id, a.id, robo])
  await realQuery("insert into itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, criado_por, atualizado_em) values (gen_random_uuid(), $1, $2, 3, 800, $3, now())", [ped.id, b.id, robo])
  return { nome, clienteId: cli.id as string, pedidoId: ped.id as string }
}
const itensDe = (pedidoId: string) => realQuery('select p.nome from itens_pedido i join produtos p on p.id = i.produto_id where i.pedido_id = $1 order by p.nome', [pedidoId])

async function abrirPedido(page: Page, clienteId: string) {
  await page.goto('/clientes/' + clienteId)
  await page.waitForLoadState('networkidle').catch(() => {})
  await aba(page, 'Pedidos')
  await page.locator('button[title="Expandir / Recolher"]').locator('visible=true').first().click()
}

async function confirmar(page: Page) {
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: /excluir|confirmar|sim/i }).last().click({ timeout: 3000 }).catch(() => {})
}

test.describe('editar e excluir dentro da aba Pedidos do cliente', () => {
  test('editar o pedido (status e funcionário) e o Salvar da tela grava', async ({ page }) => {
    const d = await semear('Aba Edita Pedido')
    await entrar(page)
    await abrirPedido(page, d.clienteId)
    await visivel(page, 'select[name="status"]').first().selectOption('Aprovado')
    await visivel(page, 'select[name="funcionario_id"]').first().selectOption({ label: 'Carlos Moura Silva' })
    await page.getByRole('button', { name: 'Salvar Alterações' }).last().click()
    await expect.poll(async () => (await realQuery('select p.status, f.nome as funcionario from pedidos p left join funcionarios f on f.id = p.funcionario_id where p.id = $1', [d.pedidoId]))[0])
      .toEqual({ status: 'Aprovado', funcionario: 'Carlos Moura Silva' })
  })

  test('excluir um item pela lixeira do item e o Salvar da tela grava (o outro item continua)', async ({ page }) => {
    const d = await semear('Aba Exclui Item')
    await entrar(page)
    await abrirPedido(page, d.clienteId)
    const linha = page.locator('div').filter({ hasText: /^Consultoria Javaaa/ }).filter({ has: page.locator('button[title="Excluir Item"]') }).last()
    await linha.locator('button[title="Excluir Item"]').click()
    await confirmar(page)
    await page.getByRole('button', { name: 'Salvar Alterações' }).last().click()
    await expect.poll(async () => (await itensDe(d.pedidoId)).map(i => i.nome)).toEqual(['Plataforma ERP Cloud'])
  })

  test('excluir o pedido pela aba e o Salvar da tela grava (o cliente continua)', async ({ page }) => {
    const d = await semear('Aba Exclui Pedido')
    await entrar(page)
    await page.goto('/clientes/' + d.clienteId)
    await page.waitForLoadState('networkidle').catch(() => {})
    await aba(page, 'Pedidos')
    await page.locator('button[title="Excluir"]').locator('visible=true').first().click()
    await confirmar(page)
    await page.getByRole('button', { name: 'Salvar Alterações' }).last().click()
    await expect.poll(async () => (await realQuery('select 1 from pedidos where id = $1', [d.pedidoId])).length).toBe(0)
    expect((await realQuery('select 1 from clientes where id = $1', [d.clienteId])).length).toBe(1)
  })

  test('excluir um cliente que já tem pedido e itens: remove tudo junto, sem erro', async ({ page }) => {
    const d = await semear('Aba Exclui Cliente')
    await entrar(page)
    await page.goto('/clientes')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.locator('input[name="nome_empresa_filter"]').fill(d.nome)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: d.nome })
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Excluir"]').click()
    await confirmar(page)
    await expect.poll(async () => (await realQuery('select 1 from clientes where id = $1', [d.clienteId])).length).toBe(0)
    expect((await realQuery('select 1 from pedidos where id = $1', [d.pedidoId])).length).toBe(0)
    expect((await itensDe(d.pedidoId)).length).toBe(0)
  })
})
