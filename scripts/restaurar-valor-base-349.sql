-- Volta o valor base para R$ 349,00 depois dos testes de pagamento (a tela de Regras de Preços exige 30 dias de aviso para AUMENTAR, e
-- não há assinante real a avisar: a única assinatura ativa é a conta de teste MetaBuilder PRO).
--
-- Só rode isto enquanto NÃO houver cliente real com assinatura: a regra dos 30 dias existe para proteger quem paga. O bloco abaixo recusa
-- (e não altera nada) se houver mais de uma assinatura ativa.
--
-- Efeito na conta de teste de campanha: o promocional dela está TRAVADO em R$ 5,00 (campaign_unit_price), então a próxima cobrança continua
-- R$ 5,00 mesmo com a tabela em 349; os meses de campanha acabam e a renovação seguinte já sai pelo preço da tabela (R$ 349,00).
-- Por isso, cancele as assinaturas das contas de teste (Admin > Clientes > Cobranças > Cancelar assinatura) quando terminar de testar.

do $$
declare ativos int;
begin
  select count(*) into ativos from profiles where subscription_status = 'active' and asaas_subscription_id is not null;
  if ativos > 1 then
    raise exception 'Há % assinaturas ativas: use Reajustar (aviso de 30 dias) em vez deste script.', ativos;
  end if;
end $$;

-- 1) o valor base (os demais campos da regra ficam como estão: faixas de volume e descontos de ciclo)
update pricing_rules
   set base_price = 349, updated_at = now()
 where id = (select id from pricing_rules order by created_at desc limit 1);

-- 2) registra no histórico de reajustes (a tela "Reajustes anteriores" lê esta tabela), já aplicado e sem nada a recalcular
insert into pricing_changes (effective_on, notice_days, old_base_price, new_base_price, rules, status, applied_at, resync_done, note)
select (now() at time zone 'America/Sao_Paulo')::date, 0, 6, 349,
       jsonb_build_object('base_price', r.base_price, 'volume_tiers', r.volume_tiers, 'cycle_discounts', r.cycle_discounts),
       'applied', now(), true,
       'Restauração do valor de tabela após os testes de pagamento (sem assinantes reais afetados; feito por SQL)'
  from (select * from pricing_rules order by created_at desc limit 1) r;

-- conferência: base 349 e a última linha do histórico = 6 -> 349 aplicado
select base_price, updated_at from pricing_rules order by created_at desc limit 1;
select status, old_base_price, new_base_price, effective_on, applied_at, resync_done from pricing_changes order by created_at desc limit 3;
