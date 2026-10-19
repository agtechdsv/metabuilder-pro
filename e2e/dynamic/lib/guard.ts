import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CONFIG } from './config'
import { comBanco } from './db'
import { bancoDoApp, detectarApp } from './app.mjs'
import { lerUrl, tipoDoBanco } from './banco.mjs'
import type { TestManifest } from '../../../src/lib/testing/manifestTypes'
import { campoMarcador, PREFIXO_E2E } from '../../../src/lib/testing/plan'

/**
 * Trava de segurança do motor dinâmico, para qualquer projeto e banco (Postgres ou Oracle; não conhece tabelas de antemão):
 *  1. antes de começar: o banco de teste tem de ser uma cópia que o cliente confirmou, ou o banco original com o consentimento dele; o motor injeta esta conexão no app, então o app e a conferência usam o mesmo banco;
 *  2. durante: o motor só lê; a única regra que poderia gravar (salvar o formulário vazio) apaga o que criou e falha;
 *  3. no fim: a "impressão digital" de cada tabela dos casos de uso (quantidade de linhas e um resumo de todo o conteúdo) tem de ser a mesma do início.
 */

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const LIMITE_RESUMO = 200_000

/** Endereços desta máquina (o Oracle escuta no IP da placa de rede, não em localhost). */
const enderecosDestaMaquina = () => new Set(['localhost', '127.0.0.1', '::1', os.hostname().toLowerCase(), ...Object.values(os.networkInterfaces()).flatMap(l => (l || []).map(i => i.address.toLowerCase()))])

