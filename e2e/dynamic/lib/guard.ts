import fs from 'node:fs'
import path from 'node:path'
import { CONFIG } from './config'
import { consultar } from './db'
import type { TestManifest } from '../../../src/lib/testing/manifestTypes'

/**
 * Trava de segurança do motor dinâmico, para qualquer projeto (não conhece tabelas de antemão):
 *  1. antes de começar: o banco de teste tem de ser uma cópia que o cliente confirmou, ou o banco original com o consentimento dele; o motor injeta esta conexão no app (DATABASE_URL), então o app e a conferência usam o mesmo banco;
 *  2. durante: o motor só lê; a única regra que poderia gravar (salvar o formulário vazio) apaga o que criou e falha;
 *  3. no fim: a "impressão digital" de cada tabela dos casos de uso (quantidade de linhas e um resumo de todo o conteúdo) tem de ser a mesma do início.
 */

const LOCAIS = ['localhost', '127.0.0.1', '::1']
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const LIMITE_RESUMO = 200_000

const dbOf = (url: string) => { const u = new URL(url); return { host: u.hostname, db: u.pathname.replace(/^\//, '') } }

/** DATABASE_URL do .env.local do app exportado. */
function bancoDoApp(): string {
  const f = path.join(CONFIG.appDir, '.env.local')
  if (!fs.existsSync(f)) throw new Error(`Não achei ${f}. Ejete o projeto para a pasta do app e tente de novo.`)
  const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(fs.readFileSync(f, 'utf8'))
  if (!m) throw new Error('DATABASE_URL não encontrado no .env.local do app exportado.')
  return m[1]
}

export function assertSeguro() {
  if (!CONFIG.appDir || !fs.existsSync(path.join(CONFIG.appDir, 'package.json'))) throw new Error(`Não achei o app exportado em "${CONFIG.appDir}".`)
  if (!CONFIG.dbUrl) throw new Error('Falta a conexão com o banco de teste (dbUrl).')
  if (!CONFIG.noAuth && (!CONFIG.user || !CONFIG.password)) throw new Error('Falta o usuário de teste do app (a IDE o cria no banco de teste).')
  const teste = dbOf(CONFIG.dbUrl)
  if (CONFIG.mode === 'copy') {
    // cópia informada pelo cliente: pode estar em qualquer lugar, mas só vale se ele confirmou que é uma cópia (o motor injeta esta conexão no app)
    if (!CONFIG.copyConfirmed) throw new Error('Recusado: falta a confirmação de que o banco informado é uma cópia de teste (não o banco de produção).')
  } else {
    // banco original do app: só com o consentimento do cliente (ou, no repositório, na lista de bancos permitidos e local)
    if (!CONFIG.consentOriginal) throw new Error('Recusado: rodar no banco original do app exige o consentimento do cliente, dado na IDE.')
    const app = dbOf(bancoDoApp())
    if (teste.host !== app.host || teste.db !== app.db) {
      throw new Error(`Recusado: o app exportado usa o banco "${app.db}" em ${app.host}, mas o banco de teste configurado é "${teste.db}" em ${teste.host}. Eles precisam ser o mesmo.`)
    }
    if (!CONFIG.allowRemote && !LOCAIS.includes(teste.host)) throw new Error(`Recusado: o banco de teste está em ${teste.host}, que não é esta máquina, e não há consentimento do cliente para banco remoto.`)
  }
  const permitidos = CONFIG.allowedDbs.length > 0 ? CONFIG.allowedDbs : [teste.db]
  if (!permitidos.includes(teste.db)) throw new Error(`Recusado: o banco "${teste.db}" está fora da lista permitida (${permitidos.join(', ')}).`)
}

/** Tabelas que os casos de uso leem ou gravam (a do caso de uso, as abas de detalhe e os subdetalhes). */
export function tabelasDoManifesto(m: TestManifest): string[] {
  const set = new Set<string>()
  for (const v of m.views) {
    if (v.table) set.add(v.table)
    for (const d of v.details) { set.add(d.table); for (const s of d.subDetails) set.add(s.table) }
  }
  return [...set].filter(t => IDENT.test(t)).sort()
}

export type Impressao = Record<string, { linhas: number; resumo: string }>

/** Quantidade de linhas e um resumo (md5) de todo o conteúdo de cada tabela; em tabelas enormes, só a quantidade. */
export async function impressaoDigital(tabelas: string[]): Promise<Impressao> {
  const out: Impressao = {}
  for (const t of tabelas) {
    const [r] = await consultar(`select count(*)::int as n from "${t}"`).catch(() => [{ n: -1 }])
    if (r.n < 0) { out[t] = { linhas: -1, resumo: 'tabela inexistente' }; continue }
    let resumo = ''
    if (r.n <= LIMITE_RESUMO) resumo = String((await consultar(`select coalesce(md5(string_agg(x::text, ',' order by x::text)), '') as h from "${t}" x`))[0].h)
    out[t] = { linhas: r.n, resumo }
  }
  return out
}

export function diferencas(antes: Impressao, depois: Impressao): string[] {
  const difs: string[] = []
  for (const t of Object.keys(antes)) {
    const a = antes[t], d = depois[t]
    if (a.linhas !== d?.linhas) difs.push(`${t}: ${a.linhas} → ${d?.linhas} linhas`)
    else if (a.resumo !== d?.resumo) difs.push(`${t}: o conteúdo de linhas existentes foi alterado`)
  }
  return difs
}

export const arquivoBase = (): string => path.join(import.meta.dirname, '..', '..', 'test-results-dynamic', 'baseline.json')
