-- Lixeira de projetos e workspaces (Fase 2 da lixeira).
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main), DEPOIS de scripts/lixeira-casos-de-uso.sql (usa mb_trash_retention_hours e a tabela mb_trash).
-- Pode rodar de novo: tudo e "create if not exists" / "create or replace".
--
-- Como funciona (mesmo padrao da Fase 1): copia o projeto (ou o workspace inteiro, com todos os projetos) para mb_entity_trash e apaga de verdade.
-- Por isso o token do projeto, as telas publicadas e o tunel param de valer na hora, sem mexer em nenhuma consulta. Restaurar recria tudo com os MESMOS ids.
--
-- Quem pode excluir e restaurar (mesma regra que a tela ja usa para mostrar o botao de excluir):
--   projeto:   dono do workspace; convidado de Acesso Global; papel admin; membro com "excluir" no workspace; ou "excluir" marcado naquele projeto (Acesso Granular).
--   workspace: dono; convidado de Acesso Global; membro com "excluir" no workspace.
--   restaurar: quem pode excluir (regra acima), ou quem excluiu.
-- As funcoes sao SECURITY DEFINER porque, depois de excluir, a linha do projeto nao existe mais para as regras de acesso (RLS) conferirem; por isso
-- cada funcao confere a permissao sozinha, com auth.uid().
--
-- Fora da lixeira (de proposito): activity_logs (telemetria), bpm_runs (historico de execucoes) e o banco do cliente, que nunca e tocado.
-- Se, ao restaurar, o dono do workspace nao existe mais ou o plano gratis ja esta no limite, a restauracao e recusada (nada e feito pela metade).

-- 1) a lixeira ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.mb_entity_trash (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in ('project', 'workspace')),
  entity_id      uuid not null,
  workspace_id   uuid not null,          -- o workspace do projeto (ou o proprio workspace); sem FK de proposito: ele pode ter sido apagado
  owner_id       uuid not null,          -- dono do workspace no momento da exclusao
  name           text not null,
  slug           text not null,
  project_count  integer not null default 0,
  payload        jsonb not null,
  deleted_by     uuid default auth.uid(),
  deleted_at     timestamptz not null default now()
);
create index if not exists mb_entity_trash_ws_idx on public.mb_entity_trash (workspace_id, entity_type, deleted_at desc);
create index if not exists mb_entity_trash_owner_idx on public.mb_entity_trash (owner_id, entity_type, deleted_at desc);
alter table public.mb_entity_trash enable row level security;
-- sem policy: ninguem le nem grava direto. So as funcoes abaixo (security definer) mexem na tabela, cada uma conferindo a permissao.
revoke all on public.mb_entity_trash from anon, authenticated;

-- ATENCAO (seguranca): o Supabase concede EXECUTE a anon e authenticated em toda funcao nova do schema public. Por isso cada funcao abaixo revoga
-- explicitamente: as de apoio (copiar/recriar/conferir permissao) nao ficam chamaveis de fora; as demais so para quem esta logado.

-- 2) permissoes --------------------------------------------------------------------------------------------------------------------------
create or replace function public.mb_can_delete_workspace(p_workspace_id uuid, p_uid uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.workspaces where id = p_workspace_id;
  if v_owner is null or p_uid is null then return false; end if;
  if v_owner = p_uid then return true; end if;
  if exists (select 1 from public.owner_guests where owner_id = v_owner and user_id = p_uid and access_level = 'global') then return true; end if;
  return exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = p_uid and can_delete is true);
end $$;
revoke all on function public.mb_can_delete_workspace(uuid, uuid) from public, anon, authenticated; -- so as outras funcoes (security definer) chamam esta

