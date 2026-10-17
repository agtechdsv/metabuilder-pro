import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Itens do pedido no app real, pelos três caminhos da tela de cliente (aba Pedidos):
 *   1) lápis do item -> janela "Editar Registro" -> salvar;  2) "+" do item -> linha nova na própria aba;  3) "Abrir Modal" -> janela "Novo Registro".
 * Em todos, o salvar da tela (Salvar Alterações) grava. Totais: Total Item = quantidade × preço; Total Pedido = soma dos Total Item (fórmulas do Studio).
 * Os dados de partida são criados direto no banco com criado_por = robô (a regra por linha só mostra ao robô o que ele criou).
 */
const visivel = (page: Page, sel: string) => page.locator(sel).locator('visible=true')
const aba = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true }).first().click()
// campo de busca do produto: o texto muda por contexto (linha: 'Digite para buscar...'; janela: 'Digite o valor para Produto...'); aceita as duas versões
const PLACEHOLDER_BUSCA = /Digite (para (buscar|pesquisar)|o valor para Produto).../
const janela = (page: Page) => page.locator('div[class*="fixed"][class*="inset-0"]').last()

async function idDe(email: string): Promise<string> {
  return (await realQuery('select id from usuarios where email = $1', [email]))[0].id
}
async function produto(nome: string): Promise<{ id: string }> {
  return (await realQuery('select id from produtos where nome = $1', [nome]))[0]
}

/** Cliente de teste com 1 pedido e 2 itens (2 × 1.500,00 e 3 × 800,00 = Total Pedido 5.400,00), criado pelo robô indicado. */
async function semear(sufixo: string, criador: string) {
  const nome = `${RODADA} ${sufixo}`
  const [cli] = await realQuery(
    "insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now()) returning id", [nome, criador])
  const [ped] = await realQuery(
    "insert into pedidos (id, cliente_id, status, data_pedido, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Pendente', '2026-10-08 12:00:00-03', $2, now()) returning id", [cli.id, criador])
  const a = await produto('Plataforma ERP Cloud')
  const b = await produto('Consultoria Javaaa')
  await realQuery("insert into itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, criado_por, atualizado_em) values (gen_random_uuid(), $1, $2, 2, 1500, $3, now())", [ped.id, a.id, criador])
  await realQuery("insert into itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, criado_por, atualizado_em) values (gen_random_uuid(), $1, $2, 3, 800, $3, now())", [ped.id, b.id, criador])
  return { nome, clienteId: cli.id as string, pedidoId: ped.id as string }
}

const itensDoPedido = (pedidoId: string) => realQuery(
  'select p.nome, i.quantidade, i.preco_unitario from itens_pedido i join produtos p on p.id = i.produto_id where i.pedido_id = $1 order by p.nome', [pedidoId])

/** Abre o cliente, vai à aba Pedidos e expande o pedido. */
async function abrirPedido(page: Page, clienteId: string) {
  await page.goto('/clientes/' + clienteId)
  await aba(page, 'Pedidos')
  await page.locator('button[title="Expandir / Recolher"]').locator('visible=true').first().click()
}

