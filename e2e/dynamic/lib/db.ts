import pg from 'pg'
import { CONFIG } from './config'

/** Consulta o banco de teste (uma conexão por consulta: simples e sem estado). Só as regras de leitura e a trava de segurança usam isto. */
export async function consultar<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: CONFIG.dbUrl })
  await c.connect()
  try { return (await c.query(sql, params)).rows as T[] } finally { await c.end() }
}
