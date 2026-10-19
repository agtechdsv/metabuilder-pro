import { test as base, expect, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { entrar } from '../../real/tests/helpers'
import { realQuery, REAL } from '../../real/guard'
import type { TestManifest } from '../../../src/lib/testing/manifestTypes'
import { aplicarMascara, camposEditaveis, describeName, planView } from '../../../src/lib/testing/plan'

/**
 * Testes DINÂMICOS: não há um teste escrito por caso de uso. Este arquivo lê o manifesto (o que o dev configurou no Studio) e gera os testes de cada
 * caso de uso a partir do PLANO (src/lib/testing/plan.ts), o mesmo que o painel da IDE mostra antes de rodar. Caso de uso novo ou alterado no Studio
 * → manifesto novo → testes novos, sem escrever nada.
 *
 * Regras: todo caso de uso, de qualquer tipo, ganha "a tela abre sem erro". Pesquisa + Cadastro ganha também lista, formulário (campos, obrigatórios,
 * somente leitura, máscaras), grid (total, ordenação, filtro) e exportação (CSV, JSON, Excel). Outros tipos ganham o seu gabarito aos poucos.
 *
 * Segurança: nenhuma regra daqui grava no banco. A única que poderia (salvar o formulário vazio) só passa se o app RECUSAR; se algum registro for
 * criado por engano o teste apaga o que foi criado e falha. O guard (banco local da lista permitida, contagens e ligações conferidas no fim) vale como nos demais.
 *
 * Variáveis: E2E_MANIFEST (caminho do manifesto) e E2E_VIEWS (slugs dos casos de uso a testar, separados por vírgula; vazio = todos).
 */
/**
 * Uma janela do navegador para a rodada inteira (no modo "ver ao vivo" ela não abre e fecha a cada teste). Entre um teste e outro a sessão é
 * encerrada (cookies e armazenamento limpos = logout) e o login é refeito, então cada teste continua começando do zero.
 */
/**
 * "Navegador interno" da IDE: com E2E_STREAM=1 o navegador roda escondido e cada quadro da tela (screencast do Chrome) é gravado em dynamic/live/frame.jpg;
 * o painel da IDE lê esse arquivo e mostra a execução dentro dele. Grava num arquivo temporário e renomeia, para o painel nunca ler um quadro pela metade.
 */
async function transmitirTela(ctx: import('@playwright/test').BrowserContext, pagina: Page): Promise<() => Promise<void>> {
  if (process.env.E2E_STREAM !== '1') return async () => {}
  const dir = path.join(import.meta.dirname, '..', 'live')
  fs.mkdirSync(dir, { recursive: true })
  const quadro = path.join(dir, 'frame.jpg')
  const tmp = path.join(dir, 'frame.tmp')
  try { fs.rmSync(quadro, { force: true }) } catch { /* nada a limpar */ }
  const cdp = await ctx.newCDPSession(pagina)
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number }) => {
    try { fs.writeFileSync(tmp, Buffer.from(f.data, 'base64')); fs.renameSync(tmp, quadro) } catch { /* o painel leu no mesmo instante: o próximo quadro cobre */ }
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 800 })
  return async () => { await cdp.send('Page.stopScreencast').catch(() => {}) }
}

const test = base.extend<object, { janela: Page }>({
  janela: [async ({ browser }, use) => {
    const ctx = await browser.newContext({ baseURL: `http://localhost:${REAL.port}`, locale: 'pt-BR', ...(process.env.E2E_HEADED === '1' ? { viewport: null } : {}) })
    const pagina = await ctx.newPage()
    const parar = await transmitirTela(ctx, pagina)
    await use(pagina)
    await parar()
    await ctx.close()
  }, { scope: 'worker' }],
  page: async ({ janela }, use) => {
    janela.removeAllListeners('pageerror')
    await janela.context().clearCookies()
    await janela.goto('about:blank')
    await janela.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch { /* sem armazenamento */ } }).catch(() => {})
    await use(janela)
  },
})

