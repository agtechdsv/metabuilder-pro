import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

/**
 * Modo "banco real" do Oracle: os testes rodam no app EXPORTADO (Node + Oracle) apontando para o banco do dia a dia (schema crm).
 * Mesmas travas da pasta real/ (Postgres):
 *  - só roda com E2E_ORA=1 (vem de e2e/.env.oracle, criado por `npm run ora:robot`);
 *  - o servidor do Oracle precisa ser desta máquina (o Oracle escuta no IP da placa de rede, não em localhost), o usuário e o serviço
 *    têm de estar nas listas E2E_ORA_ALLOWED_USERS / E2E_ORA_ALLOWED_SERVICES;
 *  - tudo o que o teste cria leva o prefixo PREFIXO ("E2E-"); a limpeza só apaga linhas com ele e, no fim, a contagem de linhas SEM o
 *    prefixo precisa ser a mesma do início (senão a rodada falha e avisa).
 * A conexão vem do .env.local do próprio app ejetado (DB_CONNECTION_STRING, DB_USER, DB_PASSWORD): nada de senha em arquivo do teste.
 */
export const PREFIXO = 'E2E-'

const envFile = path.join(import.meta.dirname, '..', '.env.oracle')

export function loadOraEnv(): Record<string, string> {
  const raw = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes('=') || line.startsWith('#')) continue
    out[line.slice(0, line.indexOf('='))] = line.slice(line.indexOf('=') + 1)
  }
  return out
}

const fileEnv = loadOraEnv()
const val = (k: string, d = '') => process.env[k] ?? fileEnv[k] ?? d

export const ORA = {
  flag: val('E2E_ORA'),
  user: val('E2E_ORA_USER'),
  password: val('E2E_ORA_PASSWORD'),
  userFunc: val('E2E_ORA_USER_FUNC'),
  passwordFunc: val('E2E_ORA_PASSWORD_FUNC'),
  userLeitura: val('E2E_ORA_USER_LEITURA'),
  passwordLeitura: val('E2E_ORA_PASSWORD_LEITURA'),
  allowedUsers: val('E2E_ORA_ALLOWED_USERS', 'crm').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  allowedServices: val('E2E_ORA_ALLOWED_SERVICES', 'FREEPDB1').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
  appDir: val('E2E_ORA_APP_DIR', 'C:\\Users\\Alexandre\\Downloads\\Vendas_ORA_Node'),
  port: Number(val('E2E_ORA_PORT', '3103')),
}

export const GRUPO_LEITURA_ID = 'e2e00000-0000-4000-8000-0000000000e1'
export const PERFIL_ADMIN_ID = '11111111-1111-4111-8111-111111111111'
export const PERFIL_FUNC_ID = '33333333-3333-4333-8333-333333333333'

/** Conexão do app ejetado (.env.local). */
export function appConexao() {
  const f = path.join(ORA.appDir, '.env.local')
  if (!fs.existsSync(f)) throw new Error(`Não achei ${f}. Ejete o projeto Vendas ORA para ${ORA.appDir} (IDE > Ejetar para uma pasta) e rode: npm run ora:prepare`)
  const env: Record<string, string> = {}
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  const cs = env.DB_CONNECTION_STRING || ''
  const m = /^(?:\/\/)?([^:/]+)(?::(\d+))?\/(.+)$/.exec(cs)
  if (!m) throw new Error('DB_CONNECTION_STRING do app ejetado não está no formato host:porta/servico.')
  return { connectString: cs, host: m[1], service: m[3], user: env.DB_USER || '', password: env.DB_PASSWORD || '' }
}

const enderecosDestaMaquina = () => new Set(['localhost', '127.0.0.1', '::1', os.hostname().toLowerCase(), ...Object.values(os.networkInterfaces()).flatMap(l => (l || []).map(i => i.address.toLowerCase()))])

