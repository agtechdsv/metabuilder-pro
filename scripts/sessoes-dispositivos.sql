-- Vagas de sessao por usuario: 1 vaga de IDE e 1 vaga de navegador (desenho em docs/sessoes-dispositivos-desenho.md).
-- Rode no SQL Editor do Supabase (projeto main). Pode rodar mais de uma vez: tudo e idempotente.
--
-- O que este script cria:
--  1) ajustes em platform_settings (modo, ociosidade, trocas por dia, validade da checagem);
--  2) tabelas mb_device_sessions (as vagas), mb_device_events (historico) e mb_slot_challenges (codigo por e-mail);
--  3) funcoes mb_claim_device_slot, mb_take_over_slot, mb_release_device_slot, mb_revoke_device_session,
--     mb_purge_revoked_auth_sessions e mb_purge_device_data. So o servidor (service_role) chama.
--
-- Seguranca: nenhuma tabela tem policy (RLS ligada e sem acesso para anon/authenticated); todas as funcoes sao security definer
-- com search_path fixo e executaveis SO pelo service_role. O servidor confere quem esta agindo antes de chamar qualquer uma.
--
-- O modo comeca em 'off' (nada muda). Troque pela tela do SuperAdmin: 'observe' (so registra) e depois 'enforce' (vale de verdade).

-- 1) ajustes ---------------------------------------------------------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('device_slot_mode',          '{"mode": "off"}'::jsonb),     -- off | observe | enforce
  ('device_idle_minutes',       '{"minutes": 15}'::jsonb),     -- sem atividade por este tempo, a vaga fica livre
  ('device_takeover_daily_cap', '{"count": 3}'::jsonb),        -- trocas por dia por usuario; passou, pede codigo por e-mail
  ('device_check_ttl_seconds',  '{"seconds": 60}'::jsonb)      -- de quanto em quanto tempo o servidor reconfere a vaga
on conflict (key) do nothing;

-- 2) tabelas ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.mb_device_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('web', 'ide')),
  device_id       text not null,
  auth_session_id uuid not null,
  label           text,                       -- ex.: "Chrome no Windows"
  city            text,
  region          text,
  country         text,
  ip_hash         text,                       -- hash com segredo; nunca o IP puro
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_reason  text check (revoked_reason in ('replaced', 'same_device', 'idle', 'logout', 'admin', 'user')),
  replaced_by     uuid,
  auth_deleted_at timestamptz                 -- quando a sessao do Supabase Auth foi apagada (impede renovar o token)
);

-- no maximo UMA sessao ativa por usuario e tipo: se dois logins chegarem juntos, o banco recusa o segundo
create unique index if not exists mb_device_sessions_one_active on public.mb_device_sessions (user_id, kind) where revoked_at is null;
create index if not exists mb_device_sessions_auth_session on public.mb_device_sessions (auth_session_id);
create index if not exists mb_device_sessions_user_recent on public.mb_device_sessions (user_id, created_at desc);
create index if not exists mb_device_sessions_pending_auth on public.mb_device_sessions (revoked_at) where revoked_at is not null and auth_deleted_at is null;

create table if not exists public.mb_device_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  event           text not null check (event in ('claimed', 'takeover', 'conflict', 'idle_release', 'logout', 'cap_reached', 'code_sent', 'code_failed', 'revoked')),
  kind            text,
  device_id       text,
  auth_session_id uuid,
  label           text,
  city            text,
  region          text,
  country         text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists mb_device_events_user_recent on public.mb_device_events (user_id, created_at desc);
create index if not exists mb_device_events_event_recent on public.mb_device_events (event, created_at desc);

create table if not exists public.mb_slot_challenges (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid not null,
  code_hash       text not null,
  expires_at      timestamptz not null,
  attempts        int not null default 0,
  created_at      timestamptz not null default now()
);
create unique index if not exists mb_slot_challenges_one_per_session on public.mb_slot_challenges (auth_session_id);

