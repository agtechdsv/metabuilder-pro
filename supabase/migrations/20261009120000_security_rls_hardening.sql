-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Endurecimento das políticas de acesso (RLS) do banco de CONFIGURAÇÃO do MetaBuilder.
--
-- Encontrado na revisão de 2026-10-09 (a chave pública do app, visível na aba Network, é suficiente para explorar):
--   1. profiles: qualquer conta logada podia alterar o PRÓPRIO is_super_admin e subscription_tier (virar super admin /
--      ganhar o plano Pro).
--   2. project_auth_config, ui_views, ui_components, tenant_users: `USING (true)` para qualquer visitante (até anônimo):
--      ler e GRAVAR a configuração de login, as telas (inclusive as regras de acesso do BI) e os componentes de todos os projetos.
--   3. project_roles / project_role_permissions / project_user_roles / ui_custom_components: qualquer conta logada
--      editava as permissões e os componentes de QUALQUER projeto; as três primeiras também eram legíveis por todos.
--   4. download_jobs e desktop_builds: política "Service role can manage ..." concedida a TODOS (o service role já ignora RLS).
--   5. app_downloads: qualquer conta logada podia inserir/alterar/apagar os instaladores oficiais.
--   6. Políticas "Free tier ..." eram PERMISSIVAS (somam permissão em vez de limitar) e com condição que nunca restringia.
--
-- Verificado no código: as páginas do app publicado (runtime) usam a chave de serviço no servidor, que ignora RLS;
-- o Studio/Admin usa o login do desenvolvedor (coberto pelas políticas por projeto abaixo); o painel de downloads do usuário
-- final lê por /api/export (servidor). Por isso fechar o acesso anônimo não deve afetar o app publicado.
--
-- COMO APLICAR: de preferência primeiro numa branch do Supabase; depois rode as consultas de verificação no fim do arquivo.
-- REVERSÃO: cada bloco tem o nome das políticas removidas; recriar uma política antiga é um CREATE POLICY com o mesmo nome.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1) profiles: colunas que só o servidor pode alterar ─────────────────────────────────────────
-- Chamadas feitas com o login de um usuário (anon/authenticated) não alteram estas colunas; o servidor (service_role)
-- e a administração do banco continuam podendo. Os campos de perfil do próprio usuário (nome, avatar, endereço, MFA...) seguem livres.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    -- (subscription_tier NÃO entra aqui: é uma coluna GERADA a partir de is_super_admin e subscription_status, que já estão
    -- protegidos. Num BEFORE UPDATE o valor novo de uma coluna gerada ainda é nulo, então comparar sempre daria "diferente"
    -- e bloquearia toda edição de perfil.)
    if new.is_super_admin is distinct from old.is_super_admin
       or new.subscription_status is distinct from old.subscription_status
       or new.subscription_cycle is distinct from old.subscription_cycle
       or new.subscription_expires_at is distinct from old.subscription_expires_at
       or new.subscription_licenses is distinct from old.subscription_licenses
       or new.subscription_amount is distinct from old.subscription_amount
       or new.asaas_customer_id is distinct from old.asaas_customer_id
       or new.asaas_subscription_id is distinct from old.asaas_subscription_id
       or new.card_brand is distinct from old.card_brand
       or new.card_last_digits is distinct from old.card_last_digits
       or new.is_blocked is distinct from old.is_blocked
       or new.is_blocked_community is distinct from old.is_blocked_community
       or new.is_blocked_metavoice is distinct from old.is_blocked_metavoice
       or new.referral_code is distinct from old.referral_code then
      raise exception 'Este dado do perfil só pode ser alterado pelo servidor.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_protect_profile_privileged on public.profiles;
create trigger tr_protect_profile_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ── 2) Configuração de login por projeto ────────────────────────────────────────────────────────
drop policy if exists "Enable all for project_auth_config" on public.project_auth_config;
create policy "Membros do projeto gerenciam a configuração de login"
  on public.project_auth_config for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_auth_config.project_id))
  with check (exists (select 1 from public.projects p where p.id = project_auth_config.project_id));

-- ── 3) Telas (casos de uso) e componentes ───────────────────────────────────────────────────────
drop policy if exists "Enable ALL for ui_views MVP" on public.ui_views;
create policy "Membros do projeto gerenciam as telas"
  on public.ui_views for all to authenticated
  using (exists (select 1 from public.projects p where p.id = ui_views.project_id))
  with check (exists (select 1 from public.projects p where p.id = ui_views.project_id));

drop policy if exists "Enable ALL for ui_components MVP" on public.ui_components;
create policy "Membros do projeto gerenciam os componentes das telas"
  on public.ui_components for all to authenticated
  using (exists (select 1 from public.ui_views v where v.id = ui_components.view_id))
  with check (exists (select 1 from public.ui_views v where v.id = ui_components.view_id));

drop policy if exists "Acesso total para usuários autenticados" on public.ui_custom_components;
create policy "Membros do projeto gerenciam os componentes próprios"
  on public.ui_custom_components for all to authenticated
  using (exists (select 1 from public.projects p where p.id = ui_custom_components.project_id))
  with check (exists (select 1 from public.projects p where p.id = ui_custom_components.project_id));

-- ── 4) Papéis e permissões dos usuários do app ──────────────────────────────────────────────────
drop policy if exists "Allow ALL for authenticated on project roles" on public.project_roles;
drop policy if exists "Public read for project roles" on public.project_roles;
create policy "Membros do projeto gerenciam os papéis"
  on public.project_roles for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_roles.project_id))
  with check (exists (select 1 from public.projects p where p.id = project_roles.project_id));