create or replace function public.mb_can_delete_project(p_project_id uuid, p_uid uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.projects where id = p_project_id;
  if v_ws is null or p_uid is null then return false; end if;
  if exists (select 1 from public.workspace_members where workspace_id = v_ws and user_id = p_uid and (role in ('admin', 'owner') or can_delete is true)) then return true; end if;
  if exists (select 1 from public.workspace_member_projects where project_id = p_project_id and user_id = p_uid and can_delete is true) then return true; end if;
  -- dono e convidado global: mesma regra do workspace
  return public.mb_can_delete_workspace(v_ws, p_uid) and exists (
    select 1 from public.workspaces w where w.id = v_ws and (w.owner_id = p_uid or exists (select 1 from public.owner_guests g where g.owner_id = w.owner_id and g.user_id = p_uid and g.access_level = 'global')));
end $$;
revoke all on function public.mb_can_delete_project(uuid, uuid) from public, anon, authenticated; -- so as outras funcoes (security definer) chamam esta

-- quem pode restaurar/ver/apagar para sempre um item da lixeira
create or replace function public.mb_can_manage_entity_trash(t public.mb_entity_trash, p_uid uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_uid is null then return false; end if;
  if t.owner_id = p_uid or t.deleted_by = p_uid then return true; end if;
  if exists (select 1 from public.owner_guests where owner_id = t.owner_id and user_id = p_uid and access_level = 'global') then return true; end if;
  if exists (select 1 from public.workspaces where id = t.workspace_id) then
    -- o workspace ainda existe: vale a regra atual
    if t.entity_type = 'project' then
      return exists (select 1 from public.workspace_members where workspace_id = t.workspace_id and user_id = p_uid and (role in ('admin', 'owner') or can_delete is true))
          or exists (select 1 from jsonb_array_elements(coalesce(t.payload->'tables'->'workspace_member_projects', '[]'::jsonb)) m
                     where m->>'user_id' = p_uid::text and (m->>'can_delete') = 'true');
    end if;
    return exists (select 1 from public.workspace_members where workspace_id = t.workspace_id and user_id = p_uid and can_delete is true);
  end if;
  -- o workspace foi excluido junto: vale a lista de membros guardada na lixeira
  return exists (select 1 from jsonb_array_elements(coalesce(t.payload->'workspace_tables'->'workspace_members', '[]'::jsonb)) m
                 where m->>'user_id' = p_uid::text and ((m->>'can_delete') = 'true' or (t.entity_type = 'project' and m->>'role' in ('admin', 'owner'))));
end $$;
revoke all on function public.mb_can_manage_entity_trash(public.mb_entity_trash, uuid) from public, anon, authenticated; -- so as outras funcoes (security definer) chamam esta

-- 3) o que entra na copia de um projeto (ordem = ordem de restauracao; filtro = linhas que ja nao fazem sentido sao descartadas) -----------
create or replace function public.mb_project_trash_spec()
returns table (seq integer, tbl text, cond text, flt text) language sql immutable set search_path = public as $
  select * from (values
    (1,  'models',                    'project_id = $1', null::text),
    (2,  'fields',                    'model_id in (select id from public.models where project_id = $1)', null),
    (3,  'relations',                 'project_id = $1', null),
    (4,  'project_roles',             'project_id = $1', null),
    (5,  'ui_views',                  'project_id = $1', null),
    (6,  'ui_components',             'view_id in (select id from public.ui_views where project_id = $1)', null),
    (7,  'project_role_permissions',  'view_id in (select id from public.ui_views where project_id = $1)', null),
    (8,  'project_user_roles',        'project_id = $1', null),
    (9,  'bpm_workflows',             'project_id = $1', null),
    (10, 'agents',                    'project_id = $1', null),
    (11, 'agent_tasks',               'project_id = $1', '(r.created_by is null or exists (select 1 from auth.users u where u.id = r.created_by))'),
    (12, 'project_auth_config',       'project_id = $1', null),
    (13, 'tenant_users',              'project_id = $1', null),
    (14, 'project_users_security',    'project_id = $1', null),
    (15, 'project_enumerations',      'project_id = $1', null),
    (16, 'ui_custom_components',      'project_id = $1', null),
    (17, 'ai_builder_sessions',       'project_id = $1', '(r.user_id is null or exists (select 1 from auth.users u where u.id = r.user_id))'),
    (18, 'ai_builder_messages',       'session_id in (select id from public.ai_builder_sessions where project_id = $1)', 'exists (select 1 from public.ai_builder_sessions s where s.id = r.session_id)'),
    (19, 'mb_trash',                  'project_id = $1', null),
    (20, 'workspace_member_projects', 'project_id = $1', 'exists (select 1 from auth.users u where u.id = r.user_id)')
  ) as v(seq, tbl, cond, flt) order by seq
$$;

create or replace function public.mb_snapshot_project(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; rows jsonb; tables jsonb := '{}'::jsonb; p public.projects%rowtype;
begin
  select * into p from public.projects where id = p_project_id;
  if not found then raise exception 'project_not_found'; end if;
  for s in select * from public.mb_project_trash_spec() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t where %s', s.tbl, s.cond) into rows using p_project_id;
    tables := tables || jsonb_build_object(s.tbl, rows);
  end loop;
  return jsonb_build_object('project', to_jsonb(p), 'tables', tables);
end $$;
revoke all on function public.mb_snapshot_project(uuid) from public, anon, authenticated; -- so as outras funcoes (security definer) chamam esta

create or replace function public.mb_restore_project_payload(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s record; p public.projects%rowtype;
begin
  p := jsonb_populate_record(null::public.projects, p_payload->'project');
  -- dominio proprio e unico: se alguem ja usa, o projeto volta sem ele
  if p.custom_domain is not null and exists (select 1 from public.projects x where x.custom_domain = p.custom_domain) then p.custom_domain := null; end if;
  insert into public.projects select p.*;
  for s in select * from public.mb_project_trash_spec() loop
    execute format('insert into public.%I select r.* from jsonb_populate_recordset(null::public.%I, $1) r %s', s.tbl, s.tbl,
                   case when s.flt is null then '' else 'where ' || s.flt end)
      using coalesce(p_payload->'tables'->s.tbl, '[]'::jsonb);
  end loop;
  return p.id;
end $$;
revoke all on function public.mb_restore_project_payload(jsonb) from public, anon, authenticated; -- so as outras funcoes (security definer) chamam esta

-- 4) excluir (mover para a lixeira) ------------------------------------------------------------------------------------------------------
create or replace function public.mb_trash_project(p_project_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.projects%rowtype; w public.workspaces%rowtype; tid uuid;
begin
  select * into p from public.projects where id = p_project_id;
  if not found then raise exception 'project_not_found'; end if;
  if not public.mb_can_delete_project(p_project_id) then raise exception 'delete_not_allowed'; end if;
  select * into w from public.workspaces where id = p.workspace_id;

  insert into public.mb_entity_trash (entity_type, entity_id, workspace_id, owner_id, name, slug, project_count, payload)
  values ('project', p.id, p.workspace_id, w.owner_id, p.name, coalesce(p.slug, ''), 1, public.mb_snapshot_project(p.id))
  returning id into tid;

  delete from public.projects where id = p.id;
  return tid;
end $$;
revoke all on function public.mb_trash_project(uuid) from public, anon;
grant execute on function public.mb_trash_project(uuid) to authenticated;

create or replace function public.mb_trash_workspace(p_workspace_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  w public.workspaces%rowtype; tid uuid; projs jsonb; n integer;
begin
  select * into w from public.workspaces where id = p_workspace_id;
  if not found then raise exception 'workspace_not_found'; end if;
  if not public.mb_can_delete_workspace(p_workspace_id) then raise exception 'delete_not_allowed'; end if;

  select coalesce(jsonb_agg(public.mb_snapshot_project(x.id)), '[]'::jsonb), count(*) into projs, n from public.projects x where x.workspace_id = w.id;

  insert into public.mb_entity_trash (entity_type, entity_id, workspace_id, owner_id, name, slug, project_count, payload)
  values ('workspace', w.id, w.id, w.owner_id, w.name, coalesce(w.slug, ''), n, jsonb_build_object(
    'workspace', to_jsonb(w),
    'workspace_tables', jsonb_build_object(
      'workspace_members',   coalesce((select jsonb_agg(to_jsonb(m)) from public.workspace_members m where m.workspace_id = w.id), '[]'::jsonb),
      'ai_builder_configs',  coalesce((select jsonb_agg(to_jsonb(c)) from public.ai_builder_configs c where c.workspace_id = w.id), '[]'::jsonb),
      -- usuarios de tenant ligados so ao workspace (sem projeto)
      'tenant_users_loose',  coalesce((select jsonb_agg(to_jsonb(u)) from public.tenant_users u where u.workspace_id = w.id and u.project_id is null), '[]'::jsonb)
    ),
    'projects', projs))
  returning id into tid;

  delete from public.workspaces where id = w.id;   -- projetos e o resto saem em cascata
  return tid;
end $$;
revoke all on function public.mb_trash_workspace(uuid) from public, anon;
grant execute on function public.mb_trash_workspace(uuid) to authenticated;

-- 5) restaurar ---------------------------------------------------------------------------------------------------------------------------
create or replace function public.mb_restore_entity(p_trash_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.mb_entity_trash%rowtype; w public.workspaces%rowtype; pj jsonb; tier text; n integer := 0;
begin
  select * into t from public.mb_entity_trash where id = p_trash_id;
  if not found then raise exception 'trash_not_found'; end if;
  if not public.mb_can_manage_entity_trash(t) then raise exception 'delete_not_allowed'; end if;
  if t.deleted_at + make_interval(hours => public.mb_trash_retention_hours()) < now() then raise exception 'trash_expired'; end if;

  select subscription_tier into tier from public.profiles where id = t.owner_id;
  if not exists (select 1 from auth.users where id = t.owner_id) then raise exception 'owner_missing'; end if;

  if t.entity_type = 'project' then
    if not exists (select 1 from public.workspaces where id = t.workspace_id) then raise exception 'workspace_missing'; end if;
    if exists (select 1 from public.projects where id = t.entity_id) then raise exception 'already_exists'; end if;
    if exists (select 1 from public.projects where workspace_id = t.workspace_id and slug = t.slug) then raise exception 'slug_in_use'; end if;
    if coalesce(tier, 'free') <> 'pro' and exists (select 1 from public.projects where workspace_id = t.workspace_id) then raise exception 'plan_limit'; end if;
    perform public.mb_restore_project_payload(t.payload);
    n := 1;
  else
    if exists (select 1 from public.workspaces where id = t.entity_id) then raise exception 'already_exists'; end if;
    if exists (select 1 from public.workspaces where slug = t.slug) then raise exception 'slug_in_use'; end if;
    if coalesce(tier, 'free') <> 'pro' and exists (select 1 from public.workspaces where owner_id = t.owner_id) then raise exception 'plan_limit'; end if;

    w := jsonb_populate_record(null::public.workspaces, t.payload->'workspace');
    if w.custom_domain is not null and exists (select 1 from public.workspaces x where x.custom_domain = w.custom_domain) then w.custom_domain := null; end if;
    insert into public.workspaces select w.*;

    insert into public.workspace_members
      select r.* from jsonb_populate_recordset(null::public.workspace_members, coalesce(t.payload->'workspace_tables'->'workspace_members', '[]'::jsonb)) r
      where exists (select 1 from auth.users u where u.id = r.user_id);
    insert into public.ai_builder_configs
      select r.* from jsonb_populate_recordset(null::public.ai_builder_configs, coalesce(t.payload->'workspace_tables'->'ai_builder_configs', '[]'::jsonb)) r;

    for pj in select * from jsonb_array_elements(coalesce(t.payload->'projects', '[]'::jsonb)) loop
      perform public.mb_restore_project_payload(pj);
      n := n + 1;
    end loop;

    insert into public.tenant_users
      select r.* from jsonb_populate_recordset(null::public.tenant_users, coalesce(t.payload->'workspace_tables'->'tenant_users_loose', '[]'::jsonb)) r;
  end if;

  delete from public.mb_entity_trash where id = t.id;
  return jsonb_build_object('type', t.entity_type, 'id', t.entity_id, 'workspace_id', t.workspace_id, 'slug', t.slug, 'name', t.name, 'projects', n);
end $$;
revoke all on function public.mb_restore_entity(uuid) from public, anon;
grant execute on function public.mb_restore_entity(uuid) to authenticated;

-- 6) listar, apagar para sempre, limpar o que venceu -------------------------------------------------------------------------------------
-- p_workspace_id: so os itens daquele workspace (projetos excluidos dele). Sem workspace: os workspaces excluidos que a pessoa pode restaurar.
create or replace function public.mb_list_entity_trash(p_entity_type text, p_workspace_id uuid default null)
returns table (id uuid, entity_type text, entity_id uuid, workspace_id uuid, name text, slug text, project_count integer, deleted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select t.id, t.entity_type, t.entity_id, t.workspace_id, t.name, t.slug, t.project_count, t.deleted_at
    from public.mb_entity_trash t
    where t.entity_type = p_entity_type
      and (p_workspace_id is null or t.workspace_id = p_workspace_id)
      and t.deleted_at + make_interval(hours => public.mb_trash_retention_hours()) >= now()
      and public.mb_can_manage_entity_trash(t)
    order by t.deleted_at desc;
end $$;
revoke all on function public.mb_list_entity_trash(text, uuid) from public, anon;
grant execute on function public.mb_list_entity_trash(text, uuid) to authenticated;

create or replace function public.mb_delete_entity_trash(p_trash_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.mb_entity_trash%rowtype;
begin
  select * into t from public.mb_entity_trash where id = p_trash_id;
  if not found then raise exception 'trash_not_found'; end if;
  if not public.mb_can_manage_entity_trash(t) then raise exception 'delete_not_allowed'; end if;
  delete from public.mb_entity_trash where id = t.id;
end $$;
revoke all on function public.mb_delete_entity_trash(uuid) from public, anon;
grant execute on function public.mb_delete_entity_trash(uuid) to authenticated;

create or replace function public.mb_purge_expired_entity_trash()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.mb_entity_trash where deleted_at + make_interval(hours => public.mb_trash_retention_hours()) < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mb_purge_expired_entity_trash() from public, anon;
grant execute on function public.mb_purge_expired_entity_trash() to authenticated;