alter table public.mb_device_sessions enable row level security;
alter table public.mb_device_events   enable row level security;
alter table public.mb_slot_challenges enable row level security;
revoke all on public.mb_device_sessions from anon, authenticated;
revoke all on public.mb_device_events   from anon, authenticated;
revoke all on public.mb_slot_challenges from anon, authenticated;
revoke all on sequence public.mb_device_events_id_seq from anon, authenticated;

-- 3) funcoes ---------------------------------------------------------------------------------------------------------------------------

-- ajustes lidos de platform_settings, com padrao seguro (modo desligado)
create or replace function public.mb_device_settings()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'mode',    coalesce((select value->>'mode' from public.platform_settings where key = 'device_slot_mode'), 'off'),
    'idle',    greatest(1, coalesce((select (value->>'minutes')::int from public.platform_settings where key = 'device_idle_minutes'), 15)),
    'cap',     greatest(1, coalesce((select (value->>'count')::int from public.platform_settings where key = 'device_takeover_daily_cap'), 3)),
    'ttl',     greatest(10, coalesce((select (value->>'seconds')::int from public.platform_settings where key = 'device_check_ttl_seconds'), 60))
  );
$$;

-- grava um evento (historico, alertas e limite de trocas)
create or replace function public.mb_device_log(
  p_user uuid, p_event text, p_kind text, p_device text, p_session uuid,
  p_label text, p_city text, p_region text, p_country text, p_meta jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = public
as $$
  insert into public.mb_device_events (user_id, event, kind, device_id, auth_session_id, label, city, region, country, meta)
  values (p_user, p_event, p_kind, p_device, p_session, p_label, p_city, p_region, p_country, coalesce(p_meta, '{}'::jsonb));
$$;

-- descreve a sessao que esta ocupando a vaga (o que a tela de escolha mostra)
create or replace function public.mb_device_describe(p public.mb_device_sessions)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'label', p.label, 'city', p.city, 'region', p.region, 'country', p.country,
    'since', p.created_at, 'last_seen_at', p.last_seen_at, 'device_id', p.device_id
  );
$$;

