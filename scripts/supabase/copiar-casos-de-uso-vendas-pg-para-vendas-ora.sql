-- =====================================================================================================================
-- Copia TODOS os casos de uso do projeto "Vendas PG" (slug vendas-pg, Postgres) para o projeto "Vendas ORA" (slug vendas-ora, Oracle).
--
-- Rodar no SQL Editor do Supabase (o script inteiro de uma vez). É um bloco só (DO): se qualquer conferência no fim falhar, NADA é gravado.
--
-- O que o script faz:
--   1. Apaga, no Vendas ORA, os casos de uso que têm o mesmo slug de um do Vendas PG (as chaves estrangeiras apagam junto os componentes
--      de tela e as permissões por tela desses casos de uso). Os casos de uso do Vendas ORA que não existem no Vendas PG ficam como estão.
--   2. Copia cada caso de uso (ui_views) e seus componentes (ui_components) trocando:
--        - os UUIDs de tabelas e campos do Vendas PG pelos do Vendas ORA (as 14 tabelas e as 129 colunas casam por nome, sem diferenciar maiúsculas);
--        - os nomes de tabelas e colunas que aparecem como VALOR dentro dos JSONs (ex.: "nome_empresa" -> "NOME_EMPRESA"), porque o Oracle usa maiúsculas.
--   3. Cria no Vendas ORA as enumerações que só existem no Vendas PG (hoje: PrioridadeTarefas) e troca também os ids de enumerações e de
--      relações que as telas guardam (rel_table, relation_id).
--   4. (opcional, ligado) Copia a regra de acesso por linha das tabelas (clientes, pedidos, itens_pedido), com coluna e atributo em maiúsculas.
--
-- O que o script NÃO faz:
--   - não mexe em tabelas, campos, relações, usuários, permissões do app, nem no banco Oracle;
--   - não copia o caso de uso criado por IA (gerenciamento-produtos): o código dele foi gerado para Postgres. Para copiar, troque
--     v_copiar_ia para true (depois confira se ele abre no Oracle);
--   - não copia o caso de uso se faltar no Vendas ORA a tabela ou a coluna correspondente: nesse caso o script PARA com a lista do que falta.
--
-- Antes de rodar: faça um backup/exportação dos casos de uso atuais do Vendas ORA se quiser poder voltar atrás.
-- =====================================================================================================================

do $$
declare
  v_copiar_ia        boolean := false;  -- true = copia também o caso de uso criado por IA (gerenciamento-produtos)
  v_copiar_politicas boolean := true;   -- false = não copia a regra de acesso por linha das tabelas

  pgp   uuid;
  orap  uuid;
  m     record;
  n_modelos_pg int; n_modelos_ora int; n_campos_pg int; n_campos_ora int;
  n_views int; n_comps int; n_enums int; n_pol int;
  faltando text;
