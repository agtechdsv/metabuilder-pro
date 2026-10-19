import { test as base, expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { entrar } from '../lib/login'
import { consultar } from '../lib/db'
import { CONFIG } from '../lib/config'
import type { ManifestField, TestManifest } from '../../../src/lib/testing/manifestTypes'
import { aplicarMascara, camposDeTipo, camposEditaveis, campoDeFiltro, describeName, ehData, planView } from '../../../src/lib/testing/plan'

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
 * "Navegador interno" da IDE: com E2E_STREAM=1 o navegador roda escondido e cada quadro da tela (screencast do Chrome) é gravado em E2E_LIVE_DIR/frame.jpg;
 * o painel da IDE lê esse arquivo e mostra a execução dentro dele. Grava num arquivo temporário e renomeia, para o painel nunca ler um quadro pela metade.
 */
async function transmitirTela(ctx: BrowserContext, pagina: Page): Promise<() => Promise<void>> {
  if (process.env.E2E_STREAM !== '1') return async () => {}
  const dir = process.env.E2E_LIVE_DIR || path.join(import.meta.dirname, '..', 'live')
  fs.mkdirSync(dir, { recursive: true })
  const quadro = path.join(dir, 'frame.jpg')
  const tmp = path.join(dir, 'frame.tmp')
  const cdp = await ctx.newCDPSession(pagina)
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number }) => {
    try { fs.writeFileSync(tmp, Buffer.from(f.data, 'base64')); fs.renameSync(tmp, quadro) } catch { /* o painel leu no mesmo instante: o próximo quadro cobre */ }
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 800 })
  return async () => { await cdp.send('Page.stopScreencast').catch(() => {}) }
}

/**
 * Evidências das falhas (E2E_ARTIFACTS_DIR): captura da tela no momento da falha e vídeo do teste que falhou. O caminho dos arquivos vai para o
 * relator (anexos "mb-shot" e "mb-video") e dali para o painel e o histórico. O vídeo só existe quando cada teste tem a sua página (modo sem janela
 * do sistema); com a janela do sistema fica a captura de tela.
 */
const ARTEFATOS = process.env.E2E_ARTIFACTS_DIR || ''
const COM_JANELA = process.env.E2E_HEADED === '1'
/** O vídeo precisa do ffmpeg do Playwright (npx playwright install ffmpeg). Sem ele, a falha fica só com a captura de tela. */
const TEM_FFMPEG = (() => {
  try {
    const raiz = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0' ? process.env.PLAYWRIGHT_BROWSERS_PATH : path.join(process.env.LOCALAPPDATA || path.join(process.env.HOME || '', '.cache'), 'ms-playwright')
    return fs.readdirSync(raiz).some(d => d.startsWith('ffmpeg-') && fs.readdirSync(path.join(raiz, d)).some(f => f.startsWith('ffmpeg')))
  } catch { return false }
})()
const nomeSeguro = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const anexar = (info: TestInfo, nome: string, arquivo: string) => info.attach(nome, { body: Buffer.from(arquivo), contentType: 'text/plain' })
let sequencia = 0
let compartilhada: Page | undefined

/**
 * Com a janela do sistema: uma só janela para a rodada inteira (não abre e fecha a cada teste). Sem ela: uma página nova por teste (é o que permite
 * gravar o vídeo de cada um). Nos dois casos a sessão começa limpa (cookies apagados = logout) e o login é refeito, então cada teste começa do zero.
 */