-- tenta ocupar a vaga (ou renova a que ja e minha). Devolve: off | exempt | ok | claimed | occupied | revoked
create or replace function public.mb_claim_device_slot(
  p_user uuid, p_kind text, p_device text, p_session uuid,
  p_label text, p_city text, p_region text, p_country text, p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        jsonb := public.mb_device_settings();
  v_mode   text  := s->>'mode';
  v_idle   int   := (s->>'idle')::int;
  v_ttl    int   := (s->>'ttl')::int;
  v_super  boolean;
  mine     public.mb_device_sessions;
  cur      public.mb_device_sessions;
  v_new    uuid;
  v_by     public.mb_device_sessions;
begin
  if p_kind not in ('web', 'ide') then raise exception 'invalid_kind'; end if;
  if p_user is null or p_session is null or coalesce(p_device, '') = '' then raise exception 'invalid_input'; end if;

  if v_mode = 'off' then
    return jsonb_build_object('status', 'off', 'mode', v_mode, 'ttl', v_ttl);
  end if;

  select coalesce(is_super_admin, false) into v_super from public.profiles where id = p_user;
  if coalesce(v_super, false) then
    return jsonb_build_object('status', 'exempt', 'mode', v_mode, 'ttl', v_ttl);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_kind, 0));

  -- 1) esta sessao ja tem registro?
  select * into mine from public.mb_device_sessions where auth_session_id = p_session order by created_at desc limit 1;
  if found then
    if mine.revoked_at is not null then
      select * into v_by from public.mb_device_sessions where id = mine.replaced_by;
      return jsonb_build_object(
        'status', 'revoked', 'mode', v_mode, 'ttl', v_ttl, 'reason', mine.revoked_reason,
        'by', case when v_by.id is null then null else public.mb_device_describe(v_by) end,
        'revoked_at', mine.revoked_at
      );
    end if;
    update public.mb_device_sessions set last_seen_at = now() where id = mine.id;
    -- a mesma sessao de login apareceu em outro navegador/dispositivo (cookies de login copiados?): passa, mas fica registrado para o SuperAdmin
    if mine.device_id <> p_device and not exists (
      select 1 from public.mb_device_events
      where user_id = p_user and event = 'conflict' and auth_session_id = p_session and created_at > now() - interval '30 minutes'
    ) then
      perform public.mb_device_log(p_user, 'conflict', p_kind, p_device, p_session, p_label, p_city, p_region, p_country,
                                   jsonb_build_object('reason', 'same_session_other_device', 'session_device', mine.device_id));
    end if;
    -- a IDE pode ter entrado antes de o cookie de tipo existir (foi vista como navegador): se a vaga certa esta livre, corrige
    if mine.kind <> p_kind and not exists (
      select 1 from public.mb_device_sessions where user_id = p_user and kind = p_kind and revoked_at is null
    ) then
      begin
        update public.mb_device_sessions set kind = p_kind where id = mine.id;
      exception when unique_violation then
        null;
      end;
    end if;
    return jsonb_build_object('status', 'ok', 'mode', v_mode, 'ttl', v_ttl);
  end if;

  -- 2) quem esta na vaga agora?
  select * into cur from public.mb_device_sessions where user_id = p_user and kind = p_kind and revoked_at is null;

  if found then
    if cur.device_id = p_device then
      -- mesma maquina entrando de novo: substitui sem perguntar
      update public.mb_device_sessions set revoked_at = now(), revoked_reason = 'same_device' where id = cur.id;
    elsif cur.last_seen_at < now() - make_interval(mins => v_idle) then
      update public.mb_device_sessions set revoked_at = now(), revoked_reason = 'idle' where id = cur.id;
      perform public.mb_device_log(p_user, 'idle_release', p_kind, cur.device_id, cur.auth_session_id, cur.label, cur.city, cur.region, cur.country,
                                   jsonb_build_object('idle_minutes', v_idle));
    else
      -- ocupada por outra maquina e ainda ativa
      if not exists (
        select 1 from public.mb_device_events
        where user_id = p_user and event = 'conflict' and auth_session_id = p_session and created_at > now() - interval '30 minutes'
      ) then
        perform public.mb_device_log(p_user, 'conflict', p_kind, p_device, p_session, p_label, p_city, p_region, p_country,
                                     jsonb_build_object('mode', v_mode, 'other_device', cur.device_id, 'other_city', cur.city, 'other_label', cur.label));
      end if;
      if v_mode = 'observe' then
        return jsonb_build_object('status', 'ok', 'mode', v_mode, 'ttl', v_ttl, 'would_block', true);
      end if;
      return jsonb_build_object('status', 'occupied', 'mode', v_mode, 'ttl', v_ttl, 'other', public.mb_device_describe(cur));
    end if;
  end if;

  insert into public.mb_device_sessions (user_id, kind, device_id, auth_session_id, label, city, region, country, ip_hash)
  values (p_user, p_kind, p_device, p_session, p_label, p_city, p_region, p_country, p_ip_hash)
  returning id into v_new;

  if cur.id is not null then
    update public.mb_device_sessions set replaced_by = v_new where id = cur.id;
  end if;

  perform public.mb_device_log(p_user, 'claimed', p_kind, p_device, p_session, p_label, p_city, p_region, p_country, '{}'::jsonb);
  return jsonb_build_object('status', 'claimed', 'mode', v_mode, 'ttl', v_ttl);
end;
$$;

