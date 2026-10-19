import { CONFIG } from './config'
import { abrirBanco, tipoDoBanco } from './banco.mjs'

export type Banco = Awaited<ReturnType<typeof abrirBanco>>

/** Abre o banco de teste (Postgres ou Oracle, pela URL da configuração), roda a função e fecha. */
export async function comBanco<T>(fn: (d: Banco) => Promise<T>): Promise<T> {
  const d = await abrirBanco(CONFIG.dbUrl)
  try { return await fn(d) } finally { await d.fechar() }
}

/** Consulta o banco de teste. O SQL é escrito do jeito do Postgres; no Oracle o adaptador o traduz (banco.mjs). As linhas voltam com as colunas em minúsculas. */
export async function consultar<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return comBanco(d => d.query(sql, params) as Promise<T[]>)
}

export const dialeto = (): 'postgres' | 'oracle' | null => tipoDoBanco(CONFIG.dbUrl)

/** Nome do campo no HTML do app exportado: o Oracle usa as colunas em MAIÚSCULAS (NOME_EMPRESA), o Postgres como estão. */
export const nomeDoCampo = (coluna: string): string => (dialeto() === 'oracle' ? coluna.toUpperCase() : coluna)
/** Nome do campo de filtro: o sufixo _filter é sempre minúsculo (NOME_EMPRESA_filter). */
export const nomeDoFiltro = (coluna: string): string => `${nomeDoCampo(coluna)}_filter`
