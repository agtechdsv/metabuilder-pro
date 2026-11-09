-- Lixeira de casos de uso (Fase 1).
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main). Pode rodar de novo: tudo e "create if not exists" / "create or replace".
--
-- O que faz:
--  1) platform_settings: ajustes globais da plataforma. Aqui entra o prazo da lixeira (chave trash_retention_hours), que SO o SuperAdmin muda
--     (pela tela /admin/platform, aba Planos). Sem linha salva, vale 48 horas.
--  2) mb_trash: a lixeira. Guarda uma copia do caso de uso (tela + componentes + permissoes por perfil + fluxos BPM) e os itens de menu
--     que apontavam para ele, para restaurar com os mesmos ids.
--  3) mb_trash_use_case / mb_restore_use_case: mover para a lixeira e restaurar, em UMA transacao (ou faz tudo, ou nao faz nada).
--  4) mb_purge_expired_trash: apaga da lixeira o que passou do prazo. O cron diario (/api/cron/empty-trash) faz o mesmo para todos os projetos.
--
-- Fora da lixeira (de proposito): activity_logs da tela (telemetria de uso) e o banco do cliente (CRM, Oracle...), que nunca e tocado.

-- 1) ajustes globais ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.platform_settings enable row level security;

drop policy if exists "Todos leem os ajustes da plataforma" on public.platform_settings;
create policy "Todos leem os ajustes da plataforma" on public.platform_settings
  for select to authenticated using (true);
-- sem policy de escrita: quem grava e o servidor (service role), depois de checar que a pessoa e SuperAdmin.

insert into public.platform_settings (key, value)
values ('trash_retention_hours', '{"hours": 48}'::jsonb)
on conflict (key) do nothing;

-- prazo em horas (1 a 720; 48 se nao houver ajuste). security definer para qualquer pessoa logada poder consultar.
create or replace function public.mb_trash_retention_hours()
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select greatest(1, least(720, (value->>'hours')::int)) from public.platform_settings where key = 'trash_retention_hours'),
    48
  )
$$;
revoke all on function public.mb_trash_retention_hours() from public;
grant execute on function public.mb_trash_retention_hours() to authenticated, service_role;

-- 2) a lixeira ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.mb_trash (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null default 'use_case' check (entity_type in ('use_case')),
  entity_id     uuid not null,
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null,
  slug          text not null,
  logic_type    text,
  payload       jsonb not null,
  menu_entries  jsonb not null default '[]'::jsonb,
  deleted_by    uuid default auth.uid(),
  deleted_at    timestamptz not null default now()
);
create index if not exists mb_trash_project_idx on public.mb_trash (project_id, deleted_at desc);
alter table public.mb_trash enable row level security;

-- mesma regra das telas (ui_views): quem enxerga o projeto enxerga e gerencia a lixeira dele
drop policy if exists "Membros do projeto gerenciam a lixeira" on public.mb_trash;
create policy "Membros do projeto gerenciam a lixeira" on public.mb_trash
  for all to authenticated
  using (exists (select 1 from public.projects p where p.id = mb_trash.project_id))
  with check (exists (select 1 from public.projects p where p.id = mb_trash.project_id));