-- o usuario escolheu "encerrar a outra e entrar aqui". Devolve: ok | claimed | needs_code
create or replace function public.mb_take_over_slot(
  p_user uuid, p_kind text, p_device text, p_session uuid,
  p_label text, p_city text, p_region text, p_country text, p_ip_hash text,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        jsonb := public.mb_device_settings();
  v_mode   text  := s->>'mode';
  v_cap    int   := (s->>'cap')::int;
  v_ttl    int   := (s->>'ttl')::int;
  v_super  boolean;
  mine     public.mb_device_sessions;
  cur      public.mb_device_sessions;
  v_new    uuid;
  v_count  int;
begin
  if p_kind not in ('web', 'ide') then raise exception 'invalid_kind'; end if;
  if p_user is null or p_session is null or coalesce(p_device, '') = '' then raise exception 'invalid_input'; end if;

  if v_mode <> 'enforce' then
    return jsonb_build_object('status', 'ok', 'mode', v_mode, 'ttl', v_ttl);
  end if;

  select coalesce(is_super_admin, false) into v_super from public.profiles where id = p_user;
  if coalesce(v_super, false) then
    return jsonb_build_object('status', 'ok', 'mode', v_mode, 'ttl', v_ttl);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_kind, 0));

  select * into mine from public.mb_device_sessions where auth_session_id = p_session order by created_at desc limit 1;
  if found and mine.revoked_at is null then
    return jsonb_build_object('status', 'ok', 'mode', v_mode, 'ttl', v_ttl);
  end if;
  if found and mine.revoked_at is not null then
    raise exception 'session_revoked';
  end if;

  select * into cur from public.mb_device_sessions where user_id = p_user and kind = p_kind and revoked_at is null;

  if found then
    select count(*) into v_count from public.mb_device_events
      where user_id = p_user and event = 'takeover' and created_at > now() - interval '24 hours';
    if v_count >= v_cap and not coalesce(p_confirmed, false) then
      perform public.mb_device_log(p_user, 'cap_reached', p_kind, p_device, p_session, p_label, p_city, p_region, p_country,
                                   jsonb_build_object('count', v_count, 'cap', v_cap));
      return jsonb_build_object('status', 'needs_code', 'mode', v_mode, 'ttl', v_ttl, 'count', v_count, 'cap', v_cap);
    end if;
    update public.mb_device_sessions set revoked_at = now(), revoked_reason = 'replaced' where id = cur.id;
  end if;

  insert into public.mb_device_sessions (user_id, kind, device_id, auth_session_id, label, city, region, country, ip_hash)
  values (p_user, p_kind, p_device, p_session, p_label, p_city, p_region, p_country, p_ip_hash)
  returning id into v_new;

  if cur.id is not null then
    update public.mb_device_sessions set replaced_by = v_new where id = cur.id;
    perform public.mb_device_log(p_user, 'takeover', p_kind, p_device, p_session, p_label, p_city, p_region, p_country,
                                 jsonb_build_object('kicked', public.mb_device_describe(cur), 'confirmed', coalesce(p_confirmed, false)));
    return jsonb_build_object('status', 'claimed', 'mode', v_mode, 'ttl', v_ttl, 'kicked', public.mb_device_describe(cur));
  end if;

  perform public.mb_device_log(p_user, 'claimed', p_kind, p_device, p_session, p_label, p_city, p_region, p_country, '{}'::jsonb);
  return jsonb_build_object('status', 'claimed', 'mode', v_mode, 'ttl', v_ttl);
end;
$$;

-- logout libera a vaga na hora
create or replace function public.mb_release_device_slot(p_session uuid, p_reason text default 'logout')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mb_device_sessions;
begin
  if p_reason not in ('logout', 'user', 'admin') then raise exception 'invalid_reason'; end if;
  update public.mb_device_sessions set revoked_at = now(), revoked_reason = p_reason
    where auth_session_id = p_session and revoked_at is null
    returning * into r;
  if r.id is null then return false; end if;
  if p_reason = 'logout' then
    perform public.mb_device_log(r.user_id, 'logout', r.kind, r.device_id, r.auth_session_id, r.label, r.city, r.region, r.country, '{}'::jsonb);
  end if;
  return true;
end;
$$;

