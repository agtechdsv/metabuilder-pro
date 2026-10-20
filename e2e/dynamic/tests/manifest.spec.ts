import { test as base, expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { entrar, entrarComo } from '../lib/login'
import { criarUsuarioTemporario, removerUsuarioTemporario, valorDaRegra } from '../lib/seguranca'
import * as acesso from '../lib/acesso.mjs'
import { detectarApp } from '../lib/app.mjs'
import { unico } from '../lib/seguranca'
import { comBanco, consultar, dialeto, nomeDoCampo, nomeDoFiltro } from '../lib/db'
import { anotarCriado, riscarCriado } from '../lib/guard'
import { CONFIG } from '../lib/config'
import type { ManifestField, ManifestView, TestManifest } from '../../../src/lib/testing/manifestTypes'
import { aplicarMascara, camposDeTipo, camposEditaveis, campoDeFiltro, campoMarcador, describeName, ehData, mascaraDePadrao, planView, PREFIXO_E2E, regraDeLinha, type TestType } from '../../../src/lib/testing/plan'

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
/** Tipos de teste desta rodada (E2E_TYPES): funcional só lê; integracao grava no banco de teste; seguranca cria usuários e grupos temporários. */
const TIPOS = (process.env.E2E_TYPES || 'funcional').split(',').map(x => x.trim()).filter((x): x is TestType => x === 'funcional' || x === 'integracao' || x === 'seguranca')
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

/** O total da lista; uma lista sem nenhuma linha não mostra "TOTAL: n" e conta como 0. */
async function totalOuZero(page: Page): Promise<number | null> {
  const total = await totalMostrado(page)
  if (total !== null) return total
  return (await linhasDoGrid(page)).length === 0 ? 0 : null
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

// ---------------------------------------------------------------------------------------------------------------------
// Integração: cadastro, reabrir, edição e exclusão com dados gerados (gravam no banco de teste; só com o tipo "integracao")
// ---------------------------------------------------------------------------------------------------------------------

/** Identificador desta rodada: todo texto gerado começa com "E2E-" (a limpeza de sobras só apaga linhas assim). */
const RODADA = PREFIXO_E2E + new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12) // E2E-2610191430

interface Preenchido { tipo: 'texto' | 'texto-mascara' | 'numero-mascara' | 'numero' | 'data' | 'data-hora' | 'hora' | 'bool' | 'opcao'; esperado: string; numero?: number }
interface EstadoCrud { marcador: string; id?: string; preenchidos: Record<string, Preenchido>; criouEm?: number }
/**
 * O estado entre as etapas (cadastro → reabrir → edição → exclusão) fica em arquivo, não na memória: quando um teste falha o Playwright reinicia o
 * processo de teste e a memória se perde, e as etapas seguintes ficariam sem saber qual registro foi criado.
 */
const arquivoEstado = (slug: string) => path.join(import.meta.dirname, '..', '..', 'test-results-dynamic', `crud-${slug}.json`)
const lerEstado = (slug: string): EstadoCrud | undefined => { try { return JSON.parse(fs.readFileSync(arquivoEstado(slug), 'utf8')) as EstadoCrud } catch { return undefined } }
function gravarEstado(slug: string, e: EstadoCrud | undefined) {
  fs.mkdirSync(path.dirname(arquivoEstado(slug)), { recursive: true })
  if (e) fs.writeFileSync(arquivoEstado(slug), JSON.stringify(e))
  else fs.rmSync(arquivoEstado(slug), { force: true })
}

/** Tamanho máximo das colunas de texto da tabela (para o valor gerado caber). */
async function limitesDaTabela(tabela: string): Promise<Record<string, number>> {
  const cols = await comBanco(d => d.colunas(tabela))
  return Object.fromEntries(cols.filter((x: any) => x.max_length).map((x: any) => [String(x.column_name).toLowerCase(), Number(x.max_length)]))
}
const caber = (txt: string, limite?: number) => (limite && txt.length > limite ? txt.slice(0, limite) : txt)

/** Preenche UM campo do formulário com um valor gerado, pelo tipo do componente na tela. Devolve o que gravou, ou null se o campo não dá para preencher. */
async function preencherCampo(page: Page, f: ManifestField, n: number, limites: Record<string, number>, marcador?: string): Promise<Preenchido | null> {
  const campo = page.locator(`[name="${nomeDoCampo(f.column)}"]`).first()
  if (!(await campo.count())) return null
  if ((await campo.isDisabled()) || (await campo.getAttribute('readonly')) !== null) return null
  const tag = await campo.evaluate(e => e.tagName.toLowerCase())
  const tipo = (await campo.getAttribute('type')) ?? ''
  if (tag === 'select') {
    const opcoes = await campo.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value).filter(v => v !== ''))
    if (opcoes.length === 0) return null
    await campo.selectOption(opcoes[0])
    return { tipo: 'opcao', esperado: opcoes[0] }
  }
  if (tipo === 'checkbox') { await campo.check(); return { tipo: 'bool', esperado: 'true' } }
  if (tipo === 'date') { await campo.fill('2026-10-25'); return { tipo: 'data', esperado: '2026-10-25' } }
  if (tipo === 'datetime-local') { await campo.fill('2026-10-25T12:00'); return { tipo: 'data-hora', esperado: '2026-10-25' } }
  if (tipo === 'time') { await campo.fill('12:00'); return { tipo: 'hora', esperado: '12:00' } }
  if (tipo === 'number') { await campo.fill(String(7 + n)); return { tipo: 'numero', esperado: String(7 + n), numero: 7 + n } }
  if (tag !== 'input' && tag !== 'textarea') return null
  // máscara de padrão (CPF, CNPJ, telefone...): digita os dígitos e a tela formata
  if (mascaraDePadrao(f.mask)) {
    const digitos = '1234567890123456789'.slice(0, (f.mask as string).split('0').length - 1)
    await campo.click(); await campo.pressSequentially(digitos)
    return { tipo: 'texto-mascara', esperado: digitos }
  }
  // máscara numérica (0.000,00 / 0.000): os dígitos entram como centavos
  if (f.mask && /^0[0.,]*0$/.test(f.mask) && /int|numeric|decimal|float|double|number/i.test(f.dataType)) {
    const casas = f.mask.includes(',') ? f.mask.split(',')[1].length : 0
    const digitos = String(1250 + n * 100)
    await campo.click(); await campo.pressSequentially(casas ? digitos : String(7 + n))
    return { tipo: 'numero-mascara', esperado: casas ? digitos : String(7 + n), numero: casas ? Number(digitos) / 10 ** casas : 7 + n }
  }
  if (/int|numeric|decimal|float|double|number/i.test(f.dataType)) { await campo.fill(String(7 + n)); return { tipo: 'numero', esperado: String(7 + n), numero: 7 + n } }
  const texto = marcador ?? (/e-?mail/i.test(f.column) ? `e2e${n}@e2e.com.br` : `E2E texto ${n}`)
  const valor = caber(texto, limites[f.column.toLowerCase()])
  await campo.fill(valor)
  return { tipo: 'texto', esperado: valor }
}

/** O que está no banco confere com o que o teste preencheu? Devolve a descrição da diferença, ou null se confere. */
function conferirNoBanco(f: ManifestField, esp: Preenchido, noBanco: string | null): string | null {
  const v = noBanco ?? ''
  const ok = esp.tipo === 'bool' ? /^(t|true|1)$/i.test(v)
    : esp.tipo === 'data' || esp.tipo === 'data-hora' ? v.startsWith(esp.esperado.slice(0, 10))
    : esp.tipo === 'hora' ? v.startsWith(esp.esperado)
    : esp.tipo === 'numero' || esp.tipo === 'numero-mascara' ? Number(v) === esp.numero
    : esp.tipo === 'texto-mascara' ? v.replace(/\D/g, '') === esp.esperado
    : v === esp.esperado
  return ok ? null : `"${f.label}": esperado ${esp.esperado}, no banco "${v}"`
}