drop policy if exists "Allow ALL for authenticated on role permissions" on public.project_role_permissions;
drop policy if exists "Public read for role permissions" on public.project_role_permissions;
create policy "Membros do projeto gerenciam as permissões dos papéis"
  on public.project_role_permissions for all to authenticated
  using (exists (select 1 from public.project_roles r where r.id = project_role_permissions.role_id))
  with check (exists (select 1 from public.project_roles r where r.id = project_role_permissions.role_id));

drop policy if exists "Allow ALL for authenticated on project user roles" on public.project_user_roles;
drop policy if exists "Public read for project user roles mapping" on public.project_user_roles;
create policy "Membros do projeto gerenciam os papéis dos usuários"
  on public.project_user_roles for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_user_roles.project_id))
  with check (exists (select 1 from public.projects p where p.id = project_user_roles.project_id));

-- ── 5) Tabelas que só o servidor usa (o service role ignora RLS; sem política = ninguém mais entra) ─
drop policy if exists "Enable all for tenant_users" on public.tenant_users;
drop policy if exists "Service role can manage all download jobs" on public.download_jobs;
drop policy if exists "Service role can manage all desktop builds" on public.desktop_builds;

-- ── 6) Instaladores oficiais: só super admin altera ─────────────────────────────────────────────
drop policy if exists "Authenticated users can delete downloads" on public.app_downloads;
drop policy if exists "Authenticated users can insert downloads" on public.app_downloads;
drop policy if exists "Authenticated users can update downloads" on public.app_downloads;
drop policy if exists "Authenticated users can view all downloads" on public.app_downloads;
create policy "Super admins gerenciam os instaladores"
  on public.app_downloads for all to authenticated
  using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_super_admin))
  with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_super_admin));
-- (a política "Anyone can view active downloads" continua: o público vê só os instaladores ativos)

-- ── 7) Limites do plano gratuito: de PERMISSIVAS (que concediam acesso) para RESTRITIVAS (que limitam) ──
-- Cada uma só é somada às políticas de membro/dono, em vez de abrir a inserção para qualquer conta Pro.
drop policy if exists "Free tier: max 1 workspace" on public.workspaces;
create policy "Free tier: max 1 workspace" on public.workspaces as restrictive for insert to authenticated
  with check (
    (select subscription_tier from public.profiles where id = auth.uid()) = 'pro'
    or (select count(*) from public.workspaces w where w.owner_id = auth.uid()) = 0
  );

drop policy if exists "Free tier: max 1 project per workspace" on public.projects;
create policy "Free tier: max 1 project per workspace" on public.projects as restrictive for insert to authenticated
  with check (
    (select pr.subscription_tier from public.profiles pr join public.workspaces w on w.owner_id = pr.id where w.id = projects.workspace_id) = 'pro'
    or (select count(*) from public.projects x where x.workspace_id = projects.workspace_id) = 0
  );

drop policy if exists "Free tier: max 4 ui_views per project" on public.ui_views;
create policy "Free tier: max 4 ui_views per project" on public.ui_views as restrictive for insert to authenticated
  with check (
    (select pr.subscription_tier from public.profiles pr
       join public.workspaces w on w.owner_id = pr.id
       join public.projects p on p.workspace_id = w.id
      where p.id = ui_views.project_id) = 'pro'
    or (select count(*) from public.ui_views v where v.project_id = ui_views.project_id) < 4
  );

-- ── 8) Funções de gatilho não precisam ser chamáveis pela API pública (/rest/v1/rpc/...) ─────────
-- Gatilhos continuam disparando (o EXECUTE só é conferido ao criar o gatilho). As funções usadas DENTRO das políticas
-- (has_project_access, is_workspace_member...) ficam como estão: as políticas as chamam em nome de quem pede.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_guest_profile_changes() from public, anon, authenticated;
revoke execute on function public.tr_assign_creator_to_project() from public, anon, authenticated;
revoke execute on function public.checkmeta_match_finished_trigger() from public, anon, authenticated;
revoke execute on function public.checkmeta_validate_move_time() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (rode depois de aplicar; todas as consultas abaixo devem terminar como indicado)
--
-- a) Nenhuma política aberta restante nas tabelas de configuração (deve voltar vazio):
--    select tablename, policyname from pg_policies
--     where schemaname='public'
--       and tablename in ('project_auth_config','ui_views','ui_components','ui_custom_components','project_roles',
--                         'project_role_permissions','project_user_roles','tenant_users','download_jobs','desktop_builds')
--       and (qual in ('true','(true)') or with_check in ('true','(true)') or qual like '%auth.role()%');
--
-- b) Conta comum não vira super admin (execute no SQL Editor simulando um usuário comum; deve dar o erro 42501):
--    begin; set local role authenticated; set local "request.jwt.claims" = '{"role":"authenticated","sub":"<UUID-DE-UM-USUARIO-COMUM>"}';
--    update public.profiles set is_super_admin = true where id = '<UUID-DE-UM-USUARIO-COMUM>'; rollback;
--
-- c) Visitante anônimo não lê a configuração (deve voltar 0 linhas):
--    begin; set local role anon; select count(*) from public.project_auth_config; select count(*) from public.ui_views; rollback;
--
-- d) Pelo navegador (F12, com a chave pública do app), cada pedido abaixo deve voltar [] ou 401/403:
--    fetch(`${SUPABASE_URL}/rest/v1/project_auth_config?select=*`, {headers:{apikey:ANON_KEY}}).then(r=>r.json()).then(console.log)
--    fetch(`${SUPABASE_URL}/rest/v1/ui_views?select=id`, {headers:{apikey:ANON_KEY}}).then(r=>r.json()).then(console.log)
--
-- e) Depois de aplicar, teste no app: Studio (abrir projeto, salvar caso de uso, Configurar Login), app publicado (login do
--    usuário final, uma tela, exportar), e "Central de Downloads" do admin.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
