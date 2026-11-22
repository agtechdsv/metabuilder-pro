-- Cobrancas do SuperAdmin (Fase 2): registro de tudo que o admin faz em cobrancas, assinaturas e estornos.
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main). Pode rodar de novo: tudo e "if not exists".
--
-- O que faz:
--  mb_admin_billing_log: uma linha por acao do SuperAdmin pela tela Clientes > Cobrancas (cancelar cobranca, cancelar assinatura, estornar).
--   - a Edge Function admin-cancel-billing grava a linha ANTES de falar com o Asaas e a fecha depois (done ou failed); sem esta tabela ela
--     recusa a acao, para nunca agir sem deixar registro;
--   - o estorno fica "requested" ate o Asaas avisar (webhook PAYMENT_REFUNDED = done, PAYMENT_REFUND_DENIED = failed);
--   - sem FK de proposito: o registro tem de sobreviver ao pagamento e ao usuario.
--
-- Acesso: so o servidor (service role). Nenhum usuario, nem o SuperAdmin pelo navegador, le ou grava direto.

create table if not exists public.mb_admin_billing_log (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  actor_id               uuid not null,                       -- o SuperAdmin que fez (vem da sessao, nunca do corpo do pedido)
  action                 text not null check (action in ('cancel_charge', 'cancel_subscription', 'refund')),
  user_id                uuid,                                -- o cliente
  payment_id             uuid,                                -- payments.id
  asaas_payment_id       text,
  asaas_subscription_id  text,
  amount                 numeric(12,2),
  reason                 text,
  status                 text not null default 'requested' check (status in ('requested', 'done', 'failed')),
  detail                 jsonb not null default '{}'::jsonb   -- resposta ou erro do Asaas, e o que mais ajudar a entender depois
);

create index if not exists mb_admin_billing_log_payment_idx on public.mb_admin_billing_log (payment_id, created_at desc);
create index if not exists mb_admin_billing_log_asaas_idx   on public.mb_admin_billing_log (asaas_payment_id);
create index if not exists mb_admin_billing_log_user_idx    on public.mb_admin_billing_log (user_id, created_at desc);

alter table public.mb_admin_billing_log enable row level security;   -- sem politicas: so o servidor (service_role) le e grava
revoke all on public.mb_admin_billing_log from public, anon, authenticated;
grant all on public.mb_admin_billing_log to service_role;

-- Conferencia: a tabela existe e esta vazia.
select count(*) as acoes_registradas from public.mb_admin_billing_log;