/** A tela, ao reabrir o registro, mostra o que foi gravado? */
async function conferirNaTela(page: Page, f: ManifestField, esp: Preenchido): Promise<string | null> {
  const campo = page.locator(`[name="${nomeDoCampo(f.column)}"]`).first()
  if (esp.tipo === 'bool') return (await campo.isChecked()) ? null : `"${f.label}": a caixa deveria estar marcada`
  const v = await campo.inputValue()
  const ok = esp.tipo === 'data' ? v === esp.esperado
    : esp.tipo === 'data-hora' ? v.startsWith(esp.esperado.slice(0, 10))
    : esp.tipo === 'numero' ? Number(v) === esp.numero
    : esp.tipo === 'numero-mascara' ? Number(v.replace(/\./g, '').replace(',', '.')) === esp.numero
    : esp.tipo === 'texto-mascara' ? v.replace(/\D/g, '') === esp.esperado
    : v === esp.esperado
  return ok ? null : `"${f.label}": esperado ${esp.esperado}, a tela mostra "${v}"`
}

/** O registro criado pelo cadastro ainda está no banco? Se não, as etapas seguintes falham logo, com a causa, em vez de esperar o tempo limite da tela. */
async function registroExiste(view: ManifestView, id: string): Promise<boolean> {
  return Number((await consultar(`select count(*)::int n from "${view.table}" where "${view.primaryKey}"::text = $1`, [id]))[0].n) > 0
}

/** A tabela inteira como JSON por id (mantém a precisão exata de datas e números), para devolver depois as linhas que um arraste mudou. */
async function fotografar(view: ManifestView): Promise<Map<string, Record<string, unknown>>> {
  const pk = view.primaryKey
  return new Map((await consultar(`select "${pk}"::text as id, to_jsonb(t) as j from "${view.table}" t`)).map(r => [String(r.id), r.j as Record<string, unknown>]))
}

/**
 * Devolve ao que era (inclusive a auditoria de quem/quando gravou) as linhas que mudaram desde a foto. O gatilho de auditoria da tabela é
 * desligado só durante a devolução, senão a própria devolução marcaria a linha de novo.
 */
async function devolverLinhas(view: ManifestView, originais: Map<string, Record<string, unknown>>) {
  const pk = view.primaryKey
  const aDevolver = [...(await fotografar(view))].filter(([id, j]) => originais.has(id) && JSON.stringify(j) !== JSON.stringify(originais.get(id)))
  if (aDevolver.length === 0) return
  await comBanco(async d => {
    await d.query('begin')
    try {
      await d.query(`alter table "${view.table}" disable trigger user`)
      for (const [id, j] of aDevolver) await d.query(`update "${view.table}" t set (${Object.keys(j).map(c => `"${c}"`).join(', ')}) = (select ${Object.keys(j).map(c => `r."${c}"`).join(', ')} from jsonb_populate_record(null::"${view.table}", $2::jsonb) r) where t."${pk}"::text = $1`, [id, JSON.stringify(originais.get(id))])
      await d.query(`alter table "${view.table}" enable trigger user`)
      await d.query('commit')
    } catch (e) { await d.query('rollback').catch(() => {}); throw e }
  })
}

/** Os ids da tabela (para achar o registro novo quando não há campo de texto para marcar). null se a tabela é grande demais para isso. */
async function idsDaTabela(view: ManifestView): Promise<Set<string> | null> {
  if (Number((await consultar(`select count(*)::int n from "${view.table}"`))[0].n) > 20_000) return null
  return new Set((await consultar(`select "${view.primaryKey}"::text as id from "${view.table}"`)).map(r => String(r.id)))
}

/**
 * Muda UM campo já preenchido do formulário de edição (o que dá para mudar com segurança: texto, número, data ou outra opção da lista) e devolve o que ficou esperado.
 * Usado nas telas sem campo de texto marcador, onde a edição não pode mexer no identificador.
 */
async function editarUmCampo(page: Page, view: ManifestView, estado: EstadoCrud, limites: Record<string, number>): Promise<{ coluna: string; novo: Preenchido } | null> {
  const ordem = ['texto', 'numero', 'data', 'opcao']
  const candidatos = Object.entries(estado.preenchidos).sort((a, b) => ordem.indexOf(a[1].tipo) - ordem.indexOf(b[1].tipo)).filter(([, p]) => ordem.includes(p.tipo))
  for (const [coluna, p] of candidatos) {
    const campo = page.locator(`[name="${nomeDoCampo(coluna)}"]`).first()
    if (!(await campo.count()) || (await campo.isDisabled())) continue
    if (p.tipo === 'texto') { const v = caber(`${p.esperado} ED`, limites[coluna.toLowerCase()]); if (v === p.esperado) continue; await campo.fill(v); return { coluna, novo: { tipo: 'texto', esperado: v } } }
    if (p.tipo === 'numero') { const n = (p.numero ?? 0) + 1; await campo.fill(String(n)); return { coluna, novo: { tipo: 'numero', esperado: String(n), numero: n } } }
    if (p.tipo === 'data') { await campo.fill('2026-10-26'); return { coluna, novo: { tipo: 'data', esperado: '2026-10-26' } } }
    if (p.tipo === 'opcao') {
      const outras = (await campo.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value).filter(v => v !== ''))).filter(v => v !== p.esperado)
      if (outras.length === 0) continue
      await campo.selectOption(outras[0]); return { coluna, novo: { tipo: 'opcao', esperado: outras[0] } }
    }
  }
  return null
}

/** Lê, como texto, os campos preenchidos de uma linha (achada por uma coluna). As datas voltam como AAAA-MM-DD HH:MM:SS nos dois bancos. */
async function lerLinha(view: ManifestView, colunaBusca: string, valor: string, preenchidos: Record<string, Preenchido>): Promise<Record<string, string | null>> {
  return comBanco(async d => {
    const sel = Object.entries(preenchidos).map(([c, p]) => `${d.txt(d.ident(c), p.tipo)} as ${d.ident(c)}`)
    const rows = await d.query(`select ${d.txt(d.ident(view.primaryKey))} as ${d.ident('__id')}${sel.length ? ', ' + sel.join(', ') : ''} from ${d.ident(view.table)} where ${d.txt(d.ident(colunaBusca))} = $1`, [valor])
    return Object.fromEntries(Object.entries(rows[0] ?? {}).map(([k, v]) => [k.toLowerCase(), v == null ? null : String(v)]))
  })
}

/**
 * Acha, na lista, a linha do registro pelo id dele (o link de Visualizar/Editar da linha leva o id), passando pelas páginas: a linha criada pode não estar
 * na primeira, e a coluna que identifica o registro pode nem aparecer no grid.
 */
async function acharLinha(page: Page, id: string): Promise<Locator | null> {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const linha = page.locator('tbody tr').filter({ has: page.locator(`a[href*="${id}"]`) }).first()
    if (await linha.count()) return linha
    const proxima = page.getByRole('link', { name: String(pagina + 1), exact: true })
    if (!(await proxima.count())) return null
    await clicarENavegar(page, proxima)
  }
  return null
}

/** Confirma a exclusão: caixa de diálogo do navegador ou janela de confirmação do app. */
async function confirmarExclusao(page: Page) {
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: /excluir|confirmar/i }).last().click({ timeout: 4000 }).catch(() => {})
}

