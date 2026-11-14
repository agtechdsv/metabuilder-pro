-- Avisos de cobranca (e-mail e tela) feitos pelo PROPRIO MetaBuilder, sem pagar as notificacoes do Asaas. Desenho em docs/avisos-cobranca.md.
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main) ANTES de publicar as Edge Functions e o site. Pode rodar de novo.
--
-- O que faz:
--  1) payments.due_date: vencimento da cobranca (o webhook passa a gravar; os lembretes usam).
--  2) profiles.overdue_since: desde quando o cliente esta com cobranca vencida (a carencia conta a partir dai).
--  3) profiles.billing_language: idioma do cliente (pt, en ou es), gravado no checkout, para os avisos sairem no idioma dele.
--  4) billing_notices: fila de avisos (cliente e admin). Cada aviso e unico por (tipo, referencia): evento repetido do Asaas ou rotina
--     rodando de novo NUNCA manda o mesmo aviso duas vezes.
--  5) ajuste billing_notices em platform_settings: comeca DESLIGADO (enabled=false), entao nada muda ate o SuperAdmin ligar na aba Sistema.
--
-- Seguranca: billing_notices tem RLS ligada e SEM policy, e sem acesso para anon/authenticated. So o servidor (service_role) le e grava.

alter table public.payments add column if not exists due_date date;

alter table public.profiles add column if not exists overdue_since timestamptz;
alter table public.profiles add column if not exists billing_language text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_billing_language_chk') then
    alter table public.profiles add constraint profiles_billing_language_chk check (billing_language is null or billing_language in ('pt', 'en', 'es'));
  end if;
end $$;

create table if not exists public.billing_notices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,   -- vazio nos avisos para o admin
  kind        text not null,
  ref         text not null,                                      -- id do pagamento (ou usuario:data) que identifica o aviso
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts    integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create unique index if not exists billing_notices_kind_ref_uidx on public.billing_notices (kind, ref);
create index if not exists billing_notices_status_idx on public.billing_notices (status, created_at);
create index if not exists billing_notices_user_idx on public.billing_notices (user_id, created_at desc);

alter table public.billing_notices enable row level security;
revoke all on public.billing_notices from anon, authenticated;

insert into public.platform_settings (key, value) values
  ('billing_notices', '{"enabled": false, "graceDays": 3, "adminEmail": ""}'::jsonb)
on conflict (key) do nothing;
