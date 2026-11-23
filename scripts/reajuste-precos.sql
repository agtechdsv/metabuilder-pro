-- Reajuste de preços AGENDADO e preço promocional TRAVADO (rodar no SQL Editor do Supabase; é seguro rodar mais de uma vez).
--
--  1) pricing_changes: reajustes agendados pelo SuperAdmin (Regras de Preços > Reajustar). O novo valor só passa a valer na data de vigência, e só
--     nas cobranças com vencimento a partir dela (o período já pago não muda). Só pode haver UM reajuste agendado por vez.
--  2) profiles.campaign_unit_price: o preço promocional por licença/mês que o cliente viu ao comprar na campanha (base x % da campanha). Fica travado:
--     um reajuste da tabela não altera o que ele paga nos meses promocionais que restam. Quem já comprou em campanha recebe o valor de hoje aqui.
--  3) profiles.price_change_synced_id: qual reajuste já foi recalculado na assinatura do cliente (a rotina que aplica o reajuste anda em lotes).
--
-- Segurança: a tabela tem RLS ligada e SEM policy, e sem acesso para anon/authenticated. Só o servidor (service_role) lê e grava.

create table if not exists public.pricing_changes (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null,
  effective_on   date not null,
  notice_days    integer not null check (notice_days >= 0),
  old_base_price numeric(12,2) not null,
  new_base_price numeric(12,2) not null check (new_base_price > 0),
  rules          jsonb not null,
  status         text not null default 'scheduled' check (status in ('scheduled', 'applied', 'canceled')),
  notified_at    timestamptz,
  applied_at     timestamptz,
  resync_done    boolean not null default false,
  canceled_at    timestamptz,
  note           text
);

create unique index if not exists pricing_changes_one_scheduled_uidx on public.pricing_changes ((true)) where status = 'scheduled';
create index if not exists pricing_changes_status_idx on public.pricing_changes (status, effective_on);

alter table public.pricing_changes enable row level security;
revoke all on public.pricing_changes from public, anon, authenticated;
grant all on public.pricing_changes to service_role;

alter table public.profiles add column if not exists campaign_unit_price numeric(12,2);
alter table public.profiles add column if not exists price_change_synced_id uuid;

-- Quem já comprou em campanha: trava o preço promocional com a tabela de hoje (antes do primeiro reajuste).
update public.profiles p
   set campaign_unit_price = round(r.base_price * p.campaign_percent / 100, 2)
  from (select base_price from public.pricing_rules order by created_at desc limit 1) r
 where p.campaign_id is not null and p.campaign_percent is not null and p.campaign_unit_price is null;
