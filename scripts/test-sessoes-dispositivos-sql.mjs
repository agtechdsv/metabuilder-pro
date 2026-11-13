// Teste do SQL das vagas de sessao: roda scripts/sessoes-dispositivos.sql num banco descartavel do PostgreSQL local (E2E_PG_ADMIN, padrao crm:crm@localhost:5432) e confere as funcoes.
// Uso: node scripts/test-sessoes-dispositivos-sql.mjs   (cria e apaga o banco mb_slots_scratch e os papeis anon/authenticated/service_role se nao existirem)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../package.json', import.meta.url))
const { Client } = require('pg')

const ADMIN = process.env.E2E_PG_ADMIN || 'postgresql://crm:crm@localhost:5432/postgres'
const DB = 'mb_slots_scratch'
const sqlFile = fs.readFileSync(new URL('./sessoes-dispositivos.sql', import.meta.url), 'utf8')

const admin = new Client({ connectionString: ADMIN })
await admin.connect()
await admin.query(`drop database if exists ${DB}`)
await admin.query(`create database ${DB}`)

const url = new URL(ADMIN); url.pathname = '/' + DB
const db = new Client({ connectionString: url.toString() })
await db.connect()

let passed = 0
let createdRoles = []
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ok -', msg) }
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); passed++; console.log('  ok -', msg) }

