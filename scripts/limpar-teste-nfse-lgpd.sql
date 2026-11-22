-- Desfaz a reconciliacao manual do pagamento de dezembro do LGPD (pay_x66on5rkt3wxmu57), para refazer o teste pelo processo normal.
-- Rode no SQL Editor do Supabase. A nota na fila nao tem FK com payments: apague as duas linhas.
-- O dinheiro continua recebido no Asaas; so some o registro aqui (historico e fila de NFS-e).

delete from public.mb_nfse_queue
 where payment_id = '8c72a89a-1792-4833-9dd9-38a4b06a7c1d'
   and status = 'pending';          -- so apaga se a nota ainda nao foi emitida

delete from public.payments
 where id = '8c72a89a-1792-4833-9dd9-38a4b06a7c1d'
   and asaas_payment_id = 'pay_x66on5rkt3wxmu57';

-- Conferencia: a cobranca de 16/11 deve continuar overdue e a de dezembro nao deve mais existir aqui.
select id, status, amount, due_date, asaas_payment_id from public.payments
 where asaas_payment_id in ('pay_yb7nx3ubeua5e8rt', 'pay_x66on5rkt3wxmu57');
select count(*) as notas_na_fila from public.mb_nfse_queue where asaas_payment_id = 'pay_x66on5rkt3wxmu57';