/** Recusa rodar se algo não bater com as regras acima. */
export function assertSeguro() {
  if (ORA.flag !== '1') throw new Error('Modo Oracle desligado: rode `npm run ora:robot` (cria e2e/.env.oracle com E2E_ORA=1).')
  if (!ORA.user || !ORA.password) throw new Error('Faltam E2E_ORA_USER / E2E_ORA_PASSWORD em e2e/.env.oracle.')
  const c = appConexao()
  if (!enderecosDestaMaquina().has(c.host.toLowerCase())) throw new Error(`Recusado: o Oracle do app ejetado está em ${c.host}, que não é desta máquina.`)
  if (!ORA.allowedServices.includes(c.service.toUpperCase())) throw new Error(`Recusado: serviço "${c.service}" fora da lista permitida (${ORA.allowedServices.join(', ')}).`)
  if (!ORA.allowedUsers.includes(c.user.toLowerCase())) throw new Error(`Recusado: usuário "${c.user}" do banco fora da lista permitida (${ORA.allowedUsers.join(', ')}).`)
}

let driver: any
function oracledb() {
  if (!driver) {
    const req = createRequire(path.join(ORA.appDir, 'package.json'))
    driver = req('oracledb')
    driver.fetchAsString = [driver.CLOB]
  }
  return driver
}

/** SQL do Oracle com binds por posição (:1, :2). Devolve as linhas com as colunas em minúsculas. Grava na hora (autoCommit). */
export async function oraQuery<T = any>(sql: string, binds: unknown[] = []): Promise<T[]> {
  const db = oracledb()
  const c = appConexao()
  const conn = await db.getConnection({ user: c.user, password: c.password, connectString: c.connectString })
  try {
    // :1, :2... podem se repetir no SQL (como $1 no Postgres); o Oracle pede um valor por ocorrência, então vira bind nomeado
    const nomeados: Record<string, unknown> = {}
    // só fora de literais entre aspas ('12:00:00' não é bind)
    const texto = sql.split(/('(?:[^']|'')*')/).map((parte, i) => i % 2 === 1 ? parte : parte.replace(/:(\d+)/g, (_m, n) => { nomeados['b' + n] = binds[Number(n) - 1]; return ':b' + n })).join('')
    const r = await conn.execute(texto, nomeados, { outFormat: db.OUT_FORMAT_OBJECT, autoCommit: true })
    return (r.rows || []).map((row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))) as T[]
  } finally { await conn.close() }
}

export const novoId = () => crypto.randomUUID()

/**
 * Os mesmos specs do Postgres rodam aqui: este tradutor converte as poucas construções do Postgres usadas neles para o Oracle
 *   $1 -> :1 | gen_random_uuid() -> id gerado aqui | now() -> systimestamp | ::tipo -> (removido) | limit N -> fetch first N rows only
 *   'AAAA-MM-DD hh:mm:ss-03' -> to_timestamp_tz(...) | "returning id" -> devolve o id gerado aqui (precisa de gen_random_uuid() no insert)
 */
export async function realQuery<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  let s = sql.replace(/\$(\d+)/g, ':$1').replace(/::\w+/g, '').replace(/\bnow\(\)/gi, 'systimestamp')
  s = s.replace(/\blimit\s+(\d+)\s*$/i, 'fetch first $1 rows only')
  s = s.replace(/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[-+]\d{2})'/g, "to_timestamp_tz('$1', 'YYYY-MM-DD HH24:MI:SSTZH')")
  const ret = /\s+returning\s+(\w+)\s*$/i.exec(s)
  if (ret) {
    if (ret[1].toLowerCase() !== 'id' || !/gen_random_uuid\(\)/i.test(s)) throw new Error('returning só é suportado como "returning id" com gen_random_uuid() no insert')
    const id = crypto.randomUUID()
    await oraQuery(s.slice(0, ret.index).replace(/gen_random_uuid\(\)/i, `'${id}'`).replace(/gen_random_uuid\(\)/gi, 'lower(rawtohex(sys_guid()))'), params)
    return [{ id } as T]
  }
  s = s.replace(/gen_random_uuid\(\)/gi, 'lower(rawtohex(sys_guid()))')
  return oraQuery<T>(s, params)
}