export function assertSeguro() {
  const app = detectarApp(CONFIG.appDir)
  if (!CONFIG.appDir || !fs.existsSync(path.join(app.frontendDir, 'package.json'))) throw new Error(`Não achei o app exportado em "${CONFIG.appDir}".`)
  if (!CONFIG.dbUrl) throw new Error('Falta a conexão com o banco de teste (dbUrl).')
  const tipo = tipoDoBanco(CONFIG.dbUrl)
  if (!tipo) throw new Error(`O banco "${CONFIG.dbUrl.split(':')[0]}" ainda não é suportado pelos testes automáticos (só PostgreSQL e Oracle).`)
  if (!CONFIG.noAuth && (!CONFIG.user || !CONFIG.password)) throw new Error('Falta o usuário de teste do app (a IDE o cria no banco de teste).')
  const teste = lerUrl(CONFIG.dbUrl)
  if (CONFIG.mode === 'copy') {
    // cópia informada pelo cliente: pode estar em qualquer lugar, mas só vale se ele confirmou que é uma cópia (o motor injeta esta conexão no app)
    if (!CONFIG.copyConfirmed) throw new Error('Recusado: falta a confirmação de que o banco informado é uma cópia de teste (não o banco de produção).')
  } else {
    // banco original do app: só com o consentimento do cliente (ou, no repositório, na lista de bancos permitidos e local)
    if (!CONFIG.consentOriginal) throw new Error('Recusado: rodar no banco original do app exige o consentimento do cliente, dado na IDE.')
    const doApp = bancoDoApp(app)
    if (!doApp) throw new Error('Não consegui descobrir qual banco o app exportado usa (DATABASE_URL, DB_CONNECTION_STRING ou application.properties).')
    const mesmo = doApp.host.toLowerCase() === teste.host.toLowerCase() && doApp.banco.toLowerCase() === teste.banco.toLowerCase() && doApp.tipo === tipo
    if (!mesmo) throw new Error(`Recusado: o app exportado usa o banco "${doApp.banco}" em ${doApp.host}, mas o banco de teste configurado é "${teste.banco}" em ${teste.host}. Eles precisam ser o mesmo.`)
    if (!CONFIG.allowRemote && !enderecosDestaMaquina().has(teste.host.toLowerCase())) throw new Error(`Recusado: o banco de teste está em ${teste.host}, que não é esta máquina, e não há consentimento do cliente para banco remoto.`)
  }
  const permitidos = (CONFIG.allowedDbs.length > 0 ? CONFIG.allowedDbs : [teste.banco]).map(b => b.toLowerCase())
  if (!permitidos.includes(teste.banco.toLowerCase())) throw new Error(`Recusado: o banco "${teste.banco}" está fora da lista permitida (${permitidos.join(', ')}).`)
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

/** Quantidade de linhas e um resumo de todo o conteúdo de cada tabela (md5 no Postgres, soma de hashes no Oracle); em tabelas enormes, só a quantidade. */
export async function impressaoDigital(tabelas: string[]): Promise<Impressao> {
  return comBanco(async d => {
    const out: Impressao = {}
    for (const t of tabelas) {
      let n = -1
      try { n = Number((await d.query(`select count(*) as n from "${t}"`))[0].n) } catch { /* tabela inexistente */ }
      if (n < 0) { out[t] = { linhas: -1, resumo: 'tabela inexistente' }; continue }
      let resumo = ''
      if (n <= LIMITE_RESUMO) {
        if (d.dialect === 'oracle') {
          // um hash por coluna (CLOB: os primeiros 1000 caracteres; RAW: hexadecimal; BLOB fica de fora), cada um com um peso diferente conforme a posição da coluna; a soma de todas as linhas é o resumo.
          // Nada de concatenar as colunas numa expressão só: ela estoura o limite de texto do Oracle (ORA-01489) em tabelas largas.
          const cols = (await d.colunas(t)).filter((c: any) => !/blob|^long|xmltype|bfile/.test(c.data_type))
          const parte = (c: any, i: number) => {
            const id = d.ident(c.column_name)
            const texto = /clob/.test(c.data_type) ? `nvl(dbms_lob.substr(${id}, 1000, 1), '-')` : /^raw/.test(c.data_type) ? `nvl(rawtohex(${id}), '-')` : `nvl(to_char(${id}), '-')`
            return `ora_hash(${texto}) * ${2 * i + 3}`
          }
          resumo = cols.length ? String((await d.query(`select nvl(sum(${cols.map(parte).join(' + ')}), 0) as h from "${t}"`))[0].h) : ''
        } else {
          resumo = String((await d.query(`select coalesce(md5(string_agg(x::text, ',' order by x::text)), '') as h from "${t}" x`))[0].h)
        }
      }
      out[t] = { linhas: n, resumo }
    }
    return out
  })
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

/** Onde o teste de integração pode ter deixado linhas: (tabela, coluna de identificação) dos casos de uso Pesquisa + Cadastro. */
export function alvosDeLimpeza(m: TestManifest): Array<{ tabela: string; coluna: string }> {
  const out: Array<{ tabela: string; coluna: string }> = []
  for (const v of m.views) {
    const c = v.logicType === 'pesquisa_cadastro' ? campoMarcador(v) : undefined
    if (c && IDENT.test(v.table) && IDENT.test(c.column) && !out.some(o => o.tabela === v.table && o.coluna === c.column)) out.push({ tabela: v.table, coluna: c.column })
  }
  return out
}

/**
 * Apaga as linhas geradas pelo teste de integração (texto que começa com "E2E-" na coluna de identificação): sobras de uma rodada interrompida ou de uma falha no meio.
 * Dá algumas passadas porque uma linha pode depender de outra (chave estrangeira): o erro da primeira tentativa some quando a dependente já foi apagada.
 */
export async function limparSobras(alvos: Array<{ tabela: string; coluna: string }>) {
  await comBanco(async d => {
    for (let passada = 0; passada < 3; passada++) {
      for (const { tabela, coluna } of alvos) {
        await d.query(`delete from "${tabela}" where "${coluna}"::text like $1`, [PREFIXO_E2E + '%']).catch(() => {})
      }
    }
  })
}
