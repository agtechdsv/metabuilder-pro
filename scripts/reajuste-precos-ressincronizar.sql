-- Refaz o recálculo das assinaturas do ÚLTIMO reajuste aplicado (24/11/2026: base 10 -> 6).
--
-- Por quê: o Asaas recusou o ajuste (valor mínimo de R$ 5,00 por cobrança; a campanha dava R$ 3,00) e a função antiga marcava o cliente como
-- "sincronizado" mesmo assim, então nunca tentava de novo. A função nova (price-change-apply) só marca se o Asaas aceitar, e o cálculo agora tem o
-- piso de R$ 5,00. Este script só devolve os clientes à fila; quem recalcula é a função.
--
-- Ordem: 1) rode o SQL abaixo no SQL Editor; 2) publique as Edge Functions (price-change-apply, asaas-checkout, asaas-update-subscription,
-- asaas-webhook, iclub-release: todas usam o pricing.ts) e o site; 3) Vercel > Settings > Cron Jobs > /api/cron/price-change > Run;
-- 4) confira no Asaas (Assinaturas e Cobranças) que a conta de campanha ficou em R$ 5,00.

update profiles set price_change_synced_id = null
 where asaas_subscription_id is not null and subscription_status <> 'canceled';

update pricing_changes set resync_done = false, updated_at = now()
 where id = (select id from pricing_changes where status = 'applied' order by applied_at desc limit 1);

-- conferência (esperado: 1 linha applied com resync_done = false; depois do Run do cron, resync_done = true e price_change_synced_id preenchido)
select id, status, applied_at, resync_done from pricing_changes order by created_at desc limit 1;
select subscription_status, subscription_amount, (price_change_synced_id is not null) sincronizada from profiles where asaas_subscription_id is not null and subscription_status <> 'canceled';