/** Mesmo formato do REAL do Postgres, para os specs compartilhados. */
export const REAL = { user: ORA.user, password: ORA.password, userFunc: ORA.userFunc, passwordFunc: ORA.passwordFunc, userLeitura: ORA.userLeitura, passwordLeitura: ORA.passwordLeitura, appDir: ORA.appDir, port: ORA.port }

/** Linhas que NÃO são do teste, por tabela: precisam ser as mesmas antes e depois da rodada. */
export async function contagemOriginal(): Promise<Record<string, number | string>> {
  const q = async (sql: string) => Number((await oraQuery(sql))[0].n)
  // Impressão digital das ligações (chaves estrangeiras) das linhas que NÃO são do teste: contar linhas não percebe quando uma linha real é
  // RELIGADA a outra (ex.: funcionário movido de departamento por um app que gravou a tela inteira). Qualquer mudança nelas derruba a rodada.
  const fp = async (tabela: string, cols: string[], onde: string) =>
    String((await oraQuery(`select nvl(sum(ora_hash(${cols.map(c => `nvl(to_char(t.${c}), '-')`).join(" || '|' || ")})), 0) h from ${tabela} t where ${onde}`))[0].h)
  const cliE2E = `select id from clientes where nome_empresa like '${PREFIXO}%'`
  const pedE2E = `select id from pedidos where cliente_id in (${cliE2E})`
  return {
    clientes: await q(`select count(*) n from clientes where nome_empresa not like '${PREFIXO}%'`),
    pedidos: await q(`select count(*) n from pedidos where cliente_id is null or cliente_id not in (${cliE2E})`),
    itens_pedido: await q(`select count(*) n from itens_pedido where pedido_id is null or pedido_id not in (${pedE2E})`),
    produtos: await q(`select count(*) n from produtos where nome not like '${PREFIXO}%'`),
    departamentos: await q(`select count(*) n from departamentos where nome not like '${PREFIXO}%'`),
    funcionarios: await q(`select count(*) n from funcionarios where nome not like '${PREFIXO}%'`),
    projetos: await q(`select count(*) n from projetos where nome not like '${PREFIXO}%'`),
    tarefas: await q(`select count(*) n from tarefas where titulo not like '${PREFIXO}%'`),
    entregas: await q(`select count(*) n from entregas where pedido_id is null or pedido_id not in (${pedE2E})`),
    usuarios: await q(`select count(*) n from usuarios where email not like 'e2e_robo%'`),
    // grupos e permissões que NÃO são dos testes (os grupos de verdade, quem está neles e as permissões deles)
    perfis: await q(`select count(*) n from perfis where nome not like 'E2E-%'`),
    perfis_usuarios: await q(`select count(*) n from perfis_usuarios where perfil_id in (select id from perfis where nome not like 'E2E-%') and usuario_id in (select id from usuarios where email not like 'e2e_robo%')`),
    permissoes: await q(`select count(*) n from mb_role_permissions where role_id in (select id from perfis where nome not like 'E2E-%')`),
    fp_clientes: await fp('clientes', ['id', 'nome_empresa'], `nome_empresa not like '${PREFIXO}%'`),
    fp_pedidos: await fp('pedidos', ['id', 'cliente_id', 'funcionario_id', 'status'], `cliente_id is null or cliente_id not in (${cliE2E})`),
    fp_itens_pedido: await fp('itens_pedido', ['id', 'pedido_id', 'produto_id'], `pedido_id is null or pedido_id not in (${pedE2E})`),
    fp_produtos: await fp('produtos', ['id', 'categoria_id', 'nome'], `nome not like '${PREFIXO}%'`),
    fp_departamentos: await fp('departamentos', ['id', 'nome'], `nome not like '${PREFIXO}%'`),
    fp_funcionarios: await fp('funcionarios', ['id', 'nome', 'departamento_id'], `nome not like '${PREFIXO}%'`),
    fp_projetos: await fp('projetos', ['id', 'nome', 'cliente_id', 'gerente_id'], `nome not like '${PREFIXO}%'`),
    fp_tarefas: await fp('tarefas', ['id', 'titulo', 'projeto_id', 'responsavel_id', 'tarefa_antecessora_id'], `titulo not like '${PREFIXO}%'`),
    fp_entregas: await fp('entregas', ['id', 'pedido_id', 'motorista_id'], `pedido_id is null or pedido_id not in (${pedE2E})`),
  }
}

