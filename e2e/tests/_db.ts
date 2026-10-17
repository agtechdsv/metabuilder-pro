import pg from 'pg'
import { E2E_PG_URL } from '../scripts/seed-postgres.mjs'

/** Consulta direta ao banco de testes: para conferir o que foi gravado e limpar o que o teste criou. */
export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: E2E_PG_URL })
  await c.connect()
  try { return (await c.query(sql, params)).rows as T[] } finally { await c.end() }
}

/** Apaga o cliente de teste e tudo o que pendura nele (contatos, itens e pedidos). */
export async function apagarCliente(nome: string) {
  await query('DELETE FROM itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id IN (SELECT id FROM clientes WHERE nome_empresa = $1))', [nome])
  await query('DELETE FROM pedidos WHERE cliente_id IN (SELECT id FROM clientes WHERE nome_empresa = $1)', [nome])
  await query('DELETE FROM contatos WHERE cliente_id IN (SELECT id FROM clientes WHERE nome_empresa = $1)', [nome])
  await query('DELETE FROM clientes WHERE nome_empresa = $1', [nome])
}
