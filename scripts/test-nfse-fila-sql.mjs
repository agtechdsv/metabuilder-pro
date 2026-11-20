// Teste do SQL da fila de notas fiscais: roda scripts/nfse-fila.sql num banco descartavel do PostgreSQL local (E2E_PG_ADMIN, padrao crm:crm@localhost:5432).
// Uso: node scripts/test-nfse-fila-sql.mjs   (cria e apaga o banco mb_nfse_scratch e os papeis anon/authenticated/service_role se nao existirem)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../package.json', import.meta.url))
const { Client } = require('pg')

const ADMIN = process.env.E2E_PG_ADMIN || 'postgresql://crm:crm@localhost:5432/postgres'
const DB = 'mb_nfse_scratch'
const sqlFile = fs.readFileSync(new URL('./nfse-fila.sql', import.meta.url), 'utf8')

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
  await db.query(`
    create table public.profiles (id uuid primary key default gen_random_uuid(), full_name text, company_name text, cnpj text, email text, is_super_admin boolean default false);
    create table public.platform_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid);
    create table public.payments (id uuid primary key default gen_random_uuid(), user_id uuid, amount numeric, status text, asaas_payment_id text, webhook_received_at timestamptz);
  `)
  const existing = (await admin.query(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role')`)).rows.map(r => r.rolname)
  createdRoles = ['anon', 'authenticated', 'service_role'].filter(r => !existing.includes(r))
  let withRoles = true
  try {
    await db.query(`do $b$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    end $b$;`)
  } catch (e) { withRoles = false; console.log('  (sem permissao para criar papeis; roda sem revoke/grant)', e.message) }

  let script = sqlFile
  if (!withRoles) script = script.split('\n').filter(l => !/^(revoke|grant)\b/.test(l.trim())).join('\n')
  await db.query(script)
  await db.query(script)
  ok(true, 'o script roda duas vezes sem erro')

  const q = async (sql, p = []) => (await db.query(sql, p)).rows
  const queue = async (payId) => (await q('select * from public.mb_nfse_queue where payment_id=$1', [payId]))[0]
  const user = (await q(`insert into public.profiles (full_name, company_name, cnpj, email) values ('Fulano', 'Empresa X', '19287384000101', 'f@x.com') returning id`))[0].id

  console.log('\najustes iniciais')
  eq((await q(`select value from public.platform_settings where key='nfse_mode'`))[0].value, { mode: 'manual' }, 'modo comeca em manual')
  eq((await q(`select value from public.platform_settings where key='nfse_wait_days'`))[0].value, { days: 8 }, 'prazo de 8 dias')

  console.log('\npagamento recebido entra na fila')
  const p1 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id, webhook_received_at) values ($1, 349, 'paid', 'pay_1', '2026-11-25 15:00:00+00') returning id`, [user]))[0].id
  let r = await queue(p1)
  ok(!!r, 'linha criada ao inserir pagamento pago')
  eq(r.status, 'pending', 'comeca pendente')
  eq(Number(r.amount), 349, 'valor')
  eq(r.customer_name, 'Empresa X', 'nome do cliente (empresa tem prioridade)')
  eq(r.customer_doc, '19287384000101', 'documento do cliente')
  eq(r.emit_on.toISOString().slice(0, 10), '2026-12-03', 'emissao = pagamento + 8 dias (25/11 -> 03/12)')

  console.log('\nhora de Brasilia: 01:00 UTC de 31/12 ainda e 30/12 em Brasilia')
  const p2 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id, webhook_received_at) values ($1, 100, 'paid', 'pay_2', '2026-12-31 01:00:00+00') returning id`, [user]))[0].id
  eq((await queue(p2)).emit_on.toISOString().slice(0, 10), '2027-01-07', '30/12 + 8 = 07/01')

  console.log('\ncobranca pendente vira paga depois')
  const p3 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id) values ($1, 50, 'pending', 'pay_3') returning id`, [user]))[0].id
  ok(!(await queue(p3)), 'pendente nao entra na fila')
  await q(`update public.payments set status='paid', webhook_received_at=now() where id=$1`, [p3])
  ok(!!(await queue(p3)), 'entra quando vira paga')
  await q(`update public.payments set status='paid' where id=$1`, [p3])
  eq((await q('select count(*)::int n from public.mb_nfse_queue where payment_id=$1', [p3]))[0].n, 1, 'evento repetido nao duplica')

  console.log('\nvalor zero e pagamento atrasado nao entram')
  const p4 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id) values ($1, 0, 'paid', 'pay_4') returning id`, [user]))[0].id
  ok(!(await queue(p4)), 'valor zero nao gera nota')
  const p5 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id) values ($1, 70, 'overdue', 'pay_5') returning id`, [user]))[0].id
  ok(!(await queue(p5)), 'atrasada nao gera nota')

  console.log('\nprazo configuravel')
  await q(`update public.platform_settings set value='{"days":3}' where key='nfse_wait_days'`)
  const p6 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id, webhook_received_at) values ($1, 10, 'paid', 'pay_6', '2026-11-10 15:00:00+00') returning id`, [user]))[0].id
  eq((await queue(p6)).emit_on.toISOString().slice(0, 10), '2026-11-13', 'prazo de 3 dias')
  await q(`update public.platform_settings set value='{"days":999}' where key='nfse_wait_days'`)
  const p7 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id, webhook_received_at) values ($1, 10, 'paid', 'pay_7', '2026-11-10 15:00:00+00') returning id`, [user]))[0].id
  eq((await queue(p7)).emit_on.toISOString().slice(0, 10), '2027-01-09', 'prazo absurdo e limitado a 60 dias')
  await q(`update public.platform_settings set value='"lixo"' where key='nfse_wait_days'`)
  const p8 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id, webhook_received_at) values ($1, 10, 'paid', 'pay_8', '2026-11-10 15:00:00+00') returning id`, [user]))[0].id
  eq((await queue(p8)).emit_on.toISOString().slice(0, 10), '2026-11-18', 'ajuste invalido volta a 8 dias, sem derrubar o pagamento')
  await q(`update public.platform_settings set value='{"days":8}' where key='nfse_wait_days'`)

  console.log('\ndevolucao')
  await q(`update public.payments set status='refunded' where id=$1`, [p1])
  r = await queue(p1)
  eq(r.status, 'canceled', 'devolvido antes de emitir: sai da fila')
  eq(r.refunded, false, 'e nao precisa cancelar nota')
  await q(`update public.mb_nfse_queue set status='issued', issued_at=now() where payment_id=$1`, [p2])
  await q(`update public.payments set status='refunded' where id=$1`, [p2])
  r = await queue(p2)
  eq(r.status, 'issued', 'devolvido depois de emitir: continua emitida')
  eq(r.refunded, true, 'mas marcada para cancelar a nota')

  console.log('\nseguranca')
  const fnAcl = (await q(`select has_function_privilege('anon','public.mb_nfse_enqueue()','execute') a, has_function_privilege('authenticated','public.mb_nfse_enqueue()','execute') b`))[0]
  if (withRoles) {
    eq(fnAcl, { a: false, b: false }, 'anon e authenticated nao executam a funcao')
    const tbl = (await q(`select has_table_privilege('anon','public.mb_nfse_queue','select') a, has_table_privilege('authenticated','public.mb_nfse_queue','select') b, has_table_privilege('service_role','public.mb_nfse_queue','select') c`))[0]
    eq(tbl, { a: false, b: false, c: true }, 'so o servidor le a fila')
  }
  eq((await q(`select relrowsecurity from pg_class where relname='mb_nfse_queue'`))[0].relrowsecurity, true, 'RLS ligado')

  console.log('\na trigger nunca derruba o pagamento')
  await q(`alter table public.mb_nfse_queue rename to mb_nfse_queue_off`)
  const p9 = (await q(`insert into public.payments (user_id, amount, status, asaas_payment_id) values ($1, 10, 'paid', 'pay_9') returning id`, [user]))[0].id
  ok(!!p9, 'pagamento gravado mesmo com a fila quebrada')
  await q(`alter table public.mb_nfse_queue_off rename to mb_nfse_queue`)

  console.log(`\n${passed} verificacoes passaram`)
} catch (e) {
  console.error('\nFALHOU:', e.message)
  process.exitCode = 1
} finally {
  await db.end()
  await admin.query(`drop database if exists ${DB} with (force)`)
  for (const r of createdRoles) { try { await admin.query(`drop role if exists ${r}`) } catch (e) { console.log('(nao apaguei o papel', r, ':', e.message, ')') } }
  await admin.end()
}
