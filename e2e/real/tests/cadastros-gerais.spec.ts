import { test, expect, type Page } from '@playwright/test'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Cadastros dos demais casos de uso no app real: Produtos (galeria), Gerenciamento de Produtos (tela criada por IA), Pedidos,
 * Empresa (mapa mental = departamentos) e Clientes - Geospatial (mapa). Tudo leva o prefixo E2E-<rodada>; a limpeza só apaga isso.
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id
const numero = (txt: string) => Number(txt.replace(/\./g, '').replace(',', '.'))

/** Confirma a exclusão, seja janela do navegador ou janela do app. */
async function confirmarExclusao(page: Page) {
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: /excluir|confirmar/i }).last().click({ timeout: 4000 }).catch(() => {})
}

async function clienteDeTeste(sufixo: string, criador: string) {
  const nome = `${RODADA} ${sufixo}`
  const [c] = await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', $2, now()) returning id", [nome, criador])
  return { nome, id: c.id as string }
}

test.describe('cadastros gerais no app real', () => {
  test('Produtos (galeria): criar com categoria e preço, editar e excluir pela galeria', async ({ page }) => {
    const nome = `${RODADA} Produto`
    const robo = await idDoRobo()
    await entrar(page)

    await page.goto('/produtos/new')
    await page.locator('input[name="nome"]').fill(nome)
    await page.locator('input[name="descricao"]').fill('Produto criado pelo teste')
    await page.locator('select[name="categoria_id"]').selectOption({ label: 'Licenças de Software' })
    await page.locator('input[name="url_imagem"]').fill('https://exemplo.com/e2e.jpg')
    await page.locator('input[name="preco_unitario"]').pressSequentially('19990')
    const preco = numero(await page.locator('input[name="preco_unitario"]').inputValue())
    await page.locator('input[name="quantidade"]').fill('7')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from produtos where nome = $1', [nome])).length).toBe(1)
    const [p] = await realQuery('select p.*, c.nome as categoria from produtos p left join categorias_produtos c on c.id = p.categoria_id where p.nome = $1', [nome])
    expect(p).toMatchObject({ descricao: 'Produto criado pelo teste', categoria: 'Licenças de Software', quantidade: 7, criado_por: robo })
    expect(Number(p.preco_unitario)).toBe(preco)

    // editar
    await page.goto('/produtos/' + p.id)
    await expect(page.locator('input[name="nome"]')).toHaveValue(nome)
    await page.locator('input[name="quantidade"]').fill('9')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select quantidade from produtos where id = $1', [p.id]))[0].quantidade).toBe(9)

    // excluir pela galeria: o cartão do produto aparece com o nome
    await page.goto('/produtos')
    await page.waitForLoadState('networkidle').catch(() => {}) // a página mostra um esqueleto por instantes (barra de filtro duplicada)
    await page.locator('input[name="nome_filter"]').fill(nome)
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()
    await page.locator('main button[title="Excluir"]').first().click()
    await confirmarExclusao(page)
    await expect.poll(async () => (await realQuery('select 1 from produtos where id = $1', [p.id])).length).toBe(0)
  })

  test('Gerenciamento de Produtos (tela da IA): cadastrar, editar o preço e excluir', async ({ page }) => {
    const nome = `${RODADA} Produto IA`
    await entrar(page)
    await page.goto('/gerenciamento-produtos')
    await page.waitForLoadState('networkidle').catch(() => {})

    await page.getByPlaceholder(/Ex: Notebook/).fill(nome)
    await page.getByPlaceholder('0,00').first().fill('250.5')
    await page.locator('main select').first().selectOption({ label: 'Serviços Profissionais' })
    await page.getByPlaceholder(/Especificações/).fill('Cadastrado pelo teste da tela de IA')
    await page.getByRole('button', { name: 'Cadastrar Produto' }).click()
    await expect.poll(async () => (await realQuery('select 1 from produtos where nome = $1', [nome])).length).toBe(1)
    const [p] = await realQuery('select p.*, c.nome as categoria from produtos p left join categorias_produtos c on c.id = p.categoria_id where p.nome = $1', [nome])
    expect(Number(p.preco_unitario)).toBe(250.5)
    expect(p.categoria).toBe('Serviços Profissionais')

    // a linha aparece na tabela; editar preenche o formulário
    await page.getByPlaceholder(/Filtrar produtos/).fill(nome)
    const linha = page.locator('tbody tr').filter({ hasText: nome })
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title^="Editar produto"]').click()
    await expect(page.getByPlaceholder(/Ex: Notebook/)).toHaveValue(nome)
    await page.getByPlaceholder('0,00').first().fill('300')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await expect.poll(async () => Number((await realQuery('select preco_unitario from produtos where id = $1', [p.id]))[0].preco_unitario)).toBe(300)

    // excluir
    await page.getByPlaceholder(/Filtrar produtos/).fill(nome)
    await page.locator('tbody tr').filter({ hasText: nome }).locator('button[title^="Excluir produto"]').click()
    await confirmarExclusao(page)
    await expect.poll(async () => (await realQuery('select 1 from produtos where id = $1', [p.id])).length).toBe(0)
  })

  test('Pedidos (lista): criar para um cliente, editar o status e excluir', async ({ page }) => {
    const robo = await idDoRobo()
    const cli = await clienteDeTeste('Cliente Pedido', robo)
    await entrar(page)

    await page.goto('/pedidos/new')
    await page.locator('select[name="cliente_id"]').selectOption({ label: cli.nome })
    await page.locator('input[name="data_pedido"]').fill('2026-10-20')
    await page.locator('select[name="status"]').selectOption('Pendente')
    await page.locator('select[name="funcionario_id"]').selectOption({ label: 'Carlos Moura Silva' })
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from pedidos where cliente_id = $1', [cli.id])).length).toBe(1)
    const [ped] = await realQuery('select p.*, f.nome as funcionario from pedidos p join funcionarios f on f.id = p.funcionario_id where p.cliente_id = $1', [cli.id])
    expect(ped).toMatchObject({ status: 'Pendente', funcionario: 'Carlos Moura Silva', criado_por: robo })

    // editar o status
    await page.goto('/pedidos/' + ped.id)
    await expect(page.locator('select[name="status"]')).toHaveValue('Pendente')
    await page.locator('select[name="status"]').selectOption('Aprovado')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select status from pedidos where id = $1', [ped.id]))[0].status).toBe('Aprovado')

    // excluir pela lista (filtrando pelo cliente)
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.locator('select[name="cliente_id_filter"]').selectOption({ label: cli.nome })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    const linha = page.locator('tbody tr').filter({ hasText: cli.nome })
    await expect(linha).toHaveCount(1)
    await linha.locator('button[title="Excluir"]').click()
    await confirmarExclusao(page)
    await expect.poll(async () => (await realQuery('select 1 from pedidos where id = $1', [ped.id])).length).toBe(0)
  })

  test('Empresa (mapa mental): novo departamento aparece no mapa e o nome pode ser editado', async ({ page }) => {
    const nome = `${RODADA} Setor`
    await entrar(page)
    await page.goto('/empresa/new')
    await page.locator('input[name="nome"]').fill(nome)
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from departamentos where nome = $1', [nome])).length).toBe(1)
    const [dep] = await realQuery('select id from departamentos where nome = $1', [nome])

    await page.goto('/empresa')
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()

    await page.goto('/empresa/' + dep.id)
    await page.locator('input[name="nome"]').fill(nome + ' B')
    await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
    await expect.poll(async () => (await realQuery('select nome from departamentos where id = $1', [dep.id]))[0].nome).toBe(nome + ' B')
  })

  test('Clientes - Geospatial (mapa): cliente novo com coordenadas entra na contagem do mapa', async ({ page }) => {
    const nome = `${RODADA} Cliente Mapa`
    const robo = await idDoRobo()
    await entrar(page)
    await page.goto('/clientes---geospatial/new')
    await page.locator('input[name="nome_empresa"]').fill(nome)
    await page.locator('input[name="latitude"]').fill('-22.9068')
    await page.locator('input[name="longitude"]').fill('-43.1729')
    await page.locator('select[name="status_lead"]').selectOption('Novo')
    await page.getByRole('button', { name: 'Criar Registro' }).click()
    await expect.poll(async () => (await realQuery('select 1 from clientes where nome_empresa = $1', [nome])).length).toBe(1)
    const [c] = await realQuery('select latitude, longitude, criado_por from clientes where nome_empresa = $1', [nome])
    expect(Number(c.latitude)).toBeCloseTo(-22.9068, 4)
    expect(Number(c.longitude)).toBeCloseTo(-43.1729, 4)
    expect(c.criado_por).toBe(robo)

    const total = Number((await realQuery('select count(*) n from clientes'))[0].n)
    const comGps = Number((await realQuery('select count(*) n from clientes where latitude is not null and longitude is not null'))[0].n)
    await page.goto('/clientes---geospatial')
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByText(new RegExp(`${comGps} DE ${total} REGISTROS COM COORDENADAS`, 'i'))).toBeVisible()
    await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()
  })
})
