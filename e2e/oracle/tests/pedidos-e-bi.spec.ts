import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Pedidos (lista) e BI de pedidos no app exportado (Node + Oracle). Tudo leva o prefixo E2E-<rodada>; a limpeza só apaga isso.
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id

async function confirmarExclusao(page: Page) {
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: /excluir|confirmar/i }).last().click({ timeout: 4000 }).catch(() => {})
}

test.describe('pedidos e BI no app Oracle', () => {
  test('Pedidos (lista): criar para um cliente, editar o status e excluir', async ({ page }) => {
    const robo = await idDoRobo()
    const nomeCli = `${RODADA} Cliente Pedido`
    const [cli] = await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now()) returning id", [nomeCli, robo])
    await entrar(page)

    await page.goto('/pedidos/new')
    await page.locator('select[name="CLIENTE_ID"]').selectOption({ label: nomeCli })
    await page.locator('input[name="DATA_PEDIDO"]').fill('2026-10-20')
    await page.locator('select[name="STATUS"]').selectOption('Pendente')
    await page.locator('select[name="FUNCIONARIO_ID"]').selectOption({ label: 'Carlos Moura e Silva' })
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from pedidos where cliente_id = $1', [cli.id])).length).toBe(1)
    const [ped] = await realQuery('select p.*, f.nome as funcionario from pedidos p join funcionarios f on f.id = p.funcionario_id where p.cliente_id = $1', [cli.id])
    expect(ped).toMatchObject({ status: 'Pendente', funcionario: 'Carlos Moura e Silva', criado_por: robo })

    // editar o status
    await page.goto('/pedidos/' + ped.id)
    await expect(page.locator('select[name="STATUS"]')).toHaveValue('Pendente')
    await page.locator('select[name="STATUS"]').selectOption('Aprovado')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select status, atualizado_por from pedidos where id = $1', [ped.id]))[0]).toMatchObject({ status: 'Aprovado', atualizado_por: robo })

    // excluir pela lista (filtrando pelo cliente)
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.locator('select[name="CLIENTE_ID_filter"]').selectOption({ label: nomeCli })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: nomeCli })
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Excluir"]').click()
    await confirmarExclusao(page)
    await expect.poll(async () => (await realQuery('select 1 from pedidos where id = $1', [ped.id])).length).toBe(0)
  })

  test('Pedidos (lista): o total mostrado é igual ao do banco', async ({ page }) => {
    await entrar(page)
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle').catch(() => {})
    const total = Number((await realQuery('select count(*) n from pedidos'))[0].n)
    await expect(page.getByText(new RegExp(`TOTAL:\\s*${total}`, 'i'))).toBeVisible()
  })

  test('BI /bi---pedidos: painel abre, atualiza e tem tabela de dados', async ({ page }) => {
    await entrar(page)
    await page.goto('/bi---pedidos')
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByRole('button', { name: 'Atualizar agora' })).toBeVisible()
    await page.getByRole('button', { name: 'Atualizar agora' }).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
    expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
  })
})
