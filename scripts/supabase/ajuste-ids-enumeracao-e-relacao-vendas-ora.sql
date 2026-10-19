-- Ajuste para quem JÁ rodou a primeira versão da cópia: troca, nos casos de uso e componentes do Vendas ORA, os ids de ENUMERAÇÕES e de RELAÇÕES
-- do Vendas PG pelos equivalentes do Vendas ORA (casados por nome da enumeração e pelos campos das pontas da relação), e liga ao Vendas ORA o campo
-- tarefas.prioridade à enumeração PrioridadeTarefas (no Vendas PG ele já é uma lista dessa enumeração).
-- Não apaga nem recria nada; só reescreve o texto dos JSONs que ainda têm esses ids. Pode rodar mais de uma vez.
do $$
declare
  pgp uuid; orap uuid; m record; n int := 0; k int;
begin
  select id into pgp  from projects where slug = 'vendas-pg';
  select id into orap from projects where slug = 'vendas-ora';
  if pgp is null or orap is null then raise exception 'Projeto não encontrado'; end if;

  for m in
    select ea.id::text a, eb.id::text b from project_enumerations ea join project_enumerations eb on eb.project_id = orap and eb.name = ea.name where ea.project_id = pgp
    union all
    select ra.id::text, rb.id::text
      from relations ra
      join fields fa1 on fa1.id = ra.from_field_id join models ma1 on ma1.id = fa1.model_id
      join fields fa2 on fa2.id = ra.to_field_id   join models ma2 on ma2.id = fa2.model_id
      join models mb1 on mb1.project_id = orap and upper(mb1.db_table_name) = upper(ma1.db_table_name)
      join fields fb1 on fb1.model_id = mb1.id and upper(fb1.db_column_name) = upper(fa1.db_column_name)
      join models mb2 on mb2.project_id = orap and upper(mb2.db_table_name) = upper(ma2.db_table_name)
      join fields fb2 on fb2.model_id = mb2.id and upper(fb2.db_column_name) = upper(fa2.db_column_name)
      join relations rb on rb.project_id = orap and rb.from_field_id = fb1.id and rb.to_field_id = fb2.id
     where ra.project_id = pgp
  loop
    update ui_views set layout_config = replace(layout_config::text, m.a, m.b)::jsonb where project_id = orap and layout_config::text like '%' || m.a || '%';
    get diagnostics k = row_count; n := n + k;
    update ui_views set tables_config = replace(tables_config::text, m.a, m.b)::jsonb where project_id = orap and tables_config::text like '%' || m.a || '%';
    update ui_views set buttons_config = replace(buttons_config::text, m.a, m.b)::jsonb where project_id = orap and buttons_config::text like '%' || m.a || '%';
    update ui_views set draft_config = replace(draft_config::text, m.a, m.b)::jsonb where project_id = orap and draft_config::text like '%' || m.a || '%';
    update ui_components c set config = replace(c.config::text, m.a, m.b)::jsonb
     where c.view_id in (select id from ui_views where project_id = orap) and c.config::text like '%' || m.a || '%';
    get diagnostics k = row_count; n := n + k;
  end loop;
  --  campos que no Vendas PG estão ligados a uma enumeração e no Vendas ORA ainda não (hoje: tarefas.prioridade): copia a ligação com o id da enumeração do Vendas ORA
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

  raise notice 'Trocas feitas (linhas de casos de uso e componentes atualizadas): %', n;
end
$$;
