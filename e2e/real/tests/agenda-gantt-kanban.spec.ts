import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Cadastros das telas especiais no app real: Entregas (agenda), Projetos (gantt), Tarefas (kanban e fluxograma) e Pedidos - Timeline.
 * Os dados de apoio (cliente, pedido, projeto) são criados direto no banco com o prefixo E2E-<rodada>; a limpeza só apaga isso.
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id
const contar = async (sql: string, p: unknown[] = []) => Number((await realQuery(sql, p))[0].n)

async function confirmarExclusao(page: Page) {
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: /excluir|confirmar/i }).last().click({ timeout: 4000 }).catch(() => {})
}
async function aberta(page: Page, rota: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function clienteDeTeste(sufixo: string, robo: string) {
  const nome = `${RODADA} ${sufixo}`
  const [c] = await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now()) returning id", [nome, robo])
  return { nome, id: c.id as string }
}
async function pedidoDeTeste(clienteId: string, robo: string) {
  const [p] = await realQuery("insert into pedidos (id, cliente_id, status, data_pedido, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Aprovado', '2026-10-10 12:00:00-03', $2, now()) returning id", [clienteId, robo])
  return p.id as string
}
async function projetoDeTeste(sufixo: string, clienteId: string, robo: string) {
  const nome = `${RODADA} ${sufixo}`
  const [p] = await realQuery("insert into projetos (id, nome, cliente_id, status, data_inicio, data_fim, percentual_conclusao, criado_por, atualizado_em) values (gen_random_uuid(), $1, $2, 'Planejamento', '2026-11-01', '2026-11-30', 0, $3, now()) returning id", [nome, clienteId, robo])
  return { nome, id: p.id as string }
}

