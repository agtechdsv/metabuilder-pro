import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

/**
 * Modo "banco real": os testes rodam no app exportado de verdade, apontando para o banco do dia a dia (crm).
 * Regras de segurança (valem para toda a pasta real/):
 *  - só roda com E2E_REAL=1 (vem de e2e/.env.real, criado por `npm run real:robot`);
 *  - o banco do app exportado e o da conexão de verificação têm de estar na lista E2E_REAL_ALLOWED_DBS e ser localhost;
 *  - nada é apagado ou alterado fora do que o próprio teste criou: tudo leva o prefixo PREFIXO ("E2E-"), a limpeza só apaga linhas com ele
 *    e, no fim, a contagem de linhas SEM o prefixo precisa ser a mesma do início (senão a rodada falha e avisa).
 */
export const PREFIXO = 'E2E-'

const envFile = path.join(import.meta.dirname, '..', '.env.real')

export function loadRealEnv(): Record<string, string> {
  const raw = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes('=') || line.startsWith('#')) continue
    out[line.slice(0, line.indexOf('='))] = line.slice(line.indexOf('=') + 1)
  }
  return out
}

const fileEnv = loadRealEnv()
const val = (k: string, d = '') => process.env[k] ?? fileEnv[k] ?? d

export const REAL = {
  flag: val('E2E_REAL'),
  user: val('E2E_REAL_USER'),
  password: val('E2E_REAL_PASSWORD'),
  userFunc: val('E2E_REAL_USER_FUNC'),
  passwordFunc: val('E2E_REAL_PASSWORD_FUNC'),
  pgUrl: val('E2E_REAL_PG_URL'),
  allowedDbs: val('E2E_REAL_ALLOWED_DBS', 'crm').split(',').map(s => s.trim()).filter(Boolean),
  appDir: val('E2E_REAL_APP_DIR', 'C:\\AgTech\\Apps\\e2e-vendas-pg'),
  port: Number(val('E2E_REAL_PORT', '3102')),
}

/** Lê DATABASE_URL do .env.local do app exportado. */
function appDatabaseUrl(): string {
  const f = path.join(REAL.appDir, '.env.local')
  if (!fs.existsSync(f)) throw new Error(`Não achei ${f}. Ejete o projeto Vendas PG para ${REAL.appDir} (IDE > Ejetar para uma pasta) e rode: npm run real:prepare`)
  const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(fs.readFileSync(f, 'utf8'))
  if (!m) throw new Error('DATABASE_URL não encontrado no .env.local do app exportado.')
  return m[1]
}

function dbOf(url: string) {
  const u = new URL(url)
  return { host: u.hostname, db: u.pathname.replace(/^\//, '') }
}

/** Recusa rodar se algo não bater com as regras acima. */
export function assertSeguro() {
  if (REAL.flag !== '1') throw new Error('Modo banco real desligado: rode `npm run real:robot` (cria e2e/.env.real com E2E_REAL=1).')
  if (!REAL.user || !REAL.password) throw new Error('Faltam E2E_REAL_USER / E2E_REAL_PASSWORD em e2e/.env.real.')
  for (const [nome, url] of [['conexão de verificação (E2E_REAL_PG_URL)', REAL.pgUrl], ['banco do app exportado (DATABASE_URL)', appDatabaseUrl()]] as const) {
    const { host, db } = dbOf(url)
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`Recusado: ${nome} aponta para ${host}, que não é a máquina local.`)
    if (!REAL.allowedDbs.includes(db)) throw new Error(`Recusado: ${nome} usa o banco "${db}", fora da lista permitida (${REAL.allowedDbs.join(', ')}).`)
  }
}

export async function realQuery<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: REAL.pgUrl })
  await c.connect()
  try { return (await c.query(sql, params)).rows as T[] } finally { await c.end() }
}

/** Linhas que NÃO são do teste, por tabela: precisam ser as mesmas antes e depois da rodada. */
export async function contagemOriginal(): Promise<Record<string, number>> {
  const q = async (sql: string) => Number((await realQuery(sql))[0].n)
  return {
    clientes: await q(`select count(*) n from clientes where nome_empresa not like '${PREFIXO}%'`),
    pedidos: await q(`select count(*) n from pedidos where cliente_id is null or cliente_id not in (select id from clientes where nome_empresa like '${PREFIXO}%')`),
    itens_pedido: await q(`select count(*) n from itens_pedido where pedido_id is null or pedido_id not in (select id from pedidos where cliente_id in (select id from clientes where nome_empresa like '${PREFIXO}%'))`),
    produtos: await q(`select count(*) n from produtos where nome not like '${PREFIXO}%'`),
    departamentos: await q(`select count(*) n from departamentos where nome not like '${PREFIXO}%'`),
    funcionarios: await q(`select count(*) n from funcionarios where nome not like '${PREFIXO}%'`),
    usuarios: await q(`select count(*) n from usuarios where email not like 'e2e_robo%'`),
  }
}

/** Apaga só o que o teste criou (clientes com o prefixo e o que pendura neles), na ordem das chaves estrangeiras. */
export async function limparTeste(prefixo = PREFIXO) {
  const like = prefixo + '%'
  await realQuery(`delete from itens_pedido where pedido_id in (select id from pedidos where cliente_id in (select id from clientes where nome_empresa like $1))`, [like])
  await realQuery(`delete from pedidos where cliente_id in (select id from clientes where nome_empresa like $1)`, [like])
  await realQuery(`delete from clientes where nome_empresa like $1`, [like])
  await realQuery(`delete from funcionarios where nome like $1`, [like])
  await realQuery(`delete from departamentos where nome like $1`, [like])
  await realQuery(`delete from produtos where nome like $1`, [like])
}