const MANIFEST_PATH = process.env.E2E_MANIFEST || path.join(import.meta.dirname, '..', 'manifests', 'vendas-pg.sample.json')
const manifest: TestManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
const escolhidos = (process.env.E2E_VIEWS || '').split(',').map(s => s.trim()).filter(Boolean)

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

async function abrir(page: Page, rota: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle').catch(() => {})
}

/**
 * A lista passa por uma tela de "Conectando ao banco..." a cada pesquisa, ordenação ou página: só depois dela aparece o "TOTAL: n". Ler as linhas antes
 * disso devolve uma grid vazia. Espera o total (ou, sem ele, qualquer linha).
 */
async function aguardarLista(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.getByText(/Conectando ao banco/i).first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
  await page.getByText(/TOTAL:\s*\d+/i).first().waitFor({ timeout: 15_000 }).catch(() => {})
}

/**
 * Clica em algo que NAVEGA a lista (ordenar, pesquisar, limpar) e espera a navegação terminar: a URL muda e os dados novos chegam. Sem isso o teste lê a
 * grid da página antiga (o "TOTAL" dela ainda está na tela) ou no meio da troca.
 */
async function clicarENavegar(page: Page, alvo: Locator) {
  const antes = page.url()
  await alvo.click()
  await page.waitForURL(u => u.href !== antes, { timeout: 8_000 }).catch(() => {})
  await aguardarLista(page)
}

/** "TOTAL: 16" que a lista mostra. null = não achou. */
async function totalMostrado(page: Page): Promise<number | null> {
  const el = page.getByText(/TOTAL:\s*\d+/i).first()
  if (!(await el.count())) return null
  const m = /TOTAL:\s*(\d+)/i.exec(await el.innerText())
  return m ? Number(m[1]) : null
}

/** Posição da coluna do grid pelo rótulo (o cabeçalho e as células têm a mesma ordem). */
async function indiceColuna(page: Page, rotulo: string): Promise<number> {
  const ths = await page.locator('thead th').allInnerTexts()
  return ths.findIndex(t => norm(t).startsWith(norm(rotulo)))
}

/** Textos das células de cada linha de dados do grid (a linha "sem registros" tem uma célula só e fica de fora). */
async function linhasDoGrid(page: Page): Promise<string[][]> {
  return page.locator('tbody tr').evaluateAll(trs =>
    trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td as HTMLElement).innerText.trim())).filter(c => c.length > 1))
}

async function baixar(page: Page, formato: RegExp) {
  await page.getByRole('button', { name: /^Exportar/ }).first().click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: formato }).click()])
  return { name: download.suggestedFilename(), buf: fs.readFileSync((await download.path())!) }
}

/** Cabeçalho e número de registros de um CSV (aspas protegem quebras de linha dentro do texto). */
function lerCsv(texto: string): { cabecalho: string; registros: number } {
  const t = texto.replace(/^﻿/, '')
  const linhas: string[] = []
  let emAspas = false
  let inicio = 0
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === '"') emAspas = !emAspas
    else if (ch === '\n' && !emAspas) { linhas.push(t.slice(inicio, i).replace(/\r$/, '')); inicio = i + 1 }
  }
  if (inicio < t.length) linhas.push(t.slice(inicio))
  const dados = linhas.filter(l => l.length > 0)
  return { cabecalho: dados[0] ?? '', registros: Math.max(0, dados.length - 1) }
}