const test = base.extend<object, { contexto: BrowserContext }>({
  contexto: [async ({ browser }, use) => {
    const ctx = await browser.newContext({
      baseURL: `http://localhost:${CONFIG.port}`, locale: 'pt-BR',
      ...(COM_JANELA ? { viewport: null } : { viewport: { width: 1280, height: 800 } }),
      ...(!COM_JANELA && ARTEFATOS && TEM_FFMPEG ? { recordVideo: { dir: path.join(ARTEFATOS, '_video'), size: { width: 1280, height: 800 } } } : {}),
    })
    await use(ctx)
    await ctx.close()
  }, { scope: 'worker' }],
  page: async ({ contexto }, use, testInfo) => {
    await contexto.clearCookies()
    let pagina: Page
    if (COM_JANELA) {
      if (!compartilhada || compartilhada.isClosed()) compartilhada = await contexto.newPage()
      pagina = compartilhada
      await pagina.goto('about:blank')
    } else {
      pagina = await contexto.newPage()
    }
    const parar = await transmitirTela(contexto, pagina)
    await use(pagina)
    await parar()
    const falhou = testInfo.status !== testInfo.expectedStatus
    const base = `${String(++sequencia).padStart(3, '0')}-${nomeSeguro(testInfo.title)}`
    if (ARTEFATOS && falhou) {
      fs.mkdirSync(ARTEFATOS, { recursive: true })
      try { const png = path.join(ARTEFATOS, base + '.png'); await pagina.screenshot({ path: png }); await anexar(testInfo, 'mb-shot', png) } catch { /* página já fechada */ }
    }
    if (!COM_JANELA) {
      const video = pagina.video()
      await pagina.close().catch(() => {})
      if (video) {
        try {
          if (ARTEFATOS && falhou) { const webm = path.join(ARTEFATOS, base + '.webm'); await video.saveAs(webm); await anexar(testInfo, 'mb-video', webm) }
          await video.delete()
        } catch { /* sem vídeo desta vez */ }
      }
    }
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

/** Telas que não são lista (kanban, mapa, BI...): não têm "TOTAL: n"; espera a rede assentar e as mensagens de carregamento sumirem. */
async function aguardarTela(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.getByText(/Conectando ao banco|Carregando/i).first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
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
          const ids = async () => new Set((await consultar(`select ${view.primaryKey}::text as id from ${view.table}`)).map(r => String(r.id)))
          const antes = await ids()
          await abrir(page, `${view.path}/new`)
          await page.getByRole('button', { name: 'Criar Registro' }).first().click()
          await page.waitForTimeout(1500)
          const novos = [...(await ids())].filter(id => !antes.has(id))
          if (novos.length > 0) {
            // o app aceitou salvar vazio: apaga só o que esta tela criou e falha
            for (const id of novos) await consultar(`delete from ${view.table} where ${view.primaryKey}::text = $1`, [id])
          }
          expect(novos, `o app criou ${novos.length} registro(s) com os campos obrigatórios vazios`).toEqual([])
        })
      }

      if (t.kind === 'grid_total') {
        test(t.title, async ({ page }) => {
          const noBanco = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
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
          const [linha] = await consultar(`select ${campo.column}::text as v from ${view.table} where ${campo.column} is not null and ${campo.column}::text <> '' limit 1`)
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

      // ---------------------------------------------------------------------------------------------------------------------
      // Fase 3 (só leitura)
      // ---------------------------------------------------------------------------------------------------------------------

      if (t.kind === 'grid_paginacao') {
        test(t.title, async ({ page }) => {
          const noBanco = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          await abrir(page, view.path)
          await aguardarLista(page)
          const seletor = page.locator('main select').last()
          const rotulos = await seletor.locator('option').allInnerTexts()
          const tamanhos = rotulos.map(r => ({ r, n: Number(/\d+/.exec(r)?.[0]) })).filter(x => x.n > 0).sort((a, b) => a.n - b.n)
          expect(tamanhos.length, 'o seletor de linhas por página tem opções').toBeGreaterThan(0)
          const menor = tamanhos[0]
          const antes = page.url()
          await seletor.selectOption({ label: menor.r })
          await page.waitForURL(u => u.href !== antes, { timeout: 8_000 }).catch(() => {})
          await aguardarLista(page)
          expect(await totalMostrado(page), 'o total não muda com o tamanho da página').toBe(noBanco)
          expect((await linhasDoGrid(page)).length, `linhas com ${menor.n} por página`).toBe(Math.min(menor.n, noBanco))
          if (noBanco > menor.n) {
            await clicarENavegar(page, page.getByRole('link', { name: '2', exact: true }))
            expect((await linhasDoGrid(page)).length, 'linhas da página 2').toBe(Math.min(menor.n, noBanco - menor.n))
          }
        })
      }

      if (t.kind === 'filtro_opcoes') {
        const campo = view.filter.find(x => x.column === t.field)!
        const gcol = view.grid.find(x => x.column === t.field)!
        test(t.title, async ({ page }) => {
          const total = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          let escolha: { label: string; n: number } | undefined
          for (const o of campo.options ?? []) {
            const n = Number((await consultar(`select count(*) n from ${view.table} where ${campo.column}::text = $1`, [o.value]))[0].n)
            if (n > 0 && n < total) { escolha = { label: o.label, n }; break }
          }
          test.skip(!escolha, 'nenhuma opção do filtro separa as linhas (todas ou nenhuma)')
          await abrir(page, view.path)
          await aguardarLista(page)
          await page.locator(`select[name="${campo.column}_filter"]`).selectOption({ label: escolha!.label })
          await clicarENavegar(page, page.getByRole('button', { name: 'Pesquisar' }).first())
          expect(await totalMostrado(page), `total com "${escolha!.label}"`).toBe(escolha!.n)
          const idx = await indiceColuna(page, gcol.label)
          expect(idx, `coluna "${gcol.label}"`).toBeGreaterThanOrEqual(0)
          for (const c of await linhasDoGrid(page)) expect.soft(norm(c[idx]), 'linha de outra opção').toContain(norm(escolha!.label))
          await clicarENavegar(page, page.getByRole('link', { name: 'Limpar' }).or(page.getByRole('button', { name: 'Limpar' })).first())
          expect(await totalMostrado(page), 'Limpar volta ao total').toBe(total)
        })
      }

      if (t.kind === 'visualizar') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarLista(page)
          const icone = page.locator('main a[title="Visualizar"]').first()
          test.skip(!(await icone.count()), 'sem registros para visualizar')
          await icone.click()
          await page.waitForURL(/mode=view/, { timeout: 8_000 })
          await page.waitForLoadState('networkidle').catch(() => {})
          const editavel = camposEditaveis(view).find(f => f.dataType !== 'boolean')
          if (editavel) {
            const campo = page.locator(`[name="${editavel.column}"]`).first()
            await expect(campo).toBeVisible()
            const travado = (await campo.isDisabled()) || (await campo.getAttribute('readonly')) !== null
            expect(travado, `"${editavel.label}" deveria estar travado no modo Visualizar`).toBe(true)
          }
          await expect(page.getByRole('button', { name: /Salvar Alterações|Criar Registro/ })).toHaveCount(0)
        })
      }

      if (t.kind === 'exportacao_filtrada') {
        const campo = view.filter.find(x => x.column === (campoDeFiltro(view) as ManifestField).column)!
        test(t.title, async ({ page }) => {
          const [linha] = await consultar(`select ${campo.column}::text as v from ${view.table} where ${campo.column} is not null and ${campo.column}::text <> '' limit 1`)
          test.skip(!linha, 'a tabela não tem dados para filtrar')
          const busca = (String(linha.v).split(/\s+/).find(w => w.length >= 3) ?? String(linha.v)).slice(0, 20)
          await abrir(page, view.path)
          await aguardarLista(page)
          const todos = await totalMostrado(page)
          await page.locator(`[name="${campo.column}_filter"]`).first().fill(busca)
          await clicarENavegar(page, page.getByRole('button', { name: 'Pesquisar' }).first())
          const filtrados = await totalMostrado(page)
          expect(filtrados, 'o filtro achou registros').toBeGreaterThan(0)
          const r = await baixar(page, /csv/i)
          const csv = lerCsv(r.buf.toString('utf8'))
          expect(csv.registros, `linhas do CSV × total filtrado (o banco inteiro tem ${todos})`).toBe(filtrados)
        })
      }

      if (t.kind === 'exportacao_marcadas') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarLista(page)
          const marcas = page.locator('tbody input[type="checkbox"]')
          test.skip((await marcas.count()) < 2, 'menos de 2 linhas para marcar')
          await marcas.nth(0).check()
          await marcas.nth(1).check()
          await expect(page.getByRole('button', { name: /^Exportar.*\(2\)/ })).toBeVisible()
          const r = await baixar(page, /json/i)
          expect((JSON.parse(r.buf.toString('utf8')) as unknown[]).length, 'itens exportados × linhas marcadas').toBe(2)
          await page.locator('thead input[type="checkbox"]').check()
          const total = await marcas.count()
          await expect(page.getByRole('button', { name: new RegExp(`^Exportar.*\\(${total}\\)`) })).toBeVisible()
          await page.locator('thead input[type="checkbox"]').uncheck()
          await expect(page.getByRole('button', { name: /^Exportar/ }).first()).not.toContainText('(')
        })
      }

      if (t.kind === 'central_downloads') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarLista(page)
          const r = await baixar(page, /csv/i)
          const base = r.name.replace(/-\d{4}-\d{2}-\d{2}\.csv$/i, '')
          await abrir(page, '/downloads')
          const arquivos = page.getByText(new RegExp(`^${escapar(base)}-\\d{8}-\\d{6}-[0-9a-f]{4}\\.csv$`))
          await expect(arquivos.first(), `a Central de Downloads lista a exportação de ${base}`).toBeVisible()
          const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('a[title="Baixar"]').first().click()])
          const conteudo = fs.readFileSync((await dl.path())!).toString('utf8')
          expect(lerCsv(conteudo).cabecalho.length, 'o arquivo baixado tem cabeçalho').toBeGreaterThan(0)
        })
      }

      if (t.kind === 'botoes') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarLista(page)
          const linhas = (await linhasDoGrid(page)).length
          for (const b of view.buttons) {
            const nome = new RegExp(`^${escapar(b.label)}`, 'i')
            if (b.actionType === 'export') await expect.soft(page.getByRole('button', { name: nome }).first(), `botão "${b.label}"`).toBeVisible()
            else if (b.actionType === 'search') await expect.soft(page.getByRole('button', { name: nome }).first(), `botão "${b.label}"`).toBeVisible()
            else if (b.actionType === 'clear') await expect.soft(page.getByRole('link', { name: nome }).or(page.getByRole('button', { name: nome })).first(), `botão "${b.label}"`).toBeVisible()
            else if (linhas > 0 && ['view', 'edit', 'delete'].includes(b.actionType)) {
              expect.soft(await page.locator(`main [title="${b.label}"]`).count(), `ícone "${b.label}" nas linhas`).toBeGreaterThan(0)
            }
          }
        })
      }

      if (t.kind === 'campos_tipos') {
        test(t.title, async ({ page }) => {
          await abrir(page, `${view.path}/new`)
          for (const f of camposDeTipo(view)) {
            const campo = page.locator(`[name="${f.column}"]`).first()
            if (!(await campo.count())) { expect.soft(0, `campo "${f.label}" (${f.column}) existe`).toBeGreaterThan(0); continue }
            const tag = await campo.evaluate(e => e.tagName.toLowerCase())
            const tipo = (await campo.getAttribute('type')) ?? ''
            if (f.options?.length) {
              expect.soft(tag, `"${f.label}" com opções é uma lista de seleção`).toBe('select')
              if (tag === 'select') expect.soft(await campo.locator('option').count(), `opções de "${f.label}"`).toBeGreaterThanOrEqual(f.options.length)
            } else if (f.dataType === 'boolean') {
              expect.soft(tipo, `"${f.label}" é uma caixa de marcar`).toBe('checkbox')
            } else if (ehData(f)) {
              expect.soft(['date', 'datetime-local', 'time'], `"${f.label}" usa o seletor de data`).toContain(tipo)
            } else if (/select/i.test(f.componentType || '')) {
              expect.soft(tag, `"${f.label}" é uma lista de seleção`).toBe('select')
            } else if (/int|numeric|decimal|float|double|number/i.test(f.dataType)) {
              expect.soft(['number', 'text'], `"${f.label}" é um campo numérico`).toContain(tipo)
            } else {
              expect.soft(['input', 'textarea', 'select'], `"${f.label}" é um campo de entrada`).toContain(tag)
            }
          }
        })
      }

      if (t.kind === 'abas') {
        test(t.title, async ({ page }) => {
          const [reg] = await consultar(`select ${view.primaryKey}::text as id from ${view.table} limit 1`)
          test.skip(!reg, 'a tabela não tem registros para abrir')
          await abrir(page, `${view.path}/${reg.id}`)
          for (const d of view.details) {
            const nome = new RegExp(`^${escapar(d.label)}$`, 'i')
            if (d.displayMode === 'tab') {
              const aba = page.getByRole('button', { name: nome }).first()
              await expect.soft(aba, `aba "${d.label}"`).toBeVisible()
              if (await aba.count()) {
                await aba.click()
                await expect.soft(page.getByText(/Application error|Erro ao carregar/i), `erro ao abrir a aba "${d.label}"`).toHaveCount(0)
              }
            } else {
              await expect.soft(page.getByText(nome).first(), `seção "${d.label}"`).toBeVisible()
            }
          }
        })
      }

      // --- gabaritos por tipo de tela (todos só leem) ---

      if (t.kind === 'filtros_tela') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarTela(page)
          let achados = 0
          for (const f of view.filter) if (await page.locator(`[name="${f.column}_filter"]`).count()) achados++
          if (achados > 0) expect(achados, 'filtros com nome na tela × filtros configurados').toBe(view.filter.length)
          else {
            // tela sem nomes nos campos (ex.: timeline): confere pela quantidade de listas de seleção
            const listas = view.filter.filter(f => f.options?.length || /select|autocomplete/i.test(f.componentType || '') || /uuid/i.test(f.dataType)).length
            expect(await page.locator('main select').count(), 'listas de filtro na tela').toBeGreaterThanOrEqual(Math.min(listas, 1))
          }
        })
      }

      if (t.kind === 'tipo_galeria') {
        test(t.title, async ({ page }) => {
          const total = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.locator('main img'), 'um cartão (imagem) por registro').toHaveCount(total)
        })
      }

      if (t.kind === 'tipo_kanban') {
        test(t.title, async ({ page }) => {
          const total = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          await abrir(page, view.path)
          await aguardarTela(page)
          const cartoes = await page.locator('main button[title="Detalhes"]').count()
          const mais = Number(/CARREGAR MAIS\s+(\d+)/i.exec(await page.locator('main').innerText())?.[1] ?? 0)
          expect(cartoes + mais, `cartões na tela (${cartoes}) + a carregar (${mais}) × registros da tabela`).toBe(total)
        })
      }

      if (t.kind === 'tipo_fluxo') {
        test(t.title, async ({ page }) => {
          const total = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.locator('.react-flow')).toBeVisible()
          await expect(page.getByText(new RegExp(`${total} ETAPAS`, 'i')).first(), `"${total} ETAPAS" na tela`).toBeVisible()
        })
      }

      if (t.kind === 'tipo_timeline') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.locator('button[title="Atualizar Dados"], button:has-text("Atualizar Dados")').first()).toBeVisible()
          await page.locator('button[title="Atualizar Dados"], button:has-text("Atualizar Dados")').first().click()
          await page.waitForLoadState('networkidle').catch(() => {})
          await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
        })
      }

      if (t.kind === 'tipo_gantt') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.getByRole('button', { name: /^Hoje$/i })).toBeVisible()
          for (const tam of ['Pequeno', 'Normal', 'Grande']) await expect.soft(page.locator(`main button[title="${tam}"]`).first(), `tamanho "${tam}"`).toBeVisible()
          const linhas = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          if (linhas > 0) expect(await page.locator('main [title="Editar"]').count(), 'ações de linha (Editar)').toBeGreaterThan(0)
        })
      }

      if (t.kind === 'tipo_agenda') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.getByText(/de 20\d\d/i).first()).toBeVisible()
          const texto = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ')
          const mes = await texto()
          await page.getByRole('button', { name: 'Semana', exact: true }).click()
          const semana = await texto()
          await page.getByRole('button', { name: 'Dia', exact: true }).click()
          const dia = await texto()
          expect(new Set([mes, semana, dia]).size, 'mês, semana e dia mostram coisas diferentes').toBe(3)
          await page.getByRole('button', { name: 'Mês', exact: true }).click()
          await expect(page.getByText('DOM').first()).toBeVisible()
        })
      }

      if (t.kind === 'tipo_mapa_mental') {
        test(t.title, async ({ page }) => {
          const total = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.getByText(new RegExp(`${total} REGISTROS`, 'i')).first(), `"${total} REGISTROS" na tela`).toBeVisible()
        })
      }

      if (t.kind === 'tipo_mapa') {
        test(t.title, async ({ page }) => {
          const total = Number((await consultar(`select count(*) n from ${view.table}`))[0].n)
          const lat = view.form.find(f => /^lat/i.test(f.column))?.column
          const lng = view.form.find(f => /^(lng|lon)/i.test(f.column))?.column
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.locator('.leaflet-container')).toBeVisible()
          await expect(page.getByText(new RegExp(`REGISTROS \\(${total}\\)`, 'i')).first(), `"REGISTROS (${total})"`).toBeVisible()
          if (lat && lng) {
            const comGps = Number((await consultar(`select count(*) n from ${view.table} where ${lat} is not null and ${lng} is not null`))[0].n)
            await expect(page.getByText(new RegExp(`${comGps} DE ${total} REGISTROS COM COORDENADAS`, 'i')).first()).toBeVisible()
          }
        })
      }

      if (t.kind === 'tipo_bi') {
        test(t.title, async ({ page }) => {
          await abrir(page, view.path)
          await aguardarTela(page)
          await expect(page.getByRole('button', { name: 'Atualizar agora' })).toBeVisible()
          await expect(page.getByRole('button', { name: 'Organizar Dashboard' })).toBeVisible()
          await page.getByRole('button', { name: 'Atualizar agora' }).click()
          await page.waitForLoadState('networkidle').catch(() => {})
          await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
          expect(await page.locator('tbody tr').count(), 'linhas na tabela de dados').toBeGreaterThan(0)
        })
      }
    }
  })
}