begin
  select id into pgp  from projects where slug = 'vendas-pg';
  select id into orap from projects where slug = 'vendas-ora';
  if pgp is null or orap is null then raise exception 'Projeto não encontrado (vendas-pg: %, vendas-ora: %)', pgp, orap; end if;

  -- 0) as tabelas e colunas do Vendas PG precisam existir no Vendas ORA (por nome, sem diferenciar maiúsculas)
  select string_agg(ma.db_table_name, ', ') into faltando
    from models ma where ma.project_id = pgp
     and not exists (select 1 from models mb where mb.project_id = orap and upper(mb.db_table_name) = upper(ma.db_table_name));
  if faltando is not null then raise exception 'Tabelas do Vendas PG que não existem no Vendas ORA: %', faltando; end if;

  select string_agg(ma.db_table_name || '.' || fa.db_column_name, ', ') into faltando
    from fields fa join models ma on ma.id = fa.model_id and ma.project_id = pgp
   where not exists (
     select 1 from models mb join fields fb on fb.model_id = mb.id
      where mb.project_id = orap and upper(mb.db_table_name) = upper(ma.db_table_name) and upper(fb.db_column_name) = upper(fa.db_column_name));
  if faltando is not null then raise exception 'Colunas do Vendas PG que não existem no Vendas ORA: %', faltando; end if;

  -- 1) enumerações que só existem no Vendas PG (antes do mapa, para o id novo entrar na troca)
  insert into project_enumerations (project_id, name, description, "values")
    select orap, e.name, e.description, e."values" from project_enumerations e
     where e.project_id = pgp and not exists (select 1 from project_enumerations o where o.project_id = orap and o.name = e.name);
  get diagnostics n_enums = row_count;

  -- 1b) campos que no Vendas PG estão ligados a uma enumeração e no Vendas ORA ainda não (hoje: tarefas.prioridade): copia a ligação com o id da enumeração do Vendas ORA
  update fields fb
     set widget_options = (select replace(fa.widget_options::text, ea.id::text, eb.id::text)::jsonb
                             from project_enumerations ea join project_enumerations eb on eb.project_id = orap and eb.name = ea.name
                            where ea.project_id = pgp and fa.widget_options::text like '%' || ea.id::text || '%' limit 1)
    from fields fa
    join models ma on ma.id = fa.model_id and ma.project_id = pgp
    join models mb on mb.project_id = orap and upper(mb.db_table_name) = upper(ma.db_table_name)
   where fb.model_id = mb.id and upper(fb.db_column_name) = upper(fa.db_column_name)
     and exists (select 1 from project_enumerations ea where ea.project_id = pgp and fa.widget_options::text like '%' || ea.id::text || '%')
     and not exists (select 1 from project_enumerations eb where eb.project_id = orap and fb.widget_options::text like '%' || eb.id::text || '%');

  -- 2) mapa de trocas: UUIDs de tabelas, campos, enumerações e relações; depois nomes de tabelas e colunas
  create temp table _mb_map (rn serial, kind text, a text, b text) on commit drop;
  insert into _mb_map (kind, a, b)
    select 'id', ma.id::text, mb.id::text from models ma join models mb on upper(mb.db_table_name) = upper(ma.db_table_name) and mb.project_id = orap where ma.project_id = pgp;
  insert into _mb_map (kind, a, b)
    select 'id', fa.id::text, fb.id::text
      from fields fa join models ma on ma.id = fa.model_id and ma.project_id = pgp
      join models mb on mb.project_id = orap and upper(mb.db_table_name) = upper(ma.db_table_name)
      join fields fb on fb.model_id = mb.id and upper(fb.db_column_name) = upper(fa.db_column_name);
  -- enumerações (a tela guarda o id da enumeração em rel_table) e relações (relation_id nos caminhos de detalhe), casadas por nome / pelos campos das pontas
  insert into _mb_map (kind, a, b)
    select 'id', ea.id::text, eb.id::text from project_enumerations ea join project_enumerations eb on eb.project_id = orap and eb.name = ea.name where ea.project_id = pgp;
  insert into _mb_map (kind, a, b)
    select 'id', ra.id::text, rb.id::text
      from relations ra
      join _mb_map f1 on f1.kind = 'id' and f1.a = ra.from_field_id::text
      join _mb_map f2 on f2.kind = 'id' and f2.a = ra.to_field_id::text
      join relations rb on rb.project_id = orap and rb.from_field_id::text = f1.b and rb.to_field_id::text = f2.b
     where ra.project_id = pgp;
  insert into _mb_map (kind, a, b)
    select 'nome', n, upper(n) from (
      select ma.db_table_name n from models ma where ma.project_id = pgp
      union select fa.db_column_name from fields fa join models ma on ma.id = fa.model_id and ma.project_id = pgp) q
     where n <> upper(n);

  -- 3) textos a converter: uma linha por JSON de caso de uso e por componente
  create temp table _mb_views (pid uuid primary key, nid uuid not null default gen_random_uuid()) on commit drop;
  insert into _mb_views (pid)
    select v.id from ui_views v where v.project_id = pgp and (v_copiar_ia or v.slug <> 'gerenciamento-produtos');

  create temp table _mb_src (tipo text, chave uuid, t text, primary key (tipo, chave)) on commit drop;
  insert into _mb_src select 'layout',  v.id, v.layout_config::text  from ui_views v join _mb_views mv on mv.pid = v.id;
  insert into _mb_src select 'tables',  v.id, v.tables_config::text  from ui_views v join _mb_views mv on mv.pid = v.id where v.tables_config is not null;
  insert into _mb_src select 'buttons', v.id, v.buttons_config::text from ui_views v join _mb_views mv on mv.pid = v.id where v.buttons_config is not null;
  insert into _mb_src select 'draft',   v.id, v.draft_config::text   from ui_views v join _mb_views mv on mv.pid = v.id where v.draft_config is not null;
  insert into _mb_src select 'comp',    c.id, c.config::text         from ui_components c join _mb_views mv on mv.pid = c.view_id where c.config is not null;

  for m in select kind, a, b from _mb_map order by rn loop
    if m.kind = 'id' then
      update _mb_src set t = replace(t, m.a, m.b) where position(m.a in t) > 0;
    else
      -- só quando o nome aparece como VALOR (entre aspas e sem ":" depois), nunca como chave do JSON
      update _mb_src set t = regexp_replace(t, '"' || m.a || '"(?!\s*:)', '"' || m.b || '"', 'g') where position('"' || m.a || '"' in t) > 0;
    end if;
  end loop;

  -- 4) apaga no Vendas ORA os casos de uso que serão substituídos (componentes e permissões por tela saem em cascata)
  delete from ui_views dv
   where dv.project_id = orap
     and dv.slug in (select v.slug from ui_views v join _mb_views mv on mv.pid = v.id);

  -- 5) casos de uso
  insert into ui_views (id, project_id, model_id, name, slug, view_type, layout_config, icon, is_public, created_at, logic_type, has_arguments,
                        tables_config, query_type, custom_query, buttons_config, status, draft_config)
    select mv.nid, orap,
           (select mm.b::uuid from _mb_map mm where mm.kind = 'id' and mm.a = v.model_id::text),
           v.name, v.slug, v.view_type,
           (select s.t::jsonb from _mb_src s where s.tipo = 'layout'  and s.chave = v.id),
           v.icon, v.is_public, now(), v.logic_type, v.has_arguments,
           (select s.t::jsonb from _mb_src s where s.tipo = 'tables'  and s.chave = v.id),
           v.query_type, v.custom_query,
           (select s.t::jsonb from _mb_src s where s.tipo = 'buttons' and s.chave = v.id),
           v.status,
           (select s.t::jsonb from _mb_src s where s.tipo = 'draft'   and s.chave = v.id)
      from ui_views v join _mb_views mv on mv.pid = v.id;
  get diagnostics n_views = row_count;

  -- 6) componentes de tela
  insert into ui_components (id, view_id, field_id, component_type, label, order_index, is_visible, is_readonly, is_required, width_cols, config, created_at)
    select gen_random_uuid(), mv.nid,
           (select mm.b::uuid from _mb_map mm where mm.kind = 'id' and mm.a = c.field_id::text),
           c.component_type, c.label, c.order_index, c.is_visible, c.is_readonly, c.is_required, c.width_cols,
           (select s.t::jsonb from _mb_src s where s.tipo = 'comp' and s.chave = c.id),
           now()
      from ui_components c join _mb_views mv on mv.pid = c.view_id;
  get diagnostics n_comps = row_count;

  -- 7) regra de acesso por linha: a coluna, o atributo (coluna da tabela de usuários, ex.: id -> ID) e a tabela relacionada, em maiúsculas
  n_pol := 0;
  if v_copiar_politicas then
    update models mo
       set row_policy = pm.row_policy || jsonb_build_object('rules', (
         select jsonb_agg(
                  r || jsonb_build_object('column', upper(r->>'column'))
                    || case when r ? 'attr' then jsonb_build_object('attr', upper(r->>'attr')) else '{}'::jsonb end
                    || case when r->'bypass' ? 'attr' then jsonb_build_object('bypass', (r->'bypass') || jsonb_build_object('attr', upper(r->'bypass'->>'attr'))) else '{}'::jsonb end
                    || case when r ? 'related'
                            then jsonb_build_object('related', jsonb_build_object('table', upper(r->'related'->>'table'), 'key', upper(r->'related'->>'key'), 'column', upper(r->'related'->>'column')))
                            else '{}'::jsonb end)
           from jsonb_array_elements(pm.row_policy->'rules') r))
      from models pm
     where pm.project_id = pgp and pm.row_policy is not null and jsonb_typeof(pm.row_policy->'rules') = 'array'
       and mo.project_id = orap and upper(mo.db_table_name) = upper(pm.db_table_name);
    get diagnostics n_pol = row_count;
  end if;

  -- 8) conferências: se algo não bater, o bloco inteiro é desfeito
  select count(*) into n_modelos_pg  from models where project_id = pgp;
  select count(*) into n_modelos_ora from models where project_id = orap;
  select count(*) into n_campos_pg  from fields f join models mm on mm.id = f.model_id where mm.project_id = pgp;
  select count(*) into n_campos_ora from fields f join models mm on mm.id = f.model_id where mm.project_id = orap;
  if n_modelos_pg <> n_modelos_ora or n_campos_pg <> n_campos_ora then raise exception 'As tabelas ou campos mudaram durante a cópia'; end if;

  if (select count(*) from ui_views where project_id = orap and slug in (select slug from ui_views where project_id = pgp)) <> n_views then
    raise exception 'Quantidade de casos de uso copiados não bate';
  end if;
  if n_comps <> (select count(*) from ui_components c join _mb_views mv on mv.pid = c.view_id) then
    raise exception 'Quantidade de componentes copiados não bate';
  end if;
  -- nenhum UUID do Vendas PG pode ter ficado nos casos de uso copiados
  if exists (select 1 from ui_views v, _mb_map mm where v.project_id = orap and mm.kind = 'id' and (v.layout_config::text like '%' || mm.a || '%' or coalesce(v.tables_config::text, '') like '%' || mm.a || '%')) then
    raise exception 'Sobrou UUID do Vendas PG dentro dos casos de uso copiados';
  end if;

  raise notice 'Casos de uso copiados: %, componentes: %, enumerações criadas: %, tabelas com regra por linha: %', n_views, n_comps, n_enums, n_pol;
end
$$;
