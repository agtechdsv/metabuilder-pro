-- Reconcilia o pagamento de teste do LGPD (Pix da cobrança de 16/12/2026, pay_x66on5rkt3wxmu57, R$ 5,00, recebido em 21/11/2026).
-- O Asaas recebeu o pagamento e o perfil ficou PRO, mas a linha em payments NÃO foi gravada: a coluna external_reference é única e o Asaas repete a
-- referência da assinatura nas renovações, então o insert do webhook falhou em silêncio (corrigido no webhook; ver docs/avisos-cobranca.md).
-- Gravando a linha como "paga", a trigger da fila de NFS-e enfileira a nota. A data de emissão = hoje + o prazo de espera dos ajustes:
-- para testar a emissão já, defina o prazo em 0 em Clientes > Notas Fiscais ANTES de rodar este script.
-- Pode rodar mais de uma vez (não duplica).

insert into public.payments (user_id, cycle, amount, status, external_reference, billing_type, asaas_payment_id, due_date, webhook_received_at, webhook_processed)
select p.user_id, p.cycle, 5.00, 'paid', p.external_reference || '~pay_x66on5rkt3wxmu57', 'PIX', 'pay_x66on5rkt3wxmu57', date '2026-12-16', now(), true
from public.payments p
where p.asaas_payment_id = 'pay_yb7nx3ubeua5e8rt'
  and not exists (select 1 from public.payments x where x.asaas_payment_id = 'pay_x66on5rkt3wxmu57');

-- Conferência: a linha nova e a nota na fila
select id, status, amount, due_date, asaas_payment_id from public.payments where asaas_payment_id in ('pay_yb7nx3ubeua5e8rt', 'pay_x66on5rkt3wxmu57');
select status, amount, emit_on, customer_name from public.mb_nfse_queue order by created_at desc limit 3;