try {
  // stubs do que o Supabase já tem
  await db.query(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
    create table public.profiles (id uuid primary key, is_super_admin boolean default false);
    create table public.platform_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid);
  `)
  let withRoles = true
  const existing = (await admin.query(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role')`)).rows.map(r => r.rolname)
  createdRoles = ['anon', 'authenticated', 'service_role'].filter(r => !existing.includes(r))
  try {
    await db.query(`do $b$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    end $b$;`)
  } catch (e) { withRoles = false; console.log('  (sem permissão para criar papéis; o script roda sem as linhas de revoke/grant)', e.message) }

  let script = sqlFile
  if (!withRoles) script = script.split('\n').filter(l => !/^(revoke|grant)\b/.test(l.trim())).join('\n')
  await db.query(script)
  console.log('script executado sem erro (' + (withRoles ? 'com' : 'sem') + ' papéis)')
  await db.query(script) // idempotente: rodar de novo não pode falhar
  ok(true, 'o script pode ser rodado duas vezes')

  const mk = async (admin = false) => { const { rows } = await db.query(`insert into auth.users default values returning id`); await db.query('insert into public.profiles (id, is_super_admin) values ($1,$2)', [rows[0].id, admin]); return rows[0].id }
  const uuid = async () => (await db.query('select gen_random_uuid() u')).rows[0].u
  const claim = async (u, kind, dev, sess) => (await db.query('select public.mb_claim_device_slot($1,$2,$3,$4,$5,$6,$7,$8,$9) r', [u, kind, dev, sess, 'Chrome · Windows', 'Belo Horizonte', 'MG', 'BR', 'hash'])).rows[0].r
  const take = async (u, kind, dev, sess, confirmed = false) => (await db.query('select public.mb_take_over_slot($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r', [u, kind, dev, sess, 'Firefox · Linux', 'São Paulo', 'SP', 'BR', 'hash2', confirmed])).rows[0].r
  const setMode = (m) => db.query(`update public.platform_settings set value = jsonb_build_object('mode', $1::text) where key = 'device_slot_mode'`, [m])
  const events = async (u, ev) => (await db.query('select count(*)::int n from public.mb_device_events where user_id=$1 and event=$2', [u, ev])).rows[0].n

  console.log('\nmodo desligado')
  const u0 = await mk()
  eq((await claim(u0, 'web', 'devA', await uuid())).status, 'off', 'desligado: não registra nada')
  eq((await db.query('select count(*)::int n from public.mb_device_sessions')).rows[0].n, 0, 'desligado: nenhuma linha gravada')

  console.log('\nmodo valer')
  await setMode('enforce')
  const u1 = await mk()
  const [s1, s2, s3] = [await uuid(), await uuid(), await uuid()]
  eq((await claim(u1, 'web', 'devA', s1)).status, 'claimed', 'primeira sessão web ocupa a vaga')
  eq((await claim(u1, 'web', 'devA', s1)).status, 'ok', 'a mesma sessão só renova')
  const occ = await claim(u1, 'web', 'devB', s2)
  eq(occ.status, 'occupied', 'segunda máquina web: vaga ocupada')
  eq(occ.other.device_id, 'devA', 'a resposta traz a sessão que ocupa a vaga')
  eq(occ.other.city, 'Belo Horizonte', 'com a cidade dela')
  eq((await claim(u1, 'ide', 'devA', s3)).status, 'claimed', 'IDE na mesma máquina tem vaga própria')
  eq((await claim(u1, 'ide', 'devA', s3)).status, 'ok', 'IDE renova')

  console.log('\ntroca')
  const t1 = await take(u1, 'web', 'devB', s2)
  eq(t1.status, 'claimed', 'encerrar a outra e entrar aqui')
  eq(t1.kicked.device_id, 'devA', 'devolve a sessão derrubada (para o e-mail de aviso)')
  const rev = await claim(u1, 'web', 'devA', s1)
  eq(rev.status, 'revoked', 'a sessão derrubada descobre que foi encerrada')
  eq(rev.reason, 'replaced', 'com o motivo')
  eq(rev.by.device_id, 'devB', 'e quem tomou a vaga')
  eq((await claim(u1, 'web', 'devB', s2)).status, 'ok', 'a nova segue ativa')
  eq((await take(u1, 'web', 'devB', s2)).status, 'ok', 'trocar quando já é a dona não faz nada')

  console.log('\nmesma máquina entrando de novo')
  const s4 = await uuid()
  eq((await claim(u1, 'web', 'devB', s4)).status, 'claimed', 'novo login na mesma máquina substitui sem perguntar')
  eq((await claim(u1, 'web', 'devB', s2)).reason, 'same_device', 'a sessão anterior fica encerrada por same_device')

  console.log('\nlimite de trocas por dia (3)')
  // a troca "devB" lá em cima já foi a 1ª do dia
  for (const [i, d] of ['devC', 'devD'].entries()) {
    const r = await take(u1, 'web', d, await uuid())
    eq(r.status, 'claimed', `troca ${i + 2} do dia passa`)
  }
  const sCap = await uuid()
  const capped = await take(u1, 'web', 'devE', sCap)
  eq(capped.status, 'needs_code', 'a quarta troca do dia exige código')
  eq([capped.count, capped.cap], [3, 3], 'informa o contador e o limite')
  eq((await events(u1, 'cap_reached')), 1, 'registra o evento cap_reached')
  eq((await take(u1, 'web', 'devE', sCap, true)).status, 'claimed', 'com o código confirmado a troca passa')

  console.log('\nociosidade')
  await db.query(`update public.mb_device_sessions set last_seen_at = now() - interval '16 minutes' where user_id=$1 and kind='web' and revoked_at is null`, [u1])
  const sIdle = await uuid()
  eq((await claim(u1, 'web', 'devG', sIdle)).status, 'claimed', 'sessão ociosa há mais de 15 min libera a vaga')
  eq(await events(u1, 'idle_release'), 1, 'registra idle_release')

  console.log('\nSuperAdmin')
  const adm = await mk(true)
  eq((await claim(adm, 'web', 'devA', await uuid())).status, 'exempt', 'SuperAdmin não ocupa vaga')
  eq((await claim(adm, 'web', 'devB', await uuid())).status, 'exempt', 'nem conflita')

  console.log('\nmodo observar')
  await setMode('observe')
  const u2 = await mk()
  const [o1, o2] = [await uuid(), await uuid()]
  eq((await claim(u2, 'web', 'devA', o1)).status, 'claimed', 'observar: a primeira ocupa a vaga')
  const obs = await claim(u2, 'web', 'devB', o2)
  eq([obs.status, obs.would_block], ['ok', true], 'observar: segunda máquina passa, marcada como would_block')
  eq(await events(u2, 'conflict'), 1, 'e o conflito fica registrado')
  await claim(u2, 'web', 'devB', o2)
  eq(await events(u2, 'conflict'), 1, 'o mesmo conflito não é registrado de novo em 30 min')
  eq((await claim(u2, 'web', 'devA', o1)).status, 'ok', 'a primeira não foi derrubada')
  eq((await take(u2, 'web', 'devB', o2)).status, 'ok', 'trocar fora do modo valer não derruba ninguém')

  console.log('\nIDE vista como navegador antes do cookie de tipo existir')
  const u5 = await mk()
  const k1 = await uuid()
  eq((await claim(u5, 'web', 'devA', k1)).status, 'claimed', 'a IDE entra primeiro como navegador')
  eq((await claim(u5, 'ide', 'devA', k1)).status, 'ok', 'depois se identifica como IDE')
  eq((await db.query(`select kind from public.mb_device_sessions where auth_session_id=$1`, [k1])).rows[0].kind, 'ide', 'a sessão migra para a vaga da IDE')
  eq((await claim(u5, 'web', 'devB', await uuid())).status, 'claimed', 'e a vaga do navegador fica livre para o navegador de verdade')

  console.log('\ncookies de login copiados para outro dispositivo (mesma sessão, outro dispositivo)')
  const u6 = await mk()
  const c1 = await uuid()
  await claim(u6, 'web', 'devA', c1)
  eq((await claim(u6, 'web', 'devZ', c1)).status, 'ok', 'a mesma sessão em outro dispositivo passa (o Supabase barra a renovação do token)')
  eq(await events(u6, 'conflict'), 1, 'mas fica registrada como conflito para o SuperAdmin')
  await claim(u6, 'web', 'devZ', c1)
  eq(await events(u6, 'conflict'), 1, 'sem repetir o registro em 30 min')

  console.log('\nlogout e revogação')
  await setMode('enforce')
  const u3 = await mk()
  const l1 = await uuid()
  await claim(u3, 'ide', 'devA', l1)
  eq((await db.query(`select public.mb_release_device_slot($1,'logout') r`, [l1])).rows[0].r, true, 'logout libera a vaga')
  eq((await claim(u3, 'ide', 'devB', await uuid())).status, 'claimed', 'e outra máquina entra direto')
  const act = (await db.query(`select id from public.mb_device_sessions where user_id=$1 and revoked_at is null`, [u3])).rows[0].id
  eq((await db.query(`select public.mb_revoke_device_session($1,'admin') r`, [act])).rows[0].r, true, 'o SuperAdmin encerra uma sessão')
  eq((await db.query(`select public.mb_revoke_device_session($1,'admin') r`, [act])).rows[0].r, false, 'encerrar de novo não faz nada')
  let threw = false
  try { await db.query(`select public.mb_release_device_slot($1,'qualquer')`, [l1]) } catch { threw = true }
  ok(threw, 'motivo inválido é recusado')
  threw = false
  try { await claim(u3, 'tablet', 'devA', await uuid()) } catch { threw = true }
  ok(threw, 'tipo inválido é recusado')

  console.log('\nlimpeza')
  await db.query(`insert into auth.sessions (id, user_id) select auth_session_id, user_id from public.mb_device_sessions where revoked_at is not null`)
  await db.query(`update public.mb_device_sessions set revoked_at = now() - interval '20 minutes' where revoked_at is not null and revoked_reason in ('replaced','idle','admin','user')`)
  const before = (await db.query('select count(*)::int n from auth.sessions')).rows[0].n
  const purged = (await db.query('select public.mb_purge_revoked_auth_sessions(15) r')).rows[0].r
  ok(purged > 0, `apaga as sessões do Auth das vagas encerradas há mais de 15 min (${purged})`)
  eq((await db.query('select count(*)::int n from auth.sessions')).rows[0].n, before - (await db.query(`select count(*)::int n from public.mb_device_sessions where auth_deleted_at is not null`)).rows[0].n, 'as linhas do Auth sumiram')
  eq((await db.query('select public.mb_purge_revoked_auth_sessions(15) r')).rows[0].r, 0, 'rodar de novo não repete')
  await db.query(`update public.mb_device_events set created_at = now() - interval '100 days'`)
  ok((await db.query('select public.mb_purge_device_data(90) r')).rows[0].r > 0, 'a retenção de 90 dias apaga o histórico antigo')

  console.log('\nconcorrência: dois logins ao mesmo tempo disputando a vaga')
  const u4 = await mk()
  const ids = [await uuid(), await uuid()]
  const clients = [new Client({ connectionString: url.toString() }), new Client({ connectionString: url.toString() })]
  await Promise.all(clients.map(c => c.connect()))
  const results = await Promise.all(clients.map((c, i) => c.query('select public.mb_claim_device_slot($1,$2,$3,$4,$5,$6,$7,$8,$9) r', [u4, 'web', 'dev' + i, ids[i], 'x', null, null, null, null]).then(r => r.rows[0].r.status)))
  await Promise.all(clients.map(c => c.end()))
  eq(results.sort(), ['claimed', 'occupied'], 'um entra e o outro vê a vaga ocupada')
  eq((await db.query(`select count(*)::int n from public.mb_device_sessions where user_id=$1 and revoked_at is null`, [u4])).rows[0].n, 1, 'só uma sessão ativa no banco')

  console.log(`\n${passed} verificações passaram`)
} catch (e) {
  console.error('\nFALHOU:', e.message)
  process.exitCode = 1
} finally {
  await db.end()
  await admin.query(`drop database if exists ${DB} with (force)`)
  for (const r of createdRoles) { try { await admin.query(`drop role if exists ${r}`) } catch (e) { console.log('(não apaguei o papel', r, ':', e.message, ')') } }
  await admin.end()
}
