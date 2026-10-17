import { test, expect, type Page } from '@playwright/test'
import { entrar } from './helpers'
import { realQuery } from '../guard'

/**
 * Telas especiais do app real (galeria, kanban, fluxograma, timeline, gantt, agenda, mapa mental, mapa, BI): somente leitura.
 * Cada tela é conferida contra o que existe no banco (contagens) e nos controles principais. O robô Administrador enxerga todas as linhas
 * (exceção da regra por linha); os números abaixo vêm do próprio banco, não são fixos.
 */
const contar = async (sql: string): Promise<number> => Number((await realQuery(sql))[0].n)

async function abrir(page: Page, rota: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.locator('main').first()).toBeVisible()
}

test.describe('telas especiais no app real (somente leitura)', () => {
  test.beforeEach(async ({ page }) => { await entrar(page) })

  test('Produtos (galeria): um cartão por produto e filtro por categoria', async ({ page }) => {
    await abrir(page, '/produtos')
    const total = await contar('select count(*) n from produtos')
    await expect(page.locator('main img')).toHaveCount(total)
    // trocar o número de colunas não perde cartões
    await page.getByRole('button', { name: '4 colunas' }).click()
    await expect(page.locator('main img')).toHaveCount(total)
    // filtro por categoria: só os produtos da categoria escolhida
    const [cat] = await realQuery('select c.id, c.nome, count(*) n from categorias_produtos c join produtos p on p.categoria_id = c.id group by c.id, c.nome order by n desc limit 1')
    await page.locator('select[name="categoria_id_filter"]').selectOption({ label: cat.nome })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(page.locator('main img')).toHaveCount(Number(cat.n))
  })

  test('Kanban de tarefas: cartões com ações e filtros por projeto e responsável', async ({ page }) => {
    await abrir(page, '/kanban-tarefas')
    expect(await page.locator('main button[title="Detalhes"]').count()).toBeGreaterThan(0)
    await expect(page.locator('select[name="projeto_id_filter"]')).toBeVisible()
    await expect(page.locator('select[name="responsavel_id_filter"]')).toBeVisible()
    // filtrar por um projeto que tem tarefas reduz os cartões
    const [proj] = await realQuery('select p.id, p.nome, count(*) n from projetos p join tarefas t on t.projeto_id = p.id group by p.id, p.nome order by n asc limit 1')
    const todos = await page.locator('main button[title="Detalhes"]').count()
    await page.locator('select[name="projeto_id_filter"]').selectOption({ label: proj.nome })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    const filtrados = await page.locator('main button[title="Detalhes"]').count()
    expect(filtrados).toBe(Number(proj.n))
    expect(filtrados).toBeLessThanOrEqual(todos)
  })

  test('Tarefas - Fluxo (fluxograma): mostra o diagrama e o total de etapas igual ao banco', async ({ page }) => {
    await abrir(page, '/tarefas---fluxo')
    const total = await contar('select count(*) n from tarefas')
    await expect(page.getByText(new RegExp(`${total} ETAPAS`, 'i')).first()).toBeVisible()
    await expect(page.locator('.react-flow')).toBeVisible()
    for (const nome of ['Alternar Orientação', 'Alternar Arestas Animadas', 'Reorganizar Layout Automático']) {
      await expect(page.locator(`button[title^="${nome}"]`)).toBeVisible()
    }
  })

  test('Pedidos - Timeline: tela com os filtros (sem nome de campo: pela ordem Cliente, Funcionário), tamanhos e atualização de dados', async ({ page }) => {
    await abrir(page, '/pedidos---timeline')
    await expect(page.locator('main select').nth(0)).toBeVisible()
    await expect(page.locator('main select').nth(1)).toBeVisible()
    await expect(page.locator('button[title="Atualizar Dados"], button:has-text("Atualizar Dados")').first()).toBeVisible()
    // filtrar por cliente com pedido não deixa a tela com erro
    const [cli] = await realQuery('select c.nome_empresa from clientes c join pedidos p on p.cliente_id = c.id group by c.nome_empresa limit 1')
    await page.locator('main select').nth(0).selectOption({ label: cli.nome_empresa })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
  })

  test('Projetos (gantt): filtros, botão Hoje e ação Tarefas da linha', async ({ page }) => {
    await abrir(page, '/projetos')
    await expect(page.locator('select[name="gerente_id_filter"]')).toBeVisible()
    await expect(page.locator('select[name="cliente_id_filter"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hoje' })).toBeVisible()
    expect(await page.locator('main button[title="Tarefas"]').count()).toBeGreaterThan(0)
  })

  test('Entregas (agenda): mês atual, troca entre Mês, Semana e Dia', async ({ page }) => {
    await abrir(page, '/entregas')
    await expect(page.getByText(/de 20\d\d/i).first()).toBeVisible()
    const texto = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    const mes = await texto()
    await page.getByRole('button', { name: 'Semana', exact: true }).click()
    const semana = await texto()
    await page.getByRole('button', { name: 'Dia', exact: true }).click()
    const dia = await texto()
    expect(new Set([mes, semana, dia]).size).toBe(3) // cada visão mostra uma coisa diferente
    await page.getByRole('button', { name: 'Mês', exact: true }).click()
    await expect(page.getByText('DOM').first()).toBeVisible()
  })

  test('Empresa (mapa mental): um item por departamento', async ({ page }) => {
    await abrir(page, '/empresa')
    const total = await contar('select count(*) n from departamentos')
    await expect(page.getByText(new RegExp(`${total} REGISTROS`, 'i')).first()).toBeVisible()
    const nomes = (await realQuery('select nome from departamentos')).map(r => r.nome as string)
    for (const n of nomes) await expect(page.getByText(n, { exact: true }).first()).toBeVisible()
  })

  test('Clientes - Geospatial (mapa): total de registros e quantos têm coordenadas, iguais ao banco', async ({ page }) => {
    await abrir(page, '/clientes---geospatial')
    const total = await contar('select count(*) n from clientes')
    const comGps = await contar('select count(*) n from clientes where latitude is not null and longitude is not null')
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(page.getByText(new RegExp(`${comGps} DE ${total} REGISTROS COM COORDENADAS`, 'i'))).toBeVisible()
    await expect(page.getByText(new RegExp(`REGISTROS \\(${total}\\)`, 'i'))).toBeVisible()
  })

  for (const rota of ['/bi---pedidos', '/bi---laboratorio']) {
    test(`BI ${rota}: painel abre, atualiza e tem tabela de dados`, async ({ page }) => {
      await abrir(page, rota)
      await expect(page.getByRole('button', { name: 'Atualizar agora' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Organizar Dashboard' })).toBeVisible()
      await page.getByRole('button', { name: 'Atualizar agora' }).click()
      await page.waitForLoadState('networkidle').catch(() => {})
      await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
      expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
    })
  }

  test('Pedidos (lista): o Administrador vê todos os pedidos (total igual ao banco) e a ação Produtos da linha', async ({ page }) => {
    await abrir(page, '/pedidos')
    const total = await contar('select count(*) n from pedidos')
    await expect(page.getByText(new RegExp(`TOTAL:\\s*${total}`, 'i'))).toBeVisible()
    expect(await page.locator('main button[title="Produtos"]').count()).toBeGreaterThan(0)
  })

  test('Gerenciamento de Produtos (tela criada por IA): lista os produtos e as categorias do banco', async ({ page }) => {
    await abrir(page, '/gerenciamento-produtos')
    const total = await contar('select count(*) n from produtos')
    await expect(page.getByText(new RegExp(`${total} exibidos`, 'i'))).toBeVisible()
    const cats = (await realQuery('select nome from categorias_produtos')).map(r => r.nome as string)
    const opcoes = await page.locator('select option').allTextContents()
    for (const c of cats) expect(opcoes).toContain(c)
  })
})
