-- iClub completo + campanhas (Black November). Rodar no SQL Editor do Supabase de PRODUCAO (projeto main). Pode rodar de novo.
--
-- O que faz:
--  1) pricing_campaigns: campanhas de preco (ex.: 50% nos 2 primeiros meses). Quem cria/edita e o SuperAdmin (pela tela /admin/platform, aba Planos);
--     a leitura e publica, EXCETO campanhas restritas a e-mails (allowed_emails), que so aparecem para esses e-mails e para o SuperAdmin (uso em teste).
--  2) profiles: a campanha que o cliente comprou fica GRAVADA na assinatura (mudar a campanha depois nao altera quem ja comprou) e quantos meses ja foram usados.
--  3) payments.campaign_counted: evita contar duas vezes o mesmo pagamento (o Asaas manda PAYMENT_CONFIRMED e PAYMENT_RECEIVED).
--  4) iclub_rewards / iclub_referrals: ligam a recompensa a indicacao, com carencia (release_at) e estados novos (pending, revoked, canceled).
--  5) platform_settings: teto do desconto de indicacao (30%) e carencia (7 dias), editaveis pelo SuperAdmin.

-- 1) campanhas -------------------------------------------------------------------------------------------------------------------------------
create table if not exists public.pricing_campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             jsonb not null,                          -- {"pt": "...", "en": "...", "es": "..."}
  headline         jsonb not null default '{}'::jsonb,       -- chamada curta para a faixa do site, nos 3 idiomas
  discount_percent numeric not null default 50 check (discount_percent > 0 and discount_percent <= 100),  -- % da tabela cobrado por licenca nos meses da campanha
  months           integer not null default 2 check (months >= 1 and months <= 36),                      -- meses de uso cobertos
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  is_active        boolean not null default true,
  allowed_emails   text[] not null default '{}',             -- vazio = todos; preenchido = so esses e-mails (teste)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.pricing_campaigns enable row level security;

drop policy if exists "Leitura das campanhas" on public.pricing_campaigns;
create policy "Leitura das campanhas" on public.pricing_campaigns
  for select to anon, authenticated
  using (
    cardinality(allowed_emails) = 0
    or lower(coalesce(auth.jwt() ->> 'email', '')) = any (select lower(e) from unnest(allowed_emails) e)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true)
  );
-- sem policy de escrita: quem grava e o servidor (service role), depois de checar que a pessoa e SuperAdmin.

-- 2) a campanha gravada na assinatura -------------------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists campaign_id          uuid references public.pricing_campaigns(id) on delete set null,
  add column if not exists campaign_percent     numeric,
  add column if not exists campaign_months      integer,
  add column if not exists campaign_licenses    integer,
  add column if not exists campaign_months_used integer not null default 0;

-- 3) pagamento contado uma vez ------------------------------------------------------------------------------------------------------------------
alter table public.payments add column if not exists campaign_counted boolean not null default false;

-- 4) recompensas ligadas a indicacao ------------------------------------------------------------------------------------------------------------
alter table public.iclub_rewards
  add column if not exists referral_id uuid references public.iclub_referrals(id) on delete set null,
  add column if not exists release_at  timestamptz;

alter table public.iclub_referrals add column if not exists paid_at timestamptz;

alter table public.iclub_rewards drop constraint if exists iclub_rewards_status_check;
alter table public.iclub_rewards add constraint iclub_rewards_status_check
  check (status = any (array['pending','active','applied','expired','revoked']));

alter table public.iclub_referrals drop constraint if exists iclub_referrals_status_check;
alter table public.iclub_referrals add constraint iclub_referrals_status_check
  check (status = any (array['registered','subscribed','reward_applied','canceled']));

-- uma recompensa de desconto por indicacao (o webhook do Asaas pode repetir o evento)
create unique index if not exists iclub_rewards_one_discount_per_referral
  on public.iclub_rewards (referral_id) where reward_type = 'percent_discount' and referral_id is not null;

-- 5) ajustes globais do iClub --------------------------------------------------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), updated_by uuid
);
alter table public.platform_settings enable row level security;
drop policy if exists "Todos leem os ajustes da plataforma" on public.platform_settings;
create policy "Todos leem os ajustes da plataforma" on public.platform_settings for select to authenticated using (true);

insert into public.platform_settings (key, value) values
  ('iclub_referral_cap_percent', '{"percent": 30}'::jsonb),
  ('iclub_grace_days',           '{"days": 7}'::jsonb)
on conflict (key) do nothing;