test.describe('itens do pedido no app real', () => {
  test('lápis do item: janela "Editar Registro", altera a quantidade e o Salvar da tela grava', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Item Lapis', robo)
    await entrar(page)
    await abrirPedido(page, d.clienteId)

    await page.locator('button[title="Editar Item"]').locator('visible=true').first().click() // 1º item (ordem da tela)
    const j = janela(page)
    await expect(j.getByText('Editar Registro')).toBeVisible()
    await j.locator('input[name="quantidade"]').fill('5')
    await j.getByRole('button', { name: 'Salvar Alterações' }).click()
    await expect(j.getByText('Editar Registro')).toHaveCount(0)

    // volta para a aba de pedidos; o Salvar da tela grava tudo
    await page.getByRole('button', { name: 'Salvar Alterações' }).last().click()
    await expect.poll(async () => (await itensDoPedido(d.pedidoId)).map(i => i.quantidade).sort()).toEqual([3, 5].sort())
  })

  test('"+" do item: linha nova na própria aba (produto por busca, mínimo 3 letras) e o Salvar da tela grava', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Item Mais', robo)
    await entrar(page)
    await abrirPedido(page, d.clienteId)

    await page.locator('button[title="Adicionar"]').locator('visible=true').first().click()
    const busca = page.getByPlaceholder(PLACEHOLDER_BUSCA).locator('visible=true').first()
    await busca.fill('Su')
    await expect(page.getByText(/pelo menos 3 caracteres/i)).toBeVisible()
    await busca.fill('Suporte')
    await page.getByText('Suporte Premium 24/7', { exact: true }).locator('visible=true').first().click()
    await visivel(page, 'input[name="quantidade"]').last().fill('4')
    await visivel(page, 'input[name="preco_unitario"]').last().pressSequentially('25000') // 250,00

    await page.getByRole('button', { name: 'Salvar Alterações' }).last().click()
    await expect.poll(async () => (await itensDoPedido(d.pedidoId)).length).toBe(3)
    const itens = await itensDoPedido(d.pedidoId)
    expect(itens.find(i => i.nome === 'Suporte Premium 24/7')).toMatchObject({ quantidade: 4 })
    expect(Number(itens.find(i => i.nome === 'Suporte Premium 24/7')!.preco_unitario)).toBe(250)
  })

  test('"Abrir Modal" do item: cadastra na janela "Novo Registro" e o Salvar da tela grava', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Item Modal', robo)
    await entrar(page)
    await abrirPedido(page, d.clienteId)

    await page.locator('button[title="Abrir Modal"]').locator('visible=true').last().click()
    const j = janela(page)
    await expect(j.getByText('Novo Item')).toBeVisible()
    await j.getByPlaceholder(PLACEHOLDER_BUSCA).fill('Storage')
    await j.getByText('Storage NAS 100TB', { exact: true }).first().click()
    await j.locator('input[name="quantidade"]').fill('1')
    await j.locator('input[name="preco_unitario"]').pressSequentially('990000') // 9.900,00
    await j.getByRole('button', { name: 'Salvar Alterações' }).click()
    await expect(j.getByText('Novo Item')).toHaveCount(0)

    await page.getByRole('button', { name: 'Salvar Alterações' }).last().click()
    await expect.poll(async () => (await itensDoPedido(d.pedidoId)).length).toBe(3)
    const novo = (await itensDoPedido(d.pedidoId)).find(i => i.nome === 'Storage NAS 100TB')!
    expect(novo.quantidade).toBe(1)
    expect(Number(novo.preco_unitario)).toBe(9900)
  })

  test('totais do Studio: Total Item = quantidade × preço e Total Pedido = soma dos itens', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Totais', robo)
    await entrar(page)
    await abrirPedido(page, d.clienteId)
    // Total Pedido: SOMA([itens_pedido] Total Item) = 2×1.500,00 + 3×800,00
    await expect(visivel(page, 'input[placeholder*="Total Pedido"]').first()).toHaveValue('5.400,00')
    // Total Item de cada item: quantidade × preço (campos calculados do Studio, name virt_*)
    await page.getByRole('button', { name: 'Expandir Todos' }).locator('visible=true').last().click()
    await expect.poll(async () => (await visivel(page, 'input[name^="virt_"]').evaluateAll(els => els.map(e => (e as HTMLInputElement).value))).sort())
      .toEqual(['2.400,00', '3.000,00', '5.400,00'])
  })

  test('textos da busca de produto iguais aos da plataforma (linha da aba e janela)', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Textos Busca', robo)
    await entrar(page)
    await abrirPedido(page, d.clienteId)
    await page.locator('button[title="Adicionar"]').locator('visible=true').first().click()
    await expect(page.getByPlaceholder('Digite para buscar...').locator('visible=true').first()).toBeVisible()
    await page.locator('button[title="Abrir Modal"]').locator('visible=true').last().click()
    await expect(janela(page).getByPlaceholder('Digite o valor para Produto...')).toBeVisible()
  })

  test('Data Pedido (tipo "date" no Studio) mostra só a data, como na plataforma', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Data', robo)
    await entrar(page)
    await abrirPedido(page, d.clienteId)
    const campo = visivel(page, 'input[name="data_pedido"]').first()
    await expect(campo).toHaveAttribute('type', 'date')
    await expect(campo).toHaveValue('2026-10-08')
  })
})

test.describe('lista de clientes e perfis no app real', () => {
  test('ícones da linha na ordem da plataforma e as ações Produtos e Pedidos abrem janela', async ({ page }) => {
    const robo = await idDe(REAL.user)
    const d = await semear('Icones', robo)
    await entrar(page)
    await page.goto('/clientes')
    await page.locator('input[name="nome_empresa_filter"]').fill(d.nome)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: d.nome })
    await expect(linha).toHaveCount(1)
    const titulos = await linha.locator('button, a').evaluateAll(els => els.map(e => (e as HTMLElement).title).filter(Boolean))
    expect(titulos).toEqual(['Visualizar', 'Editar', 'Excluir', 'Produtos', 'Pedidos'])

    await linha.locator('button[title="Pedidos"]').click()
    await expect(page.locator(`iframe[src*="pedidos---timeline"][src*="cliente_id=${d.clienteId}"]`)).toBeVisible()
  })

  test('Funcionária não enxerga o cliente criado pelo robô Administrador (regra por linha)', async ({ page }) => {
    const admin = await idDe(REAL.user)
    const d = await semear('So Admin', admin)
    await entrar(page, 'func')
    await page.goto('/clientes')
    await page.locator('input[name="nome_empresa_filter"]').fill(d.nome)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(page.locator('tbody tr').filter({ hasText: d.nome })).toHaveCount(0)
    await page.goto('/clientes/' + d.clienteId)
    await expect(page.getByText(d.nome)).toHaveCount(0)
  })
})