for (const view of manifest.views.filter(v => escolhidos.length === 0 || escolhidos.includes(v.slug))) {
  test.describe(describeName(view), () => {
    test.beforeEach(async ({ page }) => { await entrar(page) })

    for (const t of planView(view)) {
      if (t.kind === 'abre') {
        test(t.title, async ({ page }) => {
          const erros: string[] = []
          page.on('pageerror', e => erros.push(e.message.slice(0, 200)))
          const resp = await page.goto(view.path)
          expect(resp?.status() ?? 0, `HTTP de ${view.path}`).toBeLessThan(400)
          await page.waitForLoadState('networkidle').catch(() => {})
          await expect(page.locator('main').first()).toBeVisible()
          const texto = await page.locator('body').innerText()
          expect(texto).not.toMatch(/Application error|Internal Server Error|Unhandled Runtime Error|Erro ao carregar/i)
          expect(texto.toLowerCase(), `o título "${view.title}" aparece na tela`).toContain(view.title.toLowerCase())
          expect(erros, 'erros de JavaScript na página').toEqual([])
        })
      }

      if (t.kind === 'lista') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          for (const f of view.filter) {
            await expect.soft(page.locator(`[name="${f.column}_filter"]`).first(), `filtro "${f.label}" (${f.column}_filter)`).toBeVisible()
          }
          for (const f of view.grid) {
            await expect.soft(page.locator('thead th').filter({ hasText: new RegExp(escapar(f.label), 'i') }).first(), `coluna "${f.label}" no grid`).toBeVisible()
          }
        })
      }

      if (t.kind === 'formulario') {
        test(t.title, async ({ page }) => {
          await abrir(page, `${view.path}/new`)
          for (const f of camposEditaveis(view)) {
            const campo = page.locator(`[name="${f.column}"]`).first()
            await expect.soft(campo, `campo "${f.label}" (${f.column})`).toBeVisible()
            if (!(await campo.count())) continue
            if (f.dataType !== 'boolean') {
              const obrigatorio = (await campo.getAttribute('required')) !== null
              expect.soft(obrigatorio, `"${f.label}": obrigatório esperado ${f.required}`).toBe(f.required)
            }
            if (f.readOnly) {
              const travado = (await campo.getAttribute('readonly')) !== null || (await campo.isDisabled())
              expect.soft(travado, `"${f.label}": deveria ser somente leitura`).toBe(true)
            }
          }
        })
      }

      if (t.kind === 'mascara') {
        const f = view.form.find(x => x.column === t.field)!
        test(t.title, async ({ page }) => {
          await abrir(page, `${view.path}/new`)
          const digitos = '1234567890123456789'.slice(0, (f.mask as string).split('0').length - 1)
          const campo = page.locator(`[name="${f.column}"]`).first()
          await campo.click()
          await campo.pressSequentially(digitos)
          await expect(campo).toHaveValue(aplicarMascara(digitos, f.mask as string))
        })
      }

      if (t.kind === 'obrigatorios') {
        test(t.title, async ({ page }) => {
          const ids = async () => new Set((await realQuery(`select ${view.primaryKey}::text as id from ${view.table}`)).map(r => String(r.id)))
          const antes = await ids()
          await abrir(page, `${view.path}/new`)
          await page.getByRole('button', { name: 'Criar Registro' }).first().click()
          await page.waitForTimeout(1500)
          const novos = [...(await ids())].filter(id => !antes.has(id))
          if (novos.length > 0) {
            // o app aceitou salvar vazio: apaga só o que esta tela criou e falha
            for (const id of novos) await realQuery(`delete from ${view.table} where ${view.primaryKey}::text = $1`, [id])
          }
          expect(novos, `o app criou ${novos.length} registro(s) com os campos obrigatórios vazios`).toEqual([])
        })
      }

      if (t.kind === 'grid_total') {
        test(t.title, async ({ page }) => {
          const noBanco = Number((await realQuery(`select count(*) n from ${view.table}`))[0].n)
          await abrir(page, view.path)
          await aguardarLista(page)
          const naTela = await totalMostrado(page)
          expect(naTela, 'a lista mostra "TOTAL: n"').not.toBeNull()
          expect(naTela, `total da tela × linhas da tabela ${view.table}`).toBe(noBanco)
        })
      }

      if (t.kind === 'grid_ordenacao') {
        const campo = view.grid.find(x => x.column === t.field)!
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarLista(page)
          const idx = await indiceColuna(page, campo.label)
          expect(idx, `coluna "${campo.label}" no grid`).toBeGreaterThanOrEqual(0)
          const clicar = () => clicarENavegar(page, page.locator('thead th').nth(idx).locator('a, button').first())
          await clicar()
          const asc = (await linhasDoGrid(page)).map(c => c[idx])
          await clicar()
          const desc = (await linhasDoGrid(page)).map(c => c[idx])
          const total = await totalMostrado(page)
          if (total) expect(asc.length, 'linhas na ordem crescente (a lista não pode vir vazia se o total é maior que zero)').toBeGreaterThan(0)
          test.skip(asc.length < 2 || new Set(asc).size < 2, 'poucos valores diferentes para conferir a ordem')
          if (total !== null && total > asc.length) expect(desc[0], 'com várias páginas, o primeiro da ordem decrescente muda').not.toBe(asc[0])
          else expect(desc, 'a ordem decrescente é o inverso da crescente').toEqual([...asc].reverse())
        })
      }

      if (t.kind === 'grid_filtro') {
        const campo = view.filter.find(x => x.column === t.field)!
        test(t.title, async ({ page }) => {
          const [linha] = await realQuery(`select ${campo.column}::text as v from ${view.table} where ${campo.column} is not null and ${campo.column}::text <> '' limit 1`)
          test.skip(!linha, 'a tabela não tem dados para filtrar')
          const valor = String(linha.v)
          const busca = (valor.split(/\s+/).find(w => w.length >= 3) ?? valor).slice(0, 20)
          await abrir(page, view.path)
          await aguardarLista(page)
          const entrada = page.locator(`[name="${campo.column}_filter"]`).first()
          await entrada.fill(busca)
          await clicarENavegar(page, page.getByRole('button', { name: 'Pesquisar' }).first())
          const linhas = await linhasDoGrid(page)
          expect(linhas.length, `linhas depois de filtrar por "${busca}"`).toBeGreaterThan(0)
          for (const c of linhas) expect.soft(c.join(' ').toLowerCase(), 'linha fora do filtro').toContain(busca.toLowerCase())
          await clicarENavegar(page, page.getByRole('link', { name: 'Limpar' }).or(page.getByRole('button', { name: 'Limpar' })).first())
          await expect(page.locator(`[name="${campo.column}_filter"]`).first()).toHaveValue('')
        })
      }

      if (t.kind === 'exportacao') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarLista(page)
          const total = await totalMostrado(page)
          if (t.format === 'csv') {
            const r = await baixar(page, /csv/i)
            expect(r.name).toMatch(/\.csv$/i)
            const csv = lerCsv(r.buf.toString('utf8'))
            for (const f of view.grid) expect.soft(csv.cabecalho, `coluna "${f.label}" no cabeçalho do CSV`).toContain(f.label)
            if (total !== null) expect(csv.registros, 'linhas do CSV × total da lista').toBe(total)
          } else if (t.format === 'json') {
            const r = await baixar(page, /json/i)
            expect(r.name).toMatch(/\.json$/i)
            const itens = JSON.parse(r.buf.toString('utf8'))
            expect(Array.isArray(itens), 'o JSON é uma lista').toBe(true)
            if (total !== null) expect(itens.length, 'itens do JSON × total da lista').toBe(total)
          } else {
            const r = await baixar(page, /excel|xlsx/i)
            expect(r.name).toMatch(/\.xlsx$/i)
            expect(r.buf.subarray(0, 2).toString('latin1'), 'um .xlsx é um zip (começa com PK)').toBe('PK')
            expect(r.buf.length).toBeGreaterThan(1000)
          }
        })
      }
    }
  })
}