/** Apaga só o que o teste criou (nomes com o prefixo e o que pendura neles), na ordem das chaves estrangeiras. */
export async function limparTeste(prefixo = PREFIXO) {
  const like = prefixo + '%'
  const cliE2E = `select id from clientes where nome_empresa like :1`
  const pedE2E = `select id from pedidos where cliente_id in (${cliE2E})`
  const funE2E = `select id from funcionarios where nome like :1`
  const proE2E = `select id from projetos where nome like :1 or cliente_id in (${cliE2E}) or gerente_id in (${funE2E})`
  const tarE2E = `select id from tarefas where titulo like :1 or projeto_id in (${proE2E}) or responsavel_id in (${funE2E})`
  await oraQuery(`delete from entregas where pedido_id in (${pedE2E}) or motorista_id in (${funE2E})`, [like])
  await oraQuery(`delete from itens_pedido where pedido_id in (${pedE2E}) or produto_id in (select id from produtos where nome like :1)`, [like])
  await oraQuery(`delete from pedidos where cliente_id in (${cliE2E}) or funcionario_id in (${funE2E})`, [like])
  await oraQuery(`update tarefas set tarefa_antecessora_id = null where tarefa_antecessora_id in (${tarE2E})`, [like])
  await oraQuery(`delete from tarefas where id in (${tarE2E})`, [like])
  await oraQuery(`delete from projetos where id in (${proE2E})`, [like])
  await oraQuery(`delete from clientes where nome_empresa like :1`, [like])
  await oraQuery(`delete from funcionarios where nome like :1`, [like])
  await oraQuery(`delete from departamentos where nome like :1`, [like])
  // usuários criados pelos testes da gestão de acesso (e-mail e2e_robo_tmp*) e a duplicata de teste do e-mail repetido
  await oraQuery(`delete from perfis_usuarios where usuario_id in (select id from usuarios where email like 'e2e_robo_tmp%' or nome_completo = 'E2E Repetido')`)
  await oraQuery(`delete from usuarios where email like 'e2e_robo_tmp%' or nome_completo = 'E2E Repetido'`)
  // grupos temporários dos testes (nome E2E-Tmp*) e o que pendura neles
  await oraQuery(`delete from perfis_usuarios where perfil_id in (select id from perfis where nome like 'E2E-Tmp%')`)
  await oraQuery(`delete from mb_role_permissions where role_id in (select id from perfis where nome like 'E2E-Tmp%')`)
  await oraQuery(`delete from perfis where nome like 'E2E-Tmp%'`)
  await restaurarPermissoesLeitura()
  await oraQuery(`delete from produtos where nome like :1`, [like])
}

/** O grupo fixo de teste E2E-Leitura volta às permissões de partida (Clientes só leitura, Departamentos bloqueado). */
export async function restaurarPermissoesLeitura() {
  const existe = await oraQuery('select 1 from perfis where id = :1', [GRUPO_LEITURA_ID])
  if (existe.length === 0) return
  await oraQuery('delete from mb_role_permissions where role_id = :1', [GRUPO_LEITURA_ID])
  for (const [slug, nivel] of [['clientes', 'read'], ['departamentos', 'none']]) {
    await oraQuery('insert into mb_role_permissions (role_id, view_slug, access_level) values (:1, :2, :3)', [GRUPO_LEITURA_ID, slug, nivel])
  }
}
