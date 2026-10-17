import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Cadastros simples no app real: Departamentos e Funcs (Funcionários). Tudo o que o teste cria leva o prefixo E2E-<rodada>
 * e a limpeza (global-teardown) só apaga isso. Funcs depende de Departamento (escolhido numa lista).
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id

async function filtrarPorNome(page: Page, rota: string, nome: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle').catch(() => {}) // evita pegar a barra de filtro duplicada do esqueleto de carregamento
  await page.locator('input[name="nome_filter"]').fill(nome)
  await page.getByRole('button', { name: 'Pesquisar' }).click()
  return page.locator('tbody tr').filter({ hasText: nome })
}

async function excluirDaLista(page: Page, linha: ReturnType<Page['locator']>) {
  await linha.locator('button[title="Excluir"]').click()
  await page.getByRole('button', { name: /excluir|confirmar/i }).last().click()
}

test.describe('Departamentos no app real', () => {
  test('criar, editar e excluir um departamento (auditoria do robô gravada)', async ({ page }) => {
    const nome = `${RODADA} Depto`
    const robo = await idDoRobo()
    await entrar(page)

    // criar
    await page.goto('/departamentos/new')
    await page.locator('input[name="nome"]').fill(nome)
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select criado_por from departamentos where nome = $1', [nome])).length).toBe(1)
    expect((await realQuery('select criado_por from departamentos where nome = $1', [nome]))[0].criado_por).toBe(robo)

    // aparece na lista; editar pelo ícone Editar
    const linha = await filtrarPorNome(page, '/departamentos', nome)
    await expect(linha).toHaveCount(1)
    await linha.locator('a[title="Editar"]').click()
    await expect(page.locator('input[name="nome"]')).toHaveValue(nome)
    const novoNome = `${nome} 2`
    await page.locator('input[name="nome"]').fill(novoNome)
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select atualizado_por from departamentos where nome = $1', [novoNome]))[0]?.atualizado_por).toBe(robo)

    // excluir pela lista
    const linha2 = await filtrarPorNome(page, '/departamentos', novoNome)
    await expect(linha2).toHaveCount(1)
    await excluirDaLista(page, linha2)
    await expect.poll(async () => (await realQuery('select 1 from departamentos where nome = $1', [novoNome])).length).toBe(0)
  })

  test('a ação Funcionários da linha abre a lista de funcionários do departamento', async ({ page }) => {
    const nome = `${RODADA} Depto Acao`
    const [dep] = await realQuery("insert into departamentos (id, nome, atualizado_em) values (gen_random_uuid(), $1, now()) returning id", [nome])
    await entrar(page)
    const linha = await filtrarPorNome(page, '/departamentos', nome)
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Funcionários"]').click()
    await expect(page.locator(`iframe[src*="/funcs"][src*="${dep.id}"]`)).toBeVisible()
  })

  test('nome é obrigatório: salvar vazio não cria registro', async ({ page }) => {
    await entrar(page)
    const antes = Number((await realQuery('select count(*) n from departamentos'))[0].n)
    await page.goto('/departamentos/new')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(/\/departamentos\/new/)
    expect(Number((await realQuery('select count(*) n from departamentos'))[0].n)).toBe(antes)
  })
})

test.describe('Funcs no app real', () => {
  test('criar func com departamento, editar o cargo e excluir', async ({ page }) => {
    const nomeDep = `${RODADA} Depto Func`
    const nome = `${RODADA} Func`
    const robo = await idDoRobo()
    const [dep] = await realQuery("insert into departamentos (id, nome, atualizado_em) values (gen_random_uuid(), $1, now()) returning id", [nomeDep])
    await entrar(page)

    await page.goto('/funcs/new')
    await page.locator('input[name="nome"]').fill(nome)
    await page.locator('input[name="email"]').fill('func@e2e.com.br')
    await page.locator('select[name="departamento_id"]').selectOption({ label: nomeDep })
    await page.locator('input[name="cargo"]').fill('Analista de Testes')
    await page.locator('input[name="data_contratacao"]').fill('2026-01-15')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from funcionarios where nome = $1', [nome])).length).toBe(1)
    const [f] = await realQuery('select * from funcionarios where nome = $1', [nome])
    expect(f).toMatchObject({ email: 'func@e2e.com.br', cargo: 'Analista de Testes', departamento_id: dep.id, criado_por: robo })
    expect(new Date(f.data_contratacao).toISOString().slice(0, 10)).toBe('2026-01-15')

    // a lista mostra o nome do departamento (não o código)
    const linha = await filtrarPorNome(page, '/funcs', nome)
    await expect(linha).toHaveCount(1)
    await expect(linha).toContainText(nomeDep)

    // editar o cargo
    await linha.locator('a[title="Editar"]').click()
    await expect(page.locator('input[name="cargo"]')).toHaveValue('Analista de Testes')
    await page.locator('input[name="cargo"]').fill('Líder de Testes')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select cargo from funcionarios where nome = $1', [nome]))[0].cargo).toBe('Líder de Testes')

    // excluir
    const linha2 = await filtrarPorNome(page, '/funcs', nome)
    await excluirDaLista(page, linha2)
    await expect.poll(async () => (await realQuery('select 1 from funcionarios where nome = $1', [nome])).length).toBe(0)
  })

  test('campos obrigatórios (nome, e-mail, cargo, data): salvar vazio não cria registro', async ({ page }) => {
    await entrar(page)
    const antes = Number((await realQuery('select count(*) n from funcionarios'))[0].n)
    await page.goto('/funcs/new')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(/\/funcs\/new/)
    expect(Number((await realQuery('select count(*) n from funcionarios'))[0].n)).toBe(antes)
  })

  test('a lista de departamentos do formulário traz os departamentos existentes', async ({ page }) => {
    await entrar(page)
    await page.goto('/funcs/new')
    const nomes = (await realQuery("select nome from departamentos where nome not like 'E2E-%'")).map(r => r.nome)
    const opcoes = await page.locator('select[name="departamento_id"] option').allTextContents()
    for (const n of nomes) expect(opcoes).toContain(n)
  })
})