-- 3) mover para a lixeira ----------------------------------------------------------------------------------------------------------------
create or replace function public.mb_trash_use_case(p_view_id uuid, p_menu_entries jsonb default '[]'::jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v   public.ui_views%rowtype;
  tid uuid;
begin
  select * into v from public.ui_views where id = p_view_id;
  if not found then raise exception 'use_case_not_found'; end if;

  insert into public.mb_trash (entity_type, entity_id, project_id, name, slug, logic_type, payload, menu_entries)
  values (
    'use_case', v.id, v.project_id, v.name, v.slug, v.logic_type,
    jsonb_build_object(
      'view', to_jsonb(v),
      'components',       coalesce((select jsonb_agg(to_jsonb(c)) from public.ui_components c           where c.view_id = v.id), '[]'::jsonb),
      'role_permissions', coalesce((select jsonb_agg(to_jsonb(r)) from public.project_role_permissions r where r.view_id = v.id), '[]'::jsonb),
      'bpm_workflows',    coalesce((select jsonb_agg(to_jsonb(b)) from public.bpm_workflows b             where b.use_case_id = v.id), '[]'::jsonb)
    ),
    coalesce(p_menu_entries, '[]'::jsonb)
  )
  returning id into tid;

  delete from public.ui_views where id = v.id;
  -- se as regras de acesso nao deixaram apagar, desfaz tudo (a copia na lixeira tambem)
  if not found then raise exception 'delete_not_allowed'; end if;

  return tid;
end $$;
revoke all on function public.mb_trash_use_case(uuid, jsonb) from public;
grant execute on function public.mb_trash_use_case(uuid, jsonb) to authenticated;

-- 4) restaurar ---------------------------------------------------------------------------------------------------------------------------
create or replace function public.mb_restore_use_case(p_trash_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  t            public.mb_trash%rowtype;
  v            public.ui_views%rowtype;
  n_total      integer;
  n_ok         integer;
  model_gone   boolean := false;
begin
  select * into t from public.mb_trash where id = p_trash_id and entity_type = 'use_case';
  if not found then raise exception 'trash_not_found'; end if;

  if t.deleted_at + make_interval(hours => public.mb_trash_retention_hours()) < now() then
    raise exception 'trash_expired';
  end if;
  if exists (select 1 from public.ui_views where project_id = t.project_id and slug = t.slug) then raise exception 'slug_in_use'; end if;
  if exists (select 1 from public.ui_views where id = t.entity_id) then raise exception 'already_exists'; end if;

  v := jsonb_populate_record(null::public.ui_views, t.payload->'view');
  if v.model_id is not null and not exists (select 1 from public.models m where m.id = v.model_id) then
    v.model_id := null; model_gone := true;
  end if;
  insert into public.ui_views select v.*;

  -- componentes: so os cujo campo ainda existe (se o campo foi apagado nesse meio tempo, o componente nao tem mais a que se ligar)
  select count(*) into n_total from jsonb_array_elements(coalesce(t.payload->'components', '[]'::jsonb));
  insert into public.ui_components
    select c.* from jsonb_populate_recordset(null::public.ui_components, coalesce(t.payload->'components', '[]'::jsonb)) c
    where exists (select 1 from public.fields f where f.id = c.field_id);
  get diagnostics n_ok = row_count;

  -- permissoes por perfil: so dos perfis que ainda existem
  insert into public.project_role_permissions
    select r.* from jsonb_populate_recordset(null::public.project_role_permissions, coalesce(t.payload->'role_permissions', '[]'::jsonb)) r
    where exists (select 1 from public.project_roles pr where pr.id = r.role_id);

  insert into public.bpm_workflows
    select b.* from jsonb_populate_recordset(null::public.bpm_workflows, coalesce(t.payload->'bpm_workflows', '[]'::jsonb)) b;

  delete from public.mb_trash where id = t.id;

  return jsonb_build_object(
    'id', v.id, 'slug', v.slug, 'name', v.name, 'menu_entries', t.menu_entries,
    'components_total', n_total, 'components_restored', n_ok, 'model_missing', model_gone
  );
end $$;
revoke all on function public.mb_restore_use_case(uuid) from public;
grant execute on function public.mb_restore_use_case(uuid) to authenticated;

-- 5) limpar o que venceu (so dos projetos que a pessoa enxerga; o cron limpa todos) ------------------------------------------------------
create or replace function public.mb_purge_expired_trash()
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  delete from public.mb_trash where deleted_at + make_interval(hours => public.mb_trash_retention_hours()) < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mb_purge_expired_trash() from public;
grant execute on function public.mb_purge_expired_trash() to authenticated;