for (const view of manifest.views.filter(v => escolhidos.length === 0 || escolhidos.includes(v.slug))) {
  test.describe(describeName(view), () => {
    test.beforeEach(async ({ page }) => { await entrar(page) })

    for (const t of planView(view, { types: TIPOS, auth: manifest.auth })) {
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
            await expect.soft(page.locator(`[name="${nomeDoFiltro(f.column)}"]`).first(), `filtro "${f.label}" (${f.column}_filter)`).toBeVisible()
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
            const campo = page.locator(`[name="${nomeDoCampo(f.column)}"]`).first()
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
          const campo = page.locator(`[name="${nomeDoCampo(f.column)}"]`).first()
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
          const linha = (await consultar(`select ${campo.column}::text as v from ${view.table} where ${campo.column} is not null limit 30`)).find(r => String(r.v ?? '').trim() !== '')
          test.skip(!linha, 'a tabela não tem dados para filtrar')
          const valor = String(linha.v)
          const busca = (valor.split(/\s+/).find(w => w.length >= 3) ?? valor).slice(0, 20)
          await abrir(page, view.path)
          await aguardarLista(page)
          const entrada = page.locator(`[name="${nomeDoFiltro(campo.column)}"]`).first()
          await entrada.fill(busca)
          await clicarENavegar(page, page.getByRole('button', { name: 'Pesquisar' }).first())
          const linhas = await linhasDoGrid(page)
          expect(linhas.length, `linhas depois de filtrar por "${busca}"`).toBeGreaterThan(0)
          for (const c of linhas) expect.soft(c.join(' ').toLowerCase(), 'linha fora do filtro').toContain(busca.toLowerCase())
          await clicarENavegar(page, page.getByRole('link', { name: 'Limpar' }).or(page.getByRole('button', { name: 'Limpar' })).first())
          await expect(page.locator(`[name="${nomeDoFiltro(campo.column)}"]`).first()).toHaveValue('')
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
          await page.locator(`select[name="${nomeDoFiltro(campo.column)}"]`).selectOption({ label: escolha!.label })
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
            const campo = page.locator(`[name="${nomeDoCampo(editavel.column)}"]`).first()
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
          const linha = (await consultar(`select ${campo.column}::text as v from ${view.table} where ${campo.column} is not null limit 30`)).find(r => String(r.v ?? '').trim() !== '')
          test.skip(!linha, 'a tabela não tem dados para filtrar')
          const busca = (String(linha.v).split(/\s+/).find(w => w.length >= 3) ?? String(linha.v)).slice(0, 20)
          await abrir(page, view.path)
          await aguardarLista(page)
          const todos = await totalMostrado(page)
          await page.locator(`[name="${nomeDoFiltro(campo.column)}"]`).first().fill(busca)
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

      if (t.kind === 'acoes_linha') {
        test(t.title, async ({ page }) => {
          const acoes = [...new Set(view.buttons.filter(b => b.actionType === 'custom' && b.placement === 'row').map(b => b.label))]
          for (const rotulo of acoes) {
            await abrir(page, view.path)
            await aguardarLista(page)
            // o primeiro registro da lista: o id vem do endereço do link da linha
            const hrefs = await page.locator('tbody tr').first().locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''))
            const id = hrefs.map(h => h.split('?')[0].split('/').pop() ?? '').find(x => x && x !== 'new')
            test.skip(!id, 'a lista está vazia: não há linha para usar a ação')
            await page.locator('tbody tr').first().locator(`button[title="${rotulo}"]`).click()
            await expect(page.locator(`iframe[src*="${id}"]`).first(), `a ação "${rotulo}" abre a outra tela em janela, filtrada pelo registro`).toBeVisible({ timeout: 15_000 })
            await expect.soft(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
          }
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
            const campo = page.locator(`[name="${nomeDoCampo(f.column)}"]`).first()
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
          for (const f of view.filter) if (await page.locator(`[name="${nomeDoFiltro(f.column)}"]`).count()) achados++
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
          // ação de linha "Visualizar": abre o registro (em janela ou em outra página) sem gravar nada
          if (linhas > 0 && (await page.locator('main [title="Visualizar"]').count()) > 0) {
            const antes = page.url()
            await page.locator('main [title="Visualizar"]').first().click()
            await expect.poll(async () => page.url() !== antes || (await page.locator('.fixed.inset-0, [role="dialog"]').count()) > 0, { message: 'Visualizar abre o registro (janela ou página)', timeout: 10_000 }).toBe(true)
            await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
          }
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
          await expect(page.getByRole('button', { name: 'Organizar Dashboard' })).toBeVisible()
          // o BI exportado em Java não tem atualização manual nem automática (o botão "Atualizar agora" fica desligado no modelo Java): só o app Node a tem
          if (detectarApp(CONFIG.appDir).pilha === 'java') {
            await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
            return
          }
          await expect(page.getByRole('button', { name: 'Atualizar agora' })).toBeVisible()
          await page.getByRole('button', { name: 'Atualizar agora' }).click()
          await page.waitForLoadState('networkidle').catch(() => {})
          await expect(page.getByText(/Application error|Erro ao carregar/i)).toHaveCount(0)
          expect(await page.locator('tbody tr').count(), 'linhas na tabela de dados').toBeGreaterThan(0)
        })
      }

      // --- integração: grava no banco de teste (só roda com o tipo "integracao") ---

      if (t.kind === 'crud_cadastro') {
        test(t.title, async ({ page }) => {
          const marcadorCampo = campoMarcador(view) // sem ele (telas só com listas, datas e números), o registro é achado pelo id novo
          const editaveis = camposDeTipo(view).filter(f => !f.readOnly)
          const limites = await limitesDaTabela(view.table)
          const marcador = marcadorCampo ? caber(`${RODADA}-${view.slug.replace(/[^a-z0-9]/gi, '').slice(0, 6)}`, limites[marcadorCampo.column.toLowerCase()]) : ''
          test.skip(!!marcadorCampo && (!marcador.startsWith(PREFIXO_E2E) || marcador.length < 8), 'a coluna de identificação é curta demais para o prefixo E2E-')
          const idsAntes = marcadorCampo ? null : await idsDaTabela(view)
          test.skip(!marcadorCampo && idsAntes === null, 'a tabela é grande demais para identificar o registro criado pelo id')
          const estado: EstadoCrud = { marcador, preenchidos: {} }
          gravarEstado(view.slug, estado)

          await abrir(page, `${view.path}/new`)
          const naoPreenchidos: string[] = []
          let n = 0
          for (const f of editaveis) {
            const p = await preencherCampo(page, f, ++n, limites, marcadorCampo && f.column === marcadorCampo.column ? marcador : undefined)
            if (p) estado.preenchidos[f.column] = p
            else if (f.required) naoPreenchidos.push(f.label)
          }
          test.skip(naoPreenchidos.length > 0, `campo(s) obrigatório(s) que o motor ainda não sabe preencher: ${naoPreenchidos.join(', ')}`)
          test.skip(Object.keys(estado.preenchidos).length === 0, 'o motor não soube preencher nenhum campo desta tela')
          if (process.env.E2E_DEBUG) console.log(`[crud ${view.slug}] preenchido: ${JSON.stringify(estado.preenchidos)}`)

          await page.getByRole('button', { name: 'Criar Registro' }).first().click()
          let linha: Record<string, string | null>
          if (marcadorCampo) {
            await expect.poll(async () => (await consultar(`select count(*)::int n from "${view.table}" where "${marcadorCampo.column}"::text = $1`, [marcador]))[0].n, { message: 'o registro aparece no banco', timeout: 15_000 }).toBe(1)
            linha = await lerLinha(view, marcadorCampo.column, marcador, estado.preenchidos)
          } else {
            const novos = async () => [...((await idsDaTabela(view)) ?? [])].filter(id => !idsAntes!.has(id))
            await expect.poll(async () => (await novos()).length, { message: 'um registro novo aparece no banco', timeout: 15_000 }).toBe(1)
            linha = await lerLinha(view, view.primaryKey, (await novos())[0], estado.preenchidos)
          }
          estado.id = String(linha.__id)
          anotarCriado(view.table, view.primaryKey, estado.id) // se o teste cair antes de excluir, a limpeza apaga pelo id
          gravarEstado(view.slug, estado)
          // auditoria: se a tabela tem criado_por, o app precisa tê-lo gravado (quem criou o registro)
          const temAuditoria = (await comBanco(d => d.colunas(view.table))).some((c: any) => c.column_name === 'criado_por')
          if (temAuditoria) {
            const [aud] = await consultar(`select case when "criado_por" is not null then 1 else 0 end as ok from "${view.table}" where "${view.primaryKey}"::text = $1`, [estado.id])
            expect.soft(Number(aud.ok), 'auditoria: criado_por gravado no registro criado').toBe(1)
          }
          for (const f of editaveis) {
            const esp = estado.preenchidos[f.column]
            if (!esp) continue
            const dif = conferirNoBanco(f, esp, linha[f.column.toLowerCase()])
            expect.soft(dif, 'campo gravado no banco').toBeNull()
          }
        })
      }

      if (t.kind === 'crud_reabrir') {
        test(t.title, async ({ page }) => {
          const estado = lerEstado(view.slug) as EstadoCrud
          test.skip(!estado?.id, 'o cadastro anterior não criou o registro')
          expect(await registroExiste(view, estado.id!), 'o registro criado pelo cadastro continua no banco').toBe(true)
          await abrir(page, `${view.path}/${estado.id}`)
          for (const f of camposDeTipo(view)) {
            const esp = estado.preenchidos[f.column]
            if (!esp) continue
            expect.soft(await conferirNaTela(page, f, esp), 'campo mostrado ao reabrir').toBeNull()
          }
        })
      }

      if (t.kind === 'crud_edicao') {
        test(t.title, async ({ page }) => {
          const estado = lerEstado(view.slug) as EstadoCrud
          test.skip(!estado?.id, 'o cadastro anterior não criou o registro')
          const marcadorCampo = campoMarcador(view)
          const limites = await limitesDaTabela(view.table)
          expect(await registroExiste(view, estado.id!), 'o registro criado pelo cadastro continua no banco').toBe(true)
          await abrir(page, `${view.path}/${estado.id}`)
          let coluna: string
          let novo: Preenchido
          if (marcadorCampo) {
            // o campo que identifica o registro muda: o sufixo " ED" mostra na lista e no banco
            const v = caber(`${estado.marcador} ED`, limites[marcadorCampo.column.toLowerCase()])
            test.skip(v === estado.marcador, 'a coluna de identificação não comporta a alteração')
            await page.locator(`[name="${nomeDoCampo(marcadorCampo.column)}"]`).first().fill(v)
            coluna = marcadorCampo.column; novo = { tipo: 'texto', esperado: v }
          } else {
            const r = await editarUmCampo(page, view, estado, limites)
            test.skip(!r, 'nenhum campo preenchido pode ser alterado com segurança')
            coluna = r!.coluna; novo = r!.novo
          }
          await page.getByRole('button', { name: 'Salvar Alterações' }).first().click()
          const campoDef = camposDeTipo(view).find(f => f.column === coluna)!
          await expect.poll(async () => conferirNoBanco(campoDef, novo, (await lerLinha(view, view.primaryKey, estado.id!, { [coluna]: novo }))[coluna.toLowerCase()]), { message: 'a alteração aparece no banco', timeout: 15_000 }).toBeNull()
          if (marcadorCampo) estado.marcador = novo.esperado
          estado.preenchidos[coluna] = novo
          gravarEstado(view.slug, estado)
          // só o campo alterado mudou: os demais continuam como foram gravados
          const linha = await lerLinha(view, view.primaryKey, estado.id!, estado.preenchidos)
          for (const f of camposDeTipo(view)) {
            const esp = estado.preenchidos[f.column]
            if (esp) expect.soft(conferirNoBanco(f, esp, linha[f.column.toLowerCase()]), 'campo depois da edição').toBeNull()
          }
        })
      }

      if (t.kind === 'crud_exclusao') {
        test(t.title, async ({ page }) => {
          const estado = lerEstado(view.slug) as EstadoCrud
          test.skip(!estado?.id, 'o cadastro anterior não criou o registro')
          const contar = async () => Number((await consultar(`select count(*)::int n from "${view.table}"`))[0].n)
          const antes = await contar()
          await abrir(page, view.path)
          await aguardarLista(page)
          const linha = await acharLinha(page, estado.id!)
          expect(linha, `a linha do registro criado (${estado.marcador || estado.id}) aparece na lista`).not.toBeNull()
          await linha!.locator('button[title="Excluir"], a[title="Excluir"]').first().click()
          await confirmarExclusao(page)
          await expect.poll(async () => registroExiste(view, estado.id!), { message: 'o registro some do banco', timeout: 15_000 }).toBe(false)
          expect(await contar(), 'só o registro criado pelo teste foi excluído').toBe(antes - 1)
          riscarCriado(view.table, estado.id!)
          gravarEstado(view.slug, undefined)
        })
      }

      // --- kanban: arrastar um cartão para outra coluna grava a coluna nova (a linha volta ao que era no fim) ---

      if (t.kind === 'kanban_mover') {
        test(t.title, async ({ page }) => {
          test.skip(dialeto() !== 'postgres', 'devolver a linha ao que era (sem a auditoria do gatilho) só está implementado para Postgres')
          const grupo = view.kanbanGroupColumn!
          const pk = view.primaryKey
          const total = Number((await consultar(`select count(*)::int n from "${view.table}"`))[0].n)
          test.skip(total > 5000, 'a tabela é grande demais para guardar uma cópia e devolver a linha ao que era')
          // a tabela como estava, em JSON (mantém a precisão exata de datas e números): a linha movida volta inteira, inclusive a auditoria de quem/quando gravou
          const foto = () => fotografar(view)
          const originais = await foto()
          const valores = [...new Set([...originais.values()].map(j => String(j[grupo] ?? '')).filter(Boolean))]
          test.skip(valores.length < 2, 'precisa de pelo menos dois valores diferentes na coluna do quadro para arrastar o cartão')
          try {
            await abrir(page, view.path)
            await aguardarTela(page)
            const colunas = page.locator('main div.w-80')
            const titulo = async (c: Locator) => ((await c.locator('h3').first().innerText()).trim())
            const largura = page.viewportSize()!.width
            // origem: a primeira coluna com cartão; destino: a coluna vizinha que cabe na tela junto com ela (título igual a um valor da coluna no banco)
            let origem: Locator | null = null
            let iOrigem = -1
            for (let i = 0; i < await colunas.count(); i++) if ((await colunas.nth(i).locator('div.cursor-grab').count()) > 0) { origem = colunas.nth(i); iOrigem = i; break }
            test.skip(!origem, 'o quadro não mostra nenhum cartão')
            await origem!.scrollIntoViewIfNeeded()
            const tituloOrigem = await titulo(origem!)
            let destino: Locator | null = null
            for (const i of [iOrigem + 1, iOrigem - 1, iOrigem + 2, iOrigem - 2]) {
              if (i < 0 || i >= await colunas.count()) continue
              const c = colunas.nth(i)
              const caixa = await c.boundingBox()
              const tt = await titulo(c)
              if (caixa && caixa.x >= 0 && caixa.x + caixa.width <= largura && valores.some(v => v.toLowerCase() === tt.toLowerCase())) { destino = c; break }
            }
            test.skip(!destino, 'nenhuma coluna vizinha cabe na tela com o título de um valor da coluna no banco')
            const tituloDestino = await titulo(destino!)
            const esperadoDestino = valores.find(v => v.toLowerCase() === tituloDestino.toLowerCase())!
            const cartao = origem!.locator('div.cursor-grab').first()
            await cartao.scrollIntoViewIfNeeded()
            const de = (await cartao.boundingBox())!
            const para = (await destino!.boundingBox())!
            await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2)
            await page.mouse.down()
            await page.mouse.move(de.x + de.width / 2 + 12, de.y + de.height / 2 + 12, { steps: 4 }) // passa do limite de 8px que ativa o arraste
            await page.mouse.move(para.x + para.width / 2, de.y + de.height / 2, { steps: 25 })
            await page.mouse.up()
            // exatamente uma linha mudou de coluna, e foi para a coluna onde o cartão foi solto
            const mudadas = async () => [...(await foto())].filter(([id, j]) => String(j[grupo] ?? '') !== String(originais.get(id)![grupo] ?? ''))
            await expect.poll(async () => (await mudadas()).length, { message: 'uma linha mudou de coluna no banco', timeout: 15_000 }).toBe(1)
            const [idMovida, movida] = (await mudadas())[0]
            expect(String(movida[grupo]), `o cartão foi gravado na coluna onde foi solto ("${esperadoDestino}", vinda de "${tituloOrigem}")`).toBe(esperadoDestino)
            expect(String(originais.get(idMovida)![grupo]).toLowerCase(), 'e saiu da coluna de onde foi arrastado').toBe(tituloOrigem.toLowerCase())
            // depois de recarregar, o cartão continua na coluna nova
            await abrir(page, view.path)
            await aguardarTela(page)
            const nova = page.locator('main div.w-80').filter({ has: page.locator('h3', { hasText: new RegExp(`^${escapar(tituloDestino)}$`, 'i') }) }).first()
            expect.soft(await nova.locator('div.cursor-grab').count(), 'cartões na coluna de destino depois de recarregar').toBeGreaterThan(0)
          } finally {
            await devolverLinhas(view, originais) // o que o arraste mudou volta ao que era, mesmo se o teste falhou no meio
          }
        })
      }

      // --- fluxo: arrastar só move; ligar grava a etapa anterior; ciclo é recusado ---

      if (t.kind === 'fluxo_conectar') {
        test(t.title, async ({ page }) => {
          test.skip(dialeto() !== 'postgres', 'devolver as linhas ao que eram (sem a auditoria do gatilho) só está implementado para Postgres')
          const pred = view.blueprintPredecessorColumn!
          const total = Number((await consultar(`select count(*)::int n from "${view.table}"`))[0].n)
          test.skip(total > 500, 'a tabela é grande demais para o quadro mostrar todas as etapas')
          const originais = await fotografar(view)
          const anterioresDe = (m: Map<string, Record<string, unknown>>, id: string) => String(m.get(id)?.[pred] ?? '').split(',').map(x => x.trim()).filter(Boolean)
          const descendentes = (id: string): Set<string> => { const out = new Set<string>(); const fila = [id]; while (fila.length) { const x = fila.pop()!; for (const o of originais.keys()) if (!out.has(o) && anterioresDe(originais, o).includes(x)) { out.add(o); fila.push(o) } } return out }
          try {
            await abrir(page, view.path)
            await aguardarTela(page)
            await expect(page.locator('.react-flow')).toBeVisible()
            await page.locator('.react-flow').scrollIntoViewIfNeeded()
            await page.waitForTimeout(1200) // o quadro se ajusta sozinho à tela (fitView animado) logo que abre
            const no = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)
            const naTela = await page.locator('.react-flow__node').evaluateAll(ns => ns.map(n => n.getAttribute('data-id') ?? ''))
            // destino: uma etapa sem anterior; origem: outra que não seja descendente dela (ligar não fecha um ciclo). Escolhe o par mais próximo na tela, para dar zoom nos dois.
            const caixas = new Map<string, { x: number; y: number }>()
            const pane = (await page.locator('.react-flow').boundingBox())!
            // só as etapas que estão dentro do quadro (as outras ficam fora da parte visível)
            for (const id of naTela) { const c = await no(id).boundingBox(); if (c && c.x >= pane.x && c.x + c.width <= pane.x + pane.width && c.y >= pane.y && c.y + c.height <= pane.y + Math.min(pane.height, 780 - pane.y + 0)) caixas.set(id, { x: c.x + c.width / 2, y: c.y + c.height / 2 }) }
            const dist = (a: string, b: string) => Math.hypot(caixas.get(a)!.x - caixas.get(b)!.x, caixas.get(a)!.y - caixas.get(b)!.y)
            let melhor: { B: string; A: string; d: number } | null = null
            for (const b of naTela) {
              if (!caixas.has(b) || !originais.has(b) || anterioresDe(originais, b).length > 0) continue
              const desc = descendentes(b)
              for (const a of naTela) if (a !== b && caixas.has(a) && originais.has(a) && !desc.has(a) && (!melhor || dist(a, b) < melhor.d)) melhor = { B: b, A: a, d: dist(a, b) }
            }
            test.skip(!melhor, 'não há duas etapas visíveis que possam ser ligadas sem formar um ciclo')
            const { A, B } = melhor!
            // com muitas etapas o quadro mostra tudo miúdo: dá zoom (roda do mouse) no meio do par até as etapas ficarem grandes e continuarem as duas na tela
            const meio = { x: (caixas.get(A)!.x + caixas.get(B)!.x) / 2, y: (caixas.get(A)!.y + caixas.get(B)!.y) / 2 }
            await page.mouse.move(meio.x, meio.y)
            for (let i = 0; i < 12 && (((await no(B).boundingBox())?.width ?? 0) < 150); i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(120) }
            const quadro = (await page.locator('.react-flow').boundingBox())!
            const cabe = async (id: string) => { const c = await no(id).boundingBox(); return !!c && c.x >= quadro.x && c.y >= quadro.y && c.x + c.width <= quadro.x + quadro.width && c.y + c.height <= quadro.y + quadro.height }
            test.skip(!(await cabe(A)) || !(await cabe(B)), 'as duas etapas a ligar não cabem juntas na tela depois do zoom')
            const centro = async (l: Locator) => { const c = (await l.boundingBox())!; return { x: c.x + c.width / 2, y: c.y + c.height / 2 } }
            const arrastar = async (de: { x: number; y: number }, para: { x: number; y: number }) => {
              await page.mouse.move(de.x, de.y); await page.mouse.down()
              await page.mouse.move(de.x + 6, de.y + 6, { steps: 3 }); await page.mouse.move(para.x, para.y, { steps: 20 }); await page.mouse.up()
            }
            const mudadas = async () => [...(await fotografar(view))].filter(([id, j]) => JSON.stringify(j) !== JSON.stringify(originais.get(id)))
            const aresta = (de: string, para: string) => page.locator(`[data-testid^="rf__edge-edge-${de}-${para}-"], .react-flow__edge[data-id^="edge-${de}-${para}-"]`)

            // 1) arrastar a etapa só a move na tela: nada é gravado
            const posicao = async () => (await no(B).boundingBox())!
            const antes = await posicao()
            const corpo = { x: antes.x + antes.width / 2, y: antes.y + 14 } // a faixa de cima da etapa (sem botões)
            await arrastar(corpo, { x: corpo.x + 90, y: corpo.y + 60 })
            await expect.poll(async () => { const d = await posicao(); return Math.abs(d.x - antes.x) + Math.abs(d.y - antes.y) }, { message: 'a etapa se moveu na tela', timeout: 5_000 }).toBeGreaterThan(20)
            await page.waitForTimeout(500)
            expect((await mudadas()).length, 'mover a etapa na tela não grava nada').toBe(0)

            // 2) ligar A -> B grava o id de A como etapa anterior de B (e só isso)
            await arrastar(await centro(no(A).locator('.react-flow__handle.source').first()), await centro(no(B).locator('.react-flow__handle.target').first()))
            await expect.poll(async () => String((await fotografar(view)).get(B)?.[pred] ?? ''), { message: 'a etapa anterior de B é A no banco', timeout: 15_000 }).toBe(A)
            expect((await mudadas()).map(([id]) => id), 'só a etapa de destino mudou').toEqual([B])
            await expect(aresta(A, B).first(), 'a linha A → B aparece na tela').toBeVisible()

            // 3) ligar B -> A fecharia um ciclo (A já vem antes de B): é recusado e nada muda
            const aposLigar = JSON.stringify([...(await fotografar(view))])
            await arrastar(await centro(no(B).locator('.react-flow__handle.source').first()), await centro(no(A).locator('.react-flow__handle.target').first()))
            await page.waitForTimeout(1500)
            expect(JSON.stringify([...(await fotografar(view))]), 'a ligação que formaria um ciclo foi recusada: o banco não mudou').toBe(aposLigar)
            await expect(aresta(B, A), 'e a linha B → A não foi criada').toHaveCount(0)
          } finally {
            await devolverLinhas(view, originais) // as etapas voltam ao que eram, mesmo se o teste falhou no meio
          }
        })
      }

      // --- segurança: derivada da configuração de acesso do projeto (só com o tipo "seguranca"; cria usuários e grupos temporários e os apaga) ---

      if (t.kind === 'seg_tabela') {
        test(t.title, async ({ page }) => {
          const tp = view.tablePerms ?? { create: true, update: true, delete: true }
          await abrir(page, view.path)
          await aguardarLista(page)
          const visiveis = (loc: Locator) => loc.locator('visible=true').count()
          expect((await visiveis(page.getByRole('link', { name: 'Novo Registro' }))) > 0, `"Novo Registro" visível (criar ${tp.create ? 'permitido' : 'proibido'} pelo Studio)`).toBe(tp.create)
          const linhas = (await linhasDoGrid(page)).length
          test.skip(linhas === 0, 'a lista está vazia: sem linhas não há ícones de editar e excluir para conferir')
          expect((await visiveis(page.locator('main [title="Editar"]'))) > 0, `ícone Editar visível (editar ${tp.update ? 'permitido' : 'proibido'} pelo Studio)`).toBe(tp.update)
          expect((await visiveis(page.locator('main [title="Excluir"]'))) > 0, `ícone Excluir visível (excluir ${tp.delete ? 'permitido' : 'proibido'} pelo Studio)`).toBe(tp.delete)
        })
      }

      if (t.kind === 'seg_nivel_nenhum' || t.kind === 'seg_nivel_leitura') {
        const nivel = t.kind === 'seg_nivel_nenhum' ? 'none' : 'read'
        test(t.title, async ({ browser }) => {
          const auth = manifest.auth!
          const u = await criarUsuarioTemporario(auth, { nivel: { viewSlug: view.slug, nivel } })
          const marcadorCampo = campoMarcador(view)
          const marcador = `${RODADA}-forcado`
          const ctx = await browser.newContext({ baseURL: `http://localhost:${CONFIG.port}`, locale: 'pt-BR', viewport: { width: 1280, height: 800 } })
          try {
            const pag = await ctx.newPage()
            await entrarComo(pag, u.email, u.senha)
            const menu = (await pag.locator('aside nav a[href^="/"]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).getAttribute('href')))) as string[]
            await abrir(pag, view.path)
            if (nivel === 'none') {
              expect(menu, 'o menu do grupo sem acesso não lista a tela').not.toContain(view.path)
              expect(await pag.locator('thead th').count(), 'a tela bloqueada não mostra a lista').toBe(0)
              expect(await pag.getByText(/TOTAL:\s*\d+/i).count(), 'a tela bloqueada não mostra o total').toBe(0)
              await abrir(pag, `${view.path}/new`)
              if (marcadorCampo) expect(await pag.locator(`[name="${nomeDoCampo(marcadorCampo.column)}"]`).locator('visible=true').count(), 'o formulário não abre pelo endereço').toBe(0)
            } else {
              expect(menu, 'o menu do grupo de leitura lista a tela').toContain(view.path)
              await aguardarLista(pag)
              expect(await totalMostrado(pag), 'a lista abre e mostra o total').not.toBeNull()
              expect(await pag.getByRole('link', { name: 'Novo Registro' }).locator('visible=true').count(), '"Novo Registro" escondido na leitura').toBe(0)
              expect(await pag.locator('main [title="Editar"]').locator('visible=true').count(), 'ícone Editar escondido na leitura').toBe(0)
              expect(await pag.locator('main [title="Excluir"]').locator('visible=true').count(), 'ícone Excluir escondido na leitura').toBe(0)
              // o servidor recusa gravar mesmo se a pessoa forçar o endereço do formulário
              if (marcadorCampo) {
                await abrir(pag, `${view.path}/new`)
                const campo = pag.locator(`[name="${nomeDoCampo(marcadorCampo.column)}"]`).first()
                if ((await campo.count()) && (await campo.isEnabled())) {
                  await campo.fill(marcador)
                  const criar = pag.getByRole('button', { name: 'Criar Registro' }).first()
                  if (await criar.count()) await criar.click()
                  await pag.waitForTimeout(1500)
                }
                const criados = Number((await consultar(`select count(*)::int n from "${view.table}" where "${marcadorCampo.column}"::text = $1`, [marcador]))[0].n)
                if (criados > 0) await consultar(`delete from "${view.table}" where "${marcadorCampo.column}"::text = $1`, [marcador]).catch(() => {})
                expect(criados, 'o servidor aceitou gravar com acesso só de leitura').toBe(0)
              }
            }
          } finally {
            await ctx.close()
            await removerUsuarioTemporario(auth, u)
          }
        })
      }

      if (t.kind === 'seg_linha') {
        const regra = regraDeLinha(view)!
        test(t.title, async ({ browser }) => {
          const auth = manifest.auth!
          const u = await criarUsuarioTemporario(auth, { grupoSemRestricao: true })
          const marcadorCampo = campoMarcador(view)
          const ctx = await browser.newContext({ baseURL: `http://localhost:${CONFIG.port}`, locale: 'pt-BR', viewport: { width: 1280, height: 800 } })
          try {
            // linhas que a regra deixa este usuário ver: as que têm, na coluna da regra, o valor dele (sem o dado, a regra nega tudo)
            const valor = await valorDaRegra(auth, u.id, regra.source, regra.attr)
            const rel = regra.op === 'related' ? regra.related! : null
            // 'related': a coluna aponta para uma linha de outra tabela cuja coluna é igual ao valor do usuário
            const esperado = async () => valor === null ? 0 : Number((await consultar(rel
              ? `select count(*)::int n from "${view.table}" where "${regra.column}" in (select "${rel.key}" from "${rel.table}" where "${rel.column}"::text = $1)`
              : `select count(*)::int n from "${view.table}" where "${regra.column}"::text = $1`, [valor]))[0].n)
            const noBanco = Number((await consultar(`select count(*)::int n from "${view.table}"`))[0].n)
            const pag = await ctx.newPage()
            await entrarComo(pag, u.email, u.senha)
            await abrir(pag, view.path)
            await aguardarLista(pag)
            expect(await pag.locator('thead th').count(), 'a lista abriu para o usuário temporário (um grupo sem restrição de tela)').toBeGreaterThan(0)
            expect(await totalOuZero(pag), `o usuário temporário (fora da exceção) vê só as linhas da regra; a tabela tem ${noBanco}`).toBe(await esperado())
            if (noBanco > 0) expect(await totalOuZero(pag), 'a regra esconde as linhas de outras pessoas').toBeLessThan(noBanco)

            // com a regra apontando para quem criou o registro: o que o usuário cria, ele passa a ver
            if (/^(criado_por|created_by)$/i.test(regra.column) && regra.source === 'user.attr' && marcadorCampo) {
              const antes = await esperado()
              const marcador = caber(`${RODADA}-linha`, (await limitesDaTabela(view.table))[marcadorCampo.column])
              await abrir(pag, `${view.path}/new`)
              const limites = await limitesDaTabela(view.table)
              const naoPreenchidos: string[] = []
              let n = 0
              for (const f of camposDeTipo(view).filter(x => !x.readOnly)) {
                const p = await preencherCampo(pag, f, ++n, limites, f.column === marcadorCampo.column ? marcador : undefined)
                if (!p && f.required) naoPreenchidos.push(f.label)
              }
              if (process.env.E2E_DEBUG && naoPreenchidos.length) console.log(`[seg_linha ${view.slug}] não preenchidos: ${naoPreenchidos.join(', ')} · url ${pag.url()}`)
              test.skip(naoPreenchidos.length > 0, `campo(s) obrigatório(s) que o motor ainda não sabe preencher: ${naoPreenchidos.join(', ')}`)
              await pag.getByRole('button', { name: 'Criar Registro' }).first().click()
              await expect.poll(async () => Number((await consultar(`select count(*)::int n from "${view.table}" where "${marcadorCampo.column}"::text = $1`, [marcador]))[0].n), { timeout: 15_000 }).toBe(1)
              await abrir(pag, view.path)
              await aguardarLista(pag)
              expect(await pag.locator('thead th').count(), 'a lista abriu depois do cadastro').toBeGreaterThan(0)
              expect(await totalOuZero(pag), 'o registro criado pelo usuário aparece para ele').toBe(antes + 1)
              expect(await totalOuZero(pag), 'e continua sem ver as linhas de outras pessoas').toBeLessThan(noBanco + 1)
            }
          } finally {
            await ctx.close()
            // o que o usuário temporário criou sai antes dele (a auditoria aponta para o usuário)
            if (marcadorCampo) await consultar(`delete from "${view.table}" where "${marcadorCampo.column}"::text like $1`, [PREFIXO_E2E + '%']).catch(() => {})
            await removerUsuarioTemporario(auth, u)
          }
        })
      }

      // --- gestão de acesso do app (Usuários, Grupos, Permissões de Telas): só com o tipo "seguranca" e a gestão de acesso ligada ---

      if (t.kind.startsWith('acesso_')) {
        const auth = manifest.auth!
        const ac = auth.access!
        const rotulo = (k: string) => new RegExp(`^(${(ac.labels[k] ?? [k]).map(escapar).join('|')})$`, 'i')
        const porTitulo = (k: string, el = 'button') => (ac.labels[k] ?? [k]).map(v => `${el}[title="${v}"]`).join(', ')
        const confirmar = /excluir|delete|eliminar|confirmar|confirm|^sim$|^yes$|^sí$/i
        const janela = (p: Page) => p.getByRole('dialog').last()
        const novoContexto = (browser: import('@playwright/test').Browser) => browser.newContext({ baseURL: `http://localhost:${CONFIG.port}`, locale: 'pt-BR', viewport: { width: 1280, height: 800 } })

        if (t.kind === 'acesso_abre') {
          test(t.title, async ({ page }) => {
            for (const [chave, tela] of [['users_title', ac.screens.users], ['groups_title', ac.screens.groups], ['perms_title', ac.screens.permissions]] as const) {
              await abrir(page, tela.path)
              await aguardarTela(page)
              await expect.soft(page.getByText(rotulo(chave)).first(), `título da tela ${tela.path}`).toBeVisible()
              await expect.soft(page.getByText(/Application error|Erro ao carregar/i), `erro em ${tela.path}`).toHaveCount(0)
            }
          })
        }

        if (t.kind === 'acesso_usuarios_lista') {
          test(t.title, async ({ page }) => {
            const usuarios = await comBanco(d => acesso.usuariosReais(d, auth, 5))
            test.skip(usuarios.length === 0, 'a tabela de usuários está vazia')
            await abrir(page, ac.screens.users.path)
            await aguardarTela(page)
            for (const u of usuarios) {
              const linha = page.locator('tbody tr').filter({ hasText: u.email })
              await expect.soft(linha, `usuário ${u.email} na lista`).toHaveCount(1)
              const grupo = await comBanco(d => acesso.grupoDoUsuario(d, auth, u.id))
              if (grupo && (await linha.count()) === 1) await expect.soft(linha.locator('select'), `grupo de ${u.email}`).toHaveValue(grupo)
            }
          })
        }

        if (t.kind === 'acesso_usuario_ciclo') {
          test(t.title, async ({ page, browser }) => {
            const grupos = (await comBanco(d => acesso.listarGrupos(d, auth))).filter((g: any) => !/^E2E-/i.test(String(g.nome)))
            test.skip(grupos.length < 2, 'precisa de pelo menos dois grupos (que não sejam de teste) para trocar o grupo do usuário')
            const [g1, g2] = grupos
            const email = `e2e_seg_${unico()}@metabuilder.local`
            const antesOutros = await comBanco(d => acesso.vinculosDeOutros(d, auth))
            let uid: string | undefined
            try {
              await abrir(page, ac.screens.users.path)
              await aguardarTela(page)
              await page.getByRole('button', { name: rotulo('create_user') }).click()
              const j = janela(page)
              await j.getByPlaceholder(rotulo('name_optional')).fill('E2E Usuário Temporário')
              await j.locator('input[type="email"]').fill(email)
              await j.locator('input[type="password"]').fill('Senha-Inicial-1')
              await j.locator('select').selectOption({ label: g1.nome })
              await j.getByRole('button', { name: rotulo('save') }).click()
              await expect.poll(async () => (await comBanco(d => acesso.usuarioPorEmail(d, auth, email))) ?? '', { message: 'o usuário aparece no banco', timeout: 15_000 }).not.toBe('')
              uid = (await comBanco(d => acesso.usuarioPorEmail(d, auth, email))) as string
              const hash = await comBanco(d => acesso.lerHashDoUsuario(d, auth, uid!))
              expect(String(hash), 'a senha é gravada em hash, nunca em texto').not.toBe('Senha-Inicial-1')
              expect(acesso.confereSenha(auth.hash, 'Senha-Inicial-1', hash), 'o hash confere com a senha informada').toBe(true)
              expect(await comBanco(d => acesso.grupoDoUsuario(d, auth, uid!)), 'grupo escolhido ao criar').toBe(g1.id)

              // o usuário novo consegue entrar
              const ctx = await novoContexto(browser)
              try { const p2 = await ctx.newPage(); await entrarComo(p2, email, 'Senha-Inicial-1') } finally { await ctx.close() }

              // trocar de grupo pela lista
              await abrir(page, ac.screens.users.path)
              await aguardarTela(page)
              const linha = page.locator('tbody tr').filter({ hasText: email })
              await linha.locator('select').selectOption({ label: g2.nome })
              await expect.poll(async () => await comBanco(d => acesso.grupoDoUsuario(d, auth, uid!)), { message: 'o grupo novo aparece no banco', timeout: 15_000 }).toBe(g2.id)

              // redefinir a senha: a nova vale, a antiga não
              await linha.locator(porTitulo('reset_password')).first().click()
              const j2 = janela(page)
              const senhas = j2.locator('input[type="password"]')
              await senhas.nth(0).fill('Senha-Nova-2')
              await senhas.nth(1).fill('Senha-Nova-2')
              await j2.getByRole('button', { name: rotulo('save') }).click()
              await expect.poll(async () => acesso.confereSenha(auth.hash, 'Senha-Nova-2', await comBanco(d => acesso.lerHashDoUsuario(d, auth, uid!))), { message: 'a senha nova vale', timeout: 15_000 }).toBe(true)
              const ctx2 = await novoContexto(browser)
              try {
                const velho = await ctx2.newPage()
                await velho.goto('/login')
                await velho.locator('input[name="email"]').fill(email)
                await velho.locator('input[name="password"]').fill('Senha-Inicial-1')
                await velho.locator('button[type="submit"]').click()
                await velho.waitForTimeout(2000)
                expect(velho.url(), 'a senha antiga já não entra').toMatch(/\/login/)
              } finally { await ctx2.close() }

              // excluir pela janela de confirmação do app
              await abrir(page, ac.screens.users.path)
              await aguardarTela(page)
              await page.locator('tbody tr').filter({ hasText: email }).locator(porTitulo('delete')).first().click()
              await janela(page).getByRole('button', { name: confirmar }).last().click()
              await expect.poll(async () => (await comBanco(d => acesso.usuarioPorEmail(d, auth, email))) ?? '', { message: 'o usuário some do banco', timeout: 15_000 }).toBe('')
              expect(await comBanco(d => acesso.grupoDoUsuario(d, auth, uid!)), 'o vínculo com o grupo também some').toBeNull()
              // trocar de grupo e excluir um usuário não pode ter mexido no vínculo de ninguém mais
              expect(await comBanco(d => acesso.vinculosDeOutros(d, auth)), 'vínculos dos outros usuários').toBe(antesOutros)
            } finally {
              if (uid) await comBanco(d => acesso.apagarUsuario(d, auth, uid!)).catch(() => {})
            }
          })
        }

        if (t.kind === 'acesso_email_repetido') {
          test(t.title, async ({ page }) => {
            const existente = CONFIG.user || (await comBanco(d => acesso.usuariosReais(d, auth, 1)))[0]?.email
            test.skip(!existente, 'não há e-mail existente para repetir')
            const contar = async () => Number((await consultar(`select count(*)::int n from ${auth.usersTable}`))[0].n)
            await abrir(page, ac.screens.users.path)
            await aguardarTela(page)
            const antes = await contar()
            await page.getByRole('button', { name: rotulo('create_user') }).click()
            const j = janela(page)
            await j.getByPlaceholder(rotulo('name_optional')).fill('E2E Repetido') // com nome, para o erro vir do e-mail repetido e não do nome vazio
            await j.locator('input[type="email"]').fill(existente)
            await j.locator('input[type="password"]').fill('Qualquer-Senha-1')
            await j.getByRole('button', { name: rotulo('save') }).click()
            await page.waitForTimeout(1500)
            const depois = await contar()
            if (depois > antes && auth.nameColumn) await consultar(`delete from ${auth.usersTable} where ${auth.nameColumn} = $1`, ['E2E Repetido']).catch(() => {})
            expect(depois, 'nenhum usuário foi criado com o e-mail repetido').toBe(antes)
            await expect(janela(page).getByRole('button', { name: rotulo('save') }), 'a janela continua aberta, com o erro dentro').toBeVisible()
          })
        }

        if (t.kind === 'acesso_grupo_ciclo') {
          test(t.title, async ({ page }) => {
            const nome = `E2E-Perm-${unico()} UI`
            const existe = async (n: string) => (await comBanco(d => acesso.listarGrupos(d, auth))).some((g: any) => g.nome === n)
            try {
              await abrir(page, ac.screens.groups.path)
              await aguardarTela(page)
              await page.getByRole('button', { name: rotulo('create_group') }).click()
              await janela(page).getByRole('textbox').fill(nome)
              await janela(page).getByRole('button', { name: rotulo('save') }).click()
              await expect.poll(() => existe(nome), { message: 'o grupo aparece no banco', timeout: 15_000 }).toBe(true)

              await abrir(page, ac.screens.groups.path)
              await aguardarTela(page)
              const linha = page.locator('tbody tr').filter({ hasText: nome })
              await expect(linha, 'o grupo na lista').toHaveCount(1)
              await linha.locator(porTitulo('rename')).first().click()
              const novoNome = nome + ' B'
              await janela(page).getByRole('textbox').fill(novoNome)
              await janela(page).getByRole('button', { name: rotulo('save') }).click()
              await expect.poll(() => existe(novoNome), { message: 'o novo nome aparece no banco', timeout: 15_000 }).toBe(true)

              await abrir(page, ac.screens.groups.path)
              await aguardarTela(page)
              await page.locator('tbody tr').filter({ hasText: novoNome }).locator(porTitulo('delete')).first().click()
              await janela(page).getByRole('button', { name: confirmar }).last().click()
              await expect.poll(() => existe(novoNome), { message: 'o grupo some do banco', timeout: 15_000 }).toBe(false)
            } finally {
              await comBanco(async d => { for (const g of (await acesso.listarGrupos(d, auth)).filter((x: any) => String(x.nome).startsWith(nome))) await acesso.apagarGrupo(d, auth, g.id).catch(() => {}) }).catch(() => {})
            }
          })
        }

        if (t.kind === 'acesso_permissoes_matriz') {
          test(t.title, async ({ page }) => {
            const grupos = (await comBanco(d => acesso.listarGrupos(d, auth))).slice(0, 4)
            await abrir(page, ac.screens.permissions.path)
            await aguardarTela(page)
            const cabecalho = await page.locator('thead th').allInnerTexts()
            for (const g of grupos) expect.soft(cabecalho.some(c => norm(c).includes(norm(g.nome))), `grupo "${g.nome}" no cabeçalho da matriz`).toBe(true) // a tela mostra os nomes em maiúsculas (estilo): compara sem diferenciar
            for (const v of manifest.views.filter(x => x.logicType !== 'gestao_acesso' && x.path).slice(0, 6)) {
              await expect.soft(page.locator('td p').filter({ hasText: new RegExp(`^${escapar(v.path)}$`) }).first(), `tela ${v.path} na matriz`).toBeVisible()
            }
          })
        }

        if (t.kind === 'acesso_permissao_ciclo') {
          test(t.title, async ({ page }) => {
            const alvo = manifest.views.find(x => x.logicType === 'pesquisa_cadastro')
            test.skip(!alvo, 'sem caso de uso para mudar a permissão')
            const u = await criarUsuarioTemporario(auth, { grupoSemRestricao: true })
            try {
              const nomeGrupo = String((await comBanco(d => acesso.listarGrupos(d, auth))).find((g: any) => g.id === u.grupoId)?.nome)
              await abrir(page, ac.screens.permissions.path)
              await aguardarTela(page)
              // a coluna do grupo de teste é achada pelo NOME no cabeçalho (nunca por posição: um clique no grupo errado alteraria um grupo de verdade)
              const coluna = (await page.locator('thead th').allInnerTexts()).findIndex(c => norm(c).includes(norm(nomeGrupo)))
              expect(coluna, `coluna do grupo ${nomeGrupo} na matriz`).toBeGreaterThan(0)
              const linha = page.locator('tbody tr').filter({ has: page.locator('td p', { hasText: new RegExp(`^${escapar(alvo!.path)}$`) }) })
              const celula = linha.locator('td').nth(coluna)
              await celula.locator('button', { hasText: rotulo('level_none') }).click()
              await expect.poll(async () => await comBanco(d => acesso.nivelDoGrupo(d, auth, u.grupoId!, alvo!.slug)), { message: 'o nível "nenhum" aparece no banco', timeout: 15_000 }).toBe('none')
              await celula.locator('button', { hasText: rotulo('level_write') }).click()
              await expect.poll(async () => (await comBanco(d => acesso.nivelDoGrupo(d, auth, u.grupoId!, alvo!.slug))) ?? 'write', { message: 'o nível volta a escrita', timeout: 15_000 }).toBe('write')
            } finally { await removerUsuarioTemporario(auth, u) }
          })
        }

        if (t.kind === 'acesso_so_admin') {
          test(t.title, async ({ browser }) => {
            const u = await criarUsuarioTemporario(auth, { grupoSemRestricao: true })
            const ctx = await novoContexto(browser)
            try {
              const pag = await ctx.newPage()
              await entrarComo(pag, u.email, u.senha)
              for (const [tela, botao] of [[ac.screens.users.path, 'create_user'], [ac.screens.groups.path, 'create_group'], [ac.screens.permissions.path, 'level_none']] as const) {
                await abrir(pag, tela)
                await aguardarTela(pag)
                await expect.soft(pag.getByRole('button', { name: rotulo(botao) }), `quem não é admin não vê o botão "${botao}" em ${tela}`).toHaveCount(0)
              }
            } finally { await ctx.close(); await removerUsuarioTemporario(auth, u) }
          })
        }
      }
    }
  })
}
