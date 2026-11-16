-- =====================================================================================================================
-- Teste acelerado dos avisos de cobrança (roteiro C5), SÓ PARA CONTA DE TESTE.
--
-- A rotina de avisos decide pelo que está na NOSSA base: payments.status/due_date (lembretes e vencida) e profiles.overdue_since
-- (carência e suspensão). Este script muda esses campos do cliente de teste para simular os dias passando, sem esperar o Asaas.
-- O que ele NÃO testa: o evento real "vencida" do Asaas (PAYMENT_OVERDUE). Esse só o tempo real prova (deixe outra conta sem pagar).
--
-- COMO USAR
--  1. Crie a conta de teste, vá ao checkout, gere o Pix (1 licença) e NÃO pague. Mantenha a tela do Pix/fatura à mão.
--  2. Troque EMAIL_DO_TESTE pelo e-mail dessa conta em TODO o arquivo (Ctrl+H no editor). Confira que os avisos estão Ligados.
--  3. Rode UM passo por vez (selecione só o bloco e clique em Run). Depois de cada passo, dispare a rotina e confira o e-mail:
--
--       $s = Read-Host "CRON_SECRET" -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); Invoke-RestMethod -Uri "https://www.metabuilderpro.com/api/cron/billing-notices" -Headers @{ Authorization = "Bearer $p" }
--
--  4. Ao fim, pague o Pix que continua aberto no Asaas (passo 6) e depois exclua/bloqueie a conta de teste pelo app (cancela a cobrança).
--
-- O arquivo não grava nada fora dessa conta. Cada aviso é único por cobrança e tipo: rodar a rotina duas vezes no mesmo passo não repete o e-mail.
-- Carência: os passos 4 e 5 supõem 3 dias (padrão da aba Sistema). Se mudou a carência, ajuste os intervalos de overdue_since.
-- =====================================================================================================================


-- PASSO 0: ver o estado (rode primeiro). Copie o invoice_url: é o Pix que você vai pagar no passo 6.
select p.id, p.status, p.amount, p.billing_type, p.due_date, p.asaas_payment_id, p.invoice_url
  from public.payments p join public.profiles u on u.id = p.user_id
 where lower(u.email) = lower('EMAIL_DO_TESTE') order by p.created_at desc;

select subscription_status, is_blocked, overdue_since from public.profiles where lower(email) = lower('EMAIL_DO_TESTE');


-- PASSO 1: vence em 3 dias. Rotina => e-mail "3 dias antes do vencimento" (reminder_3d).
update public.payments set status = 'pending', due_date = current_date + 3, updated_at = now()
 where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_DO_TESTE')) and status in ('pending', 'overdue')
returning id, status, due_date;


-- PASSO 2: vence hoje. Rotina => e-mail "vence hoje" (reminder_due).
update public.payments set status = 'pending', due_date = current_date, updated_at = now()
 where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_DO_TESTE')) and status in ('pending', 'overdue')
returning id, status, due_date;


-- PASSO 3: venceu há 1 dia (atraso começou agora há 1 dia). Rotina => e-mail "vencida" (overdue_1d).
-- Na tela do cliente (/client/dashboard e /workspace) aparece o BANNER VERMELHO com a data da suspensão. Ele ainda NÃO é suspenso.
update public.payments set status = 'overdue', due_date = current_date - 1, updated_at = now()
 where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_DO_TESTE')) and status in ('pending', 'overdue')
returning id, status, due_date;
update public.profiles set overdue_since = now() - interval '1 day'
 where lower(email) = lower('EMAIL_DO_TESTE')
returning subscription_status, is_blocked, overdue_since;


-- PASSO 4: venceu há 3 dias, ainda dentro da carência de 3 dias. Rotina => e-mail "vencida há 3 dias" (overdue_3d). Continua SEM suspender.
update public.payments set status = 'overdue', due_date = current_date - 3, updated_at = now()
 where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_DO_TESTE')) and status in ('pending', 'overdue')
returning id, status, due_date;
update public.profiles set overdue_since = now() - interval '2 days'
 where lower(email) = lower('EMAIL_DO_TESTE')
returning subscription_status, is_blocked, overdue_since;


-- PASSO 5: a carência acabou. Rotina => SUSPENSÃO (status blocked) e e-mail "conta suspensa" (suspended).
update public.profiles set overdue_since = now() - interval '3 days 1 hour'
 where lower(email) = lower('EMAIL_DO_TESTE')
returning subscription_status, is_blocked, overdue_since;
-- depois da rotina, confira:
-- select subscription_status, is_blocked, overdue_since from public.profiles where lower(email) = lower('EMAIL_DO_TESTE');


-- PASSO 6: pagar depois de suspenso. Pague o Pix do invoice_url do passo 0 (ele continua aberto no Asaas, com o vencimento original).
-- Esperado: acesso volta (active, is_blocked false, overdue_since vazio) e chega o recibo "restabelecido" (payment_received com wasSuspended).
-- select subscription_status, is_blocked, overdue_since from public.profiles where lower(email) = lower('EMAIL_DO_TESTE');


-- CONFERIR OS AVISOS desta conta, a qualquer momento (esperado, na ordem dos passos: reminder_3d, reminder_due, overdue_1d, overdue_3d,
-- suspended, payment_received, todos com status sent; invoice_created só aparece se o Asaas mandou o evento de cobrança criada):
select kind, status, attempts, last_error, to_char(created_at, 'DD/MM HH24:MI:SS') as criado, to_char(sent_at, 'HH24:MI:SS') as enviado
  from public.billing_notices
 where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_DO_TESTE'))
 order by created_at;