test.describe('agenda, gantt e kanban no app real', () => {
  test('Entregas (agenda): criar para um pedido, aparecer na agenda, editar o status', async ({ page }) => {
    const robo = await idDoRobo()
    const cli = await clienteDeTeste('Cliente Entrega', robo)
    const pedidoId = await pedidoDeTeste(cli.id, robo)
    await entrar(page)

    await page.goto('/entregas/new')
    await page.locator('select[name="pedido_id"]').selectOption({ value: pedidoId })
    await page.locator('input[name="data_estimada"]').fill('2026-10-25')
    await page.locator('select[name="status"]').selectOption('Enviado')
    await page.locator('select[name="motorista_id"]').selectOption({ label: 'Carlos Moura Silva' })
    await page.locator('input[name="lat_atual"]').fill('-23.55')
    await page.locator('input[name="lng_atual"]').fill('-46.63')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => contar('select count(*) n from entregas where pedido_id = $1', [pedidoId])).toBe(1)
    const [e] = await realQuery('select e.*, f.nome as motorista from entregas e join funcionarios f on f.id = e.motorista_id where e.pedido_id = $1', [pedidoId])
    expect(e).toMatchObject({ status: 'Enviado', motorista: 'Carlos Moura Silva', criado_por: robo })
    expect(new Date(e.data_estimada).toISOString().slice(0, 10)).toBe('2026-10-25')

    // editar o status pelo formulário
    await page.goto('/entregas/' + e.id)
    await expect(page.locator('select[name="status"]')).toHaveValue('Enviado')
    await page.locator('select[name="status"]').selectOption('Entregue')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select status from entregas where id = $1', [e.id]))[0].status).toBe('Entregue')

    // a agenda abre sem erro e o filtro de status "Entregue" não derruba a tela
    await aberta(page, '/entregas')
    await page.locator('select[name="status_filter"]').selectOption('Entregue')
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
  })

  test('Projetos (gantt): criar, editar o percentual e excluir', async ({ page }) => {
    const robo = await idDoRobo()
    const cli = await clienteDeTeste('Cliente Projeto', robo)
    const nome = `${RODADA} Projeto`
    await entrar(page)

    await page.goto('/projetos/new')
    await page.locator('input[name="nome"]').fill(nome)
    await page.locator('select[name="gerente_id"]').selectOption({ label: 'Carlos Moura Silva' })
    await page.locator('select[name="cliente_id"]').selectOption({ label: cli.nome })
    await page.locator('select[name="status"]').selectOption('Planejamento')
    await page.locator('input[name="data_inicio"]').fill('2026-11-01')
    await page.locator('input[name="data_fim"]').fill('2026-11-30')
    // o Studio põe a máscara 0.000,00 neste campo: os dígitos entram como centavos (2500 -> 25,00)
    await page.locator('input[name="percentual_conclusao"]').pressSequentially('2500')
    await expect(page.locator('input[name="percentual_conclusao"]')).toHaveValue('25,00')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => contar('select count(*) n from projetos where nome = $1', [nome])).toBe(1)
    const [p] = await realQuery('select * from projetos where nome = $1', [nome])
    expect(p).toMatchObject({ status: 'Planejamento', cliente_id: cli.id, criado_por: robo })
    expect(Number(p.percentual_conclusao)).toBe(25)

    // aparece no gantt
    await aberta(page, '/projetos')
    await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()

    // editar o percentual
    await page.goto('/projetos/' + p.id)
    await page.locator('input[name="percentual_conclusao"]').fill('')
    await page.locator('input[name="percentual_conclusao"]').pressSequentially('6000')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => Number((await realQuery('select percentual_conclusao from projetos where id = $1', [p.id]))[0].percentual_conclusao)).toBe(60)

    // excluir (sem tarefas): pelo botão Excluir da linha do gantt
    await aberta(page, '/projetos')
    const linha = page.locator('div, tr').filter({ hasText: nome }).filter({ has: page.locator('button[title="Excluir"]') }).last()
    await linha.locator('button[title="Excluir"]').click()
    await confirmarExclusao(page)
    await expect.poll(async () => contar('select count(*) n from projetos where id = $1', [p.id])).toBe(0)
  })

  test('Projetos (gantt): a ação Tarefas da linha abre as tarefas do projeto', async ({ page }) => {
    const robo = await idDoRobo()
    const cli = await clienteDeTeste('Cliente Acao', robo)
    const proj = await projetoDeTeste('Projeto Acao', cli.id, robo)
    await entrar(page)
    await aberta(page, '/projetos')
    const linha = page.locator('div, tr').filter({ hasText: proj.nome }).filter({ has: page.locator('button[title="Tarefas"]') }).last()
    await linha.locator('button[title="Tarefas"]').click()
    await expect(page.locator(`iframe[src*="${proj.id}"]`)).toBeVisible()
  })

  test('Tarefas: cria no kanban com projeto, responsável e prioridade; muda o status; a etapa-filha liga à antecessora no fluxo', async ({ page }) => {
    const robo = await idDoRobo()
    const cli = await clienteDeTeste('Cliente Tarefa', robo)
    const proj = await projetoDeTeste('Projeto Tarefa', cli.id, robo)
    const tituloA = `${RODADA} Tarefa A`
    const tituloB = `${RODADA} Tarefa B`
    await entrar(page)

    // Tarefa A pelo kanban
    await page.goto('/kanban-tarefas/new')
    await page.locator('input[name="titulo"]').fill(tituloA)
    await page.locator('select[name="projeto_id"]').selectOption({ label: proj.nome })
    await page.locator('select[name="prioridade"]').selectOption('Alta')
    await page.locator('select[name="responsavel_id"]').selectOption({ label: 'Carlos Moura Silva' })
    await page.locator('input[name="data_vencimento"]').fill('2026-11-15')
    await page.locator('select[name="status"]').selectOption('A Fazer')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => contar('select count(*) n from tarefas where titulo = $1', [tituloA])).toBe(1)
    const [a] = await realQuery('select * from tarefas where titulo = $1', [tituloA])
    expect(a).toMatchObject({ projeto_id: proj.id, prioridade: 'Alta', status: 'A Fazer', criado_por: robo })

    // o cartão aparece no kanban (filtrando pelo projeto)
    await aberta(page, '/kanban-tarefas')
    await page.locator('select[name="projeto_id_filter"]').selectOption({ label: proj.nome })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(page.getByText(tituloA, { exact: true }).first()).toBeVisible()

    // muda o status pelo formulário de edição
    await page.goto('/kanban-tarefas/' + a.id)
    await page.locator('select[name="status"]').selectOption('Em Andamento')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select status from tarefas where id = $1', [a.id]))[0].status).toBe('Em Andamento')

    // Tarefa B pelo fluxograma, com a A como antecessora
    const etapasAntes = await contar('select count(*) n from tarefas')
    await page.goto('/tarefas---fluxo/new')
    await page.locator('input[name="titulo"]').fill(tituloB)
    await page.locator('select[name="projeto_id"]').selectOption({ label: proj.nome })
    await page.locator('select[name="prioridade"]').selectOption('Média')
    await page.locator('select[name="tarefa_antecessora_id"]').selectOption({ label: tituloA })
    await page.locator('select[name="status"]').selectOption('A Fazer')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => contar('select count(*) n from tarefas where titulo = $1', [tituloB])).toBe(1)
    const [b] = await realQuery('select * from tarefas where titulo = $1', [tituloB])
    expect(b.tarefa_antecessora_id).toBe(a.id)

    // o fluxograma conta as duas etapas novas
    await aberta(page, '/tarefas---fluxo')
    await expect(page.getByText(new RegExp(`${etapasAntes + 1} ETAPAS`, 'i')).first()).toBeVisible()
  })

  test('Pedidos - Timeline: criar um pedido pelo formulário da timeline e editar o status', async ({ page }) => {
    const robo = await idDoRobo()
    const cli = await clienteDeTeste('Cliente Timeline', robo)
    await entrar(page)

    await page.goto('/pedidos---timeline/new')
    await page.locator('select[name="cliente_id"]').selectOption({ label: cli.nome })
    await page.locator('select[name="funcionario_id"]').selectOption({ label: 'Carlos Moura Silva' })
    await page.locator('select[name="status"]').selectOption('Pendente')
    await page.locator('input[name="data_pedido"]').fill('2026-10-22')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => contar('select count(*) n from pedidos where cliente_id = $1', [cli.id])).toBe(1)
    const [ped] = await realQuery('select * from pedidos where cliente_id = $1', [cli.id])
    expect(ped).toMatchObject({ status: 'Pendente', criado_por: robo })

    await page.goto('/pedidos---timeline/' + ped.id)
    await page.locator('select[name="status"]').selectOption('Enviado')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select status from pedidos where id = $1', [ped.id]))[0].status).toBe('Enviado')
  })
})
