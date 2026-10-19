-- Ajuste para quem JÁ rodou a primeira versão do script: põe em maiúsculas o atributo (coluna da tabela de usuários) das regras por linha do Vendas ORA.
update models m
   set row_policy = m.row_policy || jsonb_build_object('rules', (
     select jsonb_agg(
              r || case when r ? 'attr' then jsonb_build_object('attr', upper(r->>'attr')) else '{}'::jsonb end
                || case when r->'bypass' ? 'attr' then jsonb_build_object('bypass', (r->'bypass') || jsonb_build_object('attr', upper(r->'bypass'->>'attr'))) else '{}'::jsonb end)
       from jsonb_array_elements(m.row_policy->'rules') r))
 where m.project_id = (select id from projects where slug = 'vendas-ora')
   and m.row_policy is not null and jsonb_typeof(m.row_policy->'rules') = 'array';
