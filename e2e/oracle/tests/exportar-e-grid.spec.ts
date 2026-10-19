import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { entrar, RODADA } from './helpers'
import { realQuery, REAL } from '../guard'

/**
 * Exportar (Excel, CSV, JSON, linhas marcadas, Central de Downloads) e comportamentos gerais da grid (paginação, ordenação, filtros,
 * Visualizar, Cancelar) no app real. Os clientes de apoio são criados no banco com o prefixo E2E-<rodada> e criado_por = robô.
 */
const idDoRobo = async (): Promise<string> => (await realQuery('select id from usuarios where email = $1', [REAL.user]))[0].id

async function semearClientes(qtd: number, sufixo: string, status = 'Novo'): Promise<string[]> {
  const robo = await idDoRobo()
  const nomes: string[] = []
  for (let i = 1; i <= qtd; i++) {
    const nome = `${RODADA} ${sufixo} ${String(i).padStart(2, '0')}`
    await realQuery("insert into clientes (id, nome_empresa, status_lead, email_contato, criado_por, atualizado_em) values (gen_random_uuid(), $1, $2, $3, $4, now())", [nome, status, `c${i}@e2e.com.br`, robo])
    nomes.push(nome)
  }
  return nomes
}

async function filtrarClientes(page: Page, nome: string) {
  await page.goto('/clientes')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.locator('input[name="NOME_EMPRESA_filter"]').fill(nome)
  await page.getByRole('button', { name: 'Pesquisar' }).click()
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function baixar(page: Page, formato: RegExp) {
  await page.getByRole('button', { name: /^Exportar/ }).first().click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: formato }).click()])
  return { name: download.suggestedFilename(), buf: fs.readFileSync((await download.path())!) }
}

test.describe('exportação no app real', () => {
  test('CSV e JSON trazem só o que está filtrado na tela, com as colunas da grid', async ({ page }) => {
    const nomes = await semearClientes(3, 'Exp')
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Exp`)

    const csv = await baixar(page, /csv/i)
    expect(csv.name).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/)
    const texto = csv.buf.toString('utf8')
    expect(texto.charCodeAt(0)).toBe(0xfeff) // BOM para o Excel
    const linhas = texto.split('\r\n').filter(Boolean)
    expect(linhas).toHaveLength(1 + nomes.length) // cabeçalho + as 3 filtradas (não o banco inteiro)
    for (const col of ['Nome Empresa', 'Cnpj Cpf', 'Email Contato', 'Status Lead']) expect(linhas[0]).toContain(col)
    for (const n of nomes) expect(texto).toContain(n)

    const json = await baixar(page, /json/i)
    const itens = JSON.parse(json.buf.toString('utf8')) as any[]
    expect(itens).toHaveLength(nomes.length)
    expect(JSON.stringify(itens)).toContain('c1@e2e.com.br')
  })

  test('Excel (.xlsx) é um arquivo válido', async ({ page }) => {
    await semearClientes(2, 'Xls')
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Xls`)
    const xlsx = await baixar(page, /excel|xlsx/i)
    expect(xlsx.name).toMatch(/\.xlsx$/)
    expect(xlsx.buf.subarray(0, 2).toString()).toBe('PK')
    expect(xlsx.buf.length).toBeGreaterThan(1000)
  })

  test('com linhas marcadas, exporta só elas; marcar todas e desmarcar', async ({ page }) => {
    const nomes = await semearClientes(4, 'Sel')
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Sel`)
    const marcas = page.locator('tbody input[type="checkbox"]')
    await expect(marcas).toHaveCount(4)
    await marcas.nth(0).check()
    await marcas.nth(2).check()
    await expect(page.getByRole('button', { name: /^Exportar.*\(2\)/ })).toBeVisible()
    const json = await baixar(page, /json/i)
    const itens = JSON.parse(json.buf.toString('utf8')) as any[]
    expect(itens).toHaveLength(2)

    await page.locator('thead input[type="checkbox"]').check()
    await expect(page.getByRole('button', { name: /^Exportar.*\(4\)/ })).toBeVisible()
    await page.locator('thead input[type="checkbox"]').uncheck()
    await expect(page.getByRole('button', { name: /^Exportar/ }).first()).not.toContainText('(')
    void nomes
  })

  test('Central de Downloads lista a exportação, baixa o arquivo e exclui', async ({ page }) => {
    await semearClientes(1, 'Dl')
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Dl`)
    await baixar(page, /csv/i)

    await page.goto('/downloads')
    await page.waitForLoadState('networkidle').catch(() => {})
    const arquivos = page.getByText(/^clientes-\d{8}-\d{6}-[0-9a-f]{4}\.csv$/)
    await expect(arquivos.first()).toBeVisible()
    const antes = await arquivos.count()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('a[title="Baixar"]').first().click()])
    expect(fs.readFileSync((await dl.path())!).toString('utf8')).toContain(`${RODADA} Dl 01`)
    await page.locator('button[title="Excluir"]').first().click()
    await expect(arquivos).toHaveCount(antes - 1)
  })
})