-- encerra uma sessao pelo id da vaga (o usuario em "Meus dispositivos" ou o SuperAdmin). O servidor confere quem pode.
create or replace function public.mb_revoke_device_session(p_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mb_device_sessions;
begin
  if p_reason not in ('user', 'admin') then raise exception 'invalid_reason'; end if;
  update public.mb_device_sessions set revoked_at = now(), revoked_reason = p_reason
    where id = p_id and revoked_at is null
    returning * into r;
  if r.id is null then return false; end if;
  perform public.mb_device_log(r.user_id, 'revoked', r.kind, r.device_id, r.auth_session_id, r.label, r.city, r.region, r.country,
                               jsonb_build_object('reason', p_reason));
  return true;
end;
$$;

-- apaga a sessao do Supabase Auth das vagas encerradas ha mais de N minutos: sem ela o token nao renova e o login cai de vez.
-- Devolve quantas vagas foram tratadas (ou -1 se o banco nao deixar mexer em auth.sessions).
create or replace function public.mb_purge_revoked_auth_sessions(p_minutes int default 15)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  begin
    with t as (
      select id, auth_session_id from public.mb_device_sessions
      where revoked_at is not null and auth_deleted_at is null
        and revoked_reason in ('replaced', 'idle', 'admin', 'user')
        and revoked_at < now() - make_interval(mins => greatest(1, p_minutes))
      limit 500
    ), d as (
      delete from auth.sessions s using t where s.id = t.auth_session_id returning s.id
    )
    update public.mb_device_sessions m set auth_deleted_at = now() from t where m.id = t.id;
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    return -1;
  end;
  return n;
end;
$$;

-- retencao: historico e vagas encerradas guardados por N dias (padrao 90), codigos vencidos apagados
create or replace function public.mb_purge_device_data(p_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n1 int; n2 int; n3 int;
begin
  delete from public.mb_device_events where created_at < now() - make_interval(days => greatest(7, p_days));
  get diagnostics n1 = row_count;
  delete from public.mb_device_sessions where revoked_at is not null and revoked_at < now() - make_interval(days => greatest(7, p_days));
  get diagnostics n2 = row_count;
  delete from public.mb_slot_challenges where expires_at < now() - interval '1 day';
  get diagnostics n3 = row_count;
  return n1 + n2 + n3;
end;
$$;

-- so o servidor (service_role) executa as funcoes. "revoke from public" nao basta: anon e authenticated recebem EXECUTE por padrao.
revoke all on function public.mb_device_settings()                                                    from public, anon, authenticated;
revoke all on function public.mb_device_log(uuid, text, text, text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.mb_device_describe(public.mb_device_sessions)                           from public, anon, authenticated;
revoke all on function public.mb_claim_device_slot(uuid, text, text, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mb_take_over_slot(uuid, text, text, uuid, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.mb_release_device_slot(uuid, text)                                      from public, anon, authenticated;
revoke all on function public.mb_revoke_device_session(uuid, text)                                    from public, anon, authenticated;
revoke all on function public.mb_purge_revoked_auth_sessions(int)                                     from public, anon, authenticated;
revoke all on function public.mb_purge_device_data(int)                                               from public, anon, authenticated;

grant execute on function public.mb_device_settings()                                                    to service_role;
grant execute on function public.mb_device_log(uuid, text, text, text, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.mb_device_describe(public.mb_device_sessions)                           to service_role;
grant execute on function public.mb_claim_device_slot(uuid, text, text, uuid, text, text, text, text, text) to service_role;
grant execute on function public.mb_take_over_slot(uuid, text, text, uuid, text, text, text, text, text, boolean) to service_role;
grant execute on function public.mb_release_device_slot(uuid, text)                                      to service_role;
grant execute on function public.mb_revoke_device_session(uuid, text)                                    to service_role;
grant execute on function public.mb_purge_revoked_auth_sessions(int)                                     to service_role;
grant execute on function public.mb_purge_device_data(int)                                               to service_role;