test.describe('grid de Clientes no app real', () => {
  test('paginação: 12 clientes com 10 por página (2 páginas), total e página 2', async ({ page }) => {
    await semearClientes(12, 'Pag')
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Pag`)
    const linhas = page.locator('tbody tr').filter({ hasText: `${RODADA} Pag` })
    await page.locator('main select').last().selectOption({ label: '10 Linhas' })
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByText(/TOTAL:\s*12/i)).toBeVisible()
    await expect(linhas).toHaveCount(10)
    await page.getByRole('link', { name: '2', exact: true }).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(linhas).toHaveCount(2)
  })

  test('ordenação por coluna: crescente e decrescente pelo cabeçalho', async ({ page }) => {
    await semearClientes(3, 'Ord')
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Ord`)
    const primeira = () => page.locator('tbody tr').filter({ hasText: `${RODADA} Ord` }).first()
    await page.getByRole('link', { name: /^NOME EMPRESA$/i }).first().click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(primeira()).toContainText('Ord 01')
    await page.getByRole('link', { name: /^NOME EMPRESA$/i }).first().click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(primeira()).toContainText('Ord 03')
  })

  test('filtro de Status Lead e botão Limpar', async ({ page }) => {
    const robo = await idDoRobo()
    await semearClientes(2, 'Fil', 'Novo')
    await realQuery("insert into clientes (id, nome_empresa, status_lead, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Contactado', $2, now())", [`${RODADA} Fil Contactado`, robo])
    await entrar(page)
    await filtrarClientes(page, `${RODADA} Fil`)
    const linhas = page.locator('tbody tr').filter({ hasText: `${RODADA} Fil` })
    await expect(linhas).toHaveCount(3)
    await page.locator('select[name="STATUS_LEAD_filter"]').selectOption({ label: 'Contactado' })
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(linhas).toHaveCount(1)
    await expect(linhas.first()).toContainText('Contactado')
    await page.getByRole('link', { name: 'Limpar' }).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.locator('input[name="NOME_EMPRESA_filter"]')).toHaveValue('')
  })

  test('Visualizar abre o formulário só para leitura e Cancelar volta sem gravar', async ({ page }) => {
    const [cli] = await realQuery(
      "insert into clientes (id, nome_empresa, status_lead, email_contato, criado_por, atualizado_em) values (gen_random_uuid(), $1, 'Novo', 'visu@e2e.com.br', $2, now()) returning id", [`${RODADA} Visu`, await idDoRobo()])
    await entrar(page)
    await page.goto('/clientes/' + cli.id + '?mode=view')
    await page.waitForLoadState('networkidle').catch(() => {})
    const nome = page.locator('input[name="NOME_EMPRESA"]')
    await expect(nome).toHaveValue(`${RODADA} Visu`)
    // leitura: campos travados e sem botão de gravar
    expect(await nome.isDisabled() || (await nome.getAttribute('readonly')) !== null).toBe(true)
    await expect(page.getByRole('button', { name: /Salvar Alterações|Criar Registro/ })).toHaveCount(0)

    // Cancelar na edição volta para a lista sem alterar nada
    await page.goto('/clientes/' + cli.id)
    await page.locator('input[name="EMAIL_CONTATO"]').fill('mudou@e2e.com.br')
    await page.getByRole('link', { name: 'Cancelar' }).first().click()
    await expect(page).toHaveURL(/\/clientes(\?|$)/)
    expect((await realQuery('select email_contato from clientes where id = $1', [cli.id]))[0].email_contato).toBe('visu@e2e.com.br')
  })
})
