-- Programa de parceiros (indicador com comissao). Desenho em docs/parceiros-desenho.md.
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main). Pode rodar de novo: tudo e "create if not exists" / "create or replace".
--
-- O que faz:
--  1) partners: o cadastro do parceiro (uma pessoa/empresa que ja tem login no MetaBuilder). Codigo proprio, chave Pix e % de comissao opcional.
--  2) partner_referrals: quem o parceiro indicou (pelo link/codigo). Um e-mail so tem UM parceiro.
--  3) partner_commissions: uma linha por pagamento confirmado do indicado (% sobre o valor PAGO pelo cliente, o bruto). Nasce "pending" e
--     so fica disponivel depois da carencia (release_at). Estorno revoga; se ja foi pago, vira "clawback" e e descontado do proximo lote.
--  4) partner_payouts / partner_payout_items: lotes de pagamento por Pix, montados pelo SuperAdmin. Cada item vira uma transferencia no Asaas.
--  5) funcoes mb_partner_*: criar o lote (atomico, trava as comissoes), concluir ou falhar um item. So o servidor (service_role) chama.
--  6) ajustes globais em platform_settings (so o SuperAdmin muda): % padrao, carencia, valor minimo do lote, teto do lote.
--
-- Seguranca: nenhuma tabela tem policy (RLS ligada e sem acesso para anon/authenticated). Tudo passa por server actions e Edge Functions,
-- que conferem quem esta agindo (sessao do SuperAdmin ou do proprio parceiro) antes de ler ou gravar.

-- 1) ajustes globais ---------------------------------------------------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('partner_default_percent', '{"percent": 15}'::jsonb),   -- % de comissao padrao sobre o valor pago pelo cliente (cada parceiro pode ter o seu); o SuperAdmin muda na tela
  ('partner_grace_days',      '{"days": 7}'::jsonb),        -- carencia: dias entre o pagamento e a comissao ficar disponivel
  ('partner_min_payout',      '{"amount": 50}'::jsonb),     -- valor minimo para pagar um parceiro num lote (R$)
  ('partner_payout_cap',      '{"amount": 5000}'::jsonb)    -- teto de um lote inteiro (R$): trava de seguranca
on conflict (key) do nothing;

-- 2) parceiros ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.partners (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete restrict,
  name                text not null,
  document            text,                                   -- CPF ou CNPJ (so para o SuperAdmin conferir; nao aparece em tela de cliente)
  pix_key             text,
  pix_key_type        text check (pix_key_type in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  code                text not null,                          -- codigo do link de indicacao (sempre em maiusculas)
  commission_percent  numeric check (commission_percent >= 0 and commission_percent <= 100),  -- vazio = usa o padrao global
  status              text not null default 'active' check (status in ('active', 'suspended')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists partners_code_uidx on public.partners (upper(code));

-- 3) indicados ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.partner_referrals (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete restrict,
  referred_id     uuid,
  referred_email  text not null,
  status          text not null default 'registered' check (status in ('registered', 'subscribed', 'canceled')),
  paid_at         timestamptz,
  canceled_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists partner_referrals_email_uidx on public.partner_referrals (lower(referred_email));
create index if not exists partner_referrals_partner_idx on public.partner_referrals (partner_id, status);
create index if not exists partner_referrals_referred_idx on public.partner_referrals (referred_id);

-- 4) lotes de pagamento ------------------------------------------------------------------------------------------------------------------
create table if not exists public.partner_payouts (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'processing' check (status in ('processing', 'done', 'partial', 'failed')),
  total       numeric not null default 0,
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.partner_payout_items (
  id                 uuid primary key default gen_random_uuid(),
  payout_id          uuid not null references public.partner_payouts(id) on delete cascade,
  partner_id         uuid not null references public.partners(id) on delete restrict,
  amount             numeric not null check (amount > 0),
  pix_key            text not null,                          -- copia da chave no momento do lote (mudar o cadastro depois nao altera o que foi pago)
  pix_key_type       text not null,
  status             text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'done', 'failed')),
  asaas_transfer_id  text,
  fail_reason        text,
  receipt_url        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists partner_payout_items_transfer_uidx on public.partner_payout_items (asaas_transfer_id) where asaas_transfer_id is not null;
create index if not exists partner_payout_items_payout_idx on public.partner_payout_items (payout_id);

-- 5) comissoes ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.partner_commissions (
  id                uuid primary key default gen_random_uuid(),
  partner_id        uuid not null references public.partners(id) on delete restrict,
  referral_id       uuid not null references public.partner_referrals(id) on delete restrict,
  asaas_payment_id  text not null,
  gross             numeric not null,                        -- valor pago pelo cliente: a BASE da comissao
  net               numeric not null,                        -- valor liquido (depois das taxas do Asaas): so para consulta
  percent           numeric not null,
  amount            numeric not null check (amount >= 0),
  status            text not null default 'pending' check (status in ('pending', 'in_payout', 'paid', 'revoked')),
  release_at        timestamptz not null,                    -- a partir daqui a comissao fica disponivel (fim da carencia)
  payout_item_id    uuid references public.partner_payout_items(id) on delete set null,
  revoked_reason    text,
  clawback          boolean not null default false,          -- estornada DEPOIS de enviada/paga: o valor e descontado do proximo lote
  clawback_settled  boolean not null default false,
  clawback_item_id  uuid,                                    -- o item de lote que descontou este estorno (se o item falhar, o desconto volta)
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists partner_commissions_payment_uidx on public.partner_commissions (asaas_payment_id);
create index if not exists partner_commissions_partner_idx on public.partner_commissions (partner_id, status, release_at);

alter table public.partners               enable row level security;
alter table public.partner_referrals      enable row level security;
alter table public.partner_commissions    enable row level security;
alter table public.partner_payouts        enable row level security;
alter table public.partner_payout_items   enable row level security;
revoke all on public.partners, public.partner_referrals, public.partner_commissions, public.partner_payouts, public.partner_payout_items from anon, authenticated;

-- 6) lote de pagamento -------------------------------------------------------------------------------------------------------------------
-- Monta o lote dos parceiros escolhidos: soma as comissoes disponiveis (carencia vencida), desconta estornos pendentes (clawback), confere o valor
-- minimo e a chave Pix, respeita o teto e trava tudo na mesma transacao (duas pessoas clicando ao mesmo tempo nao pagam duas vezes).
create or replace function public.mb_partner_create_payout(p_partner_ids uuid[], p_created_by uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_min     numeric := coalesce((select (value->>'amount')::numeric from public.platform_settings where key = 'partner_min_payout'), 50);
  v_cap     numeric := coalesce((select (value->>'amount')::numeric from public.platform_settings where key = 'partner_payout_cap'), 5000);
  v_payout  uuid;
  v_total   numeric := 0;
  v_item    uuid;
  r         record;
  v_net     numeric;
  v_items   jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
begin
  if p_partner_ids is null or array_length(p_partner_ids, 1) is null then raise exception 'no_partners'; end if;

  -- trava as comissoes disponiveis e os estornos pendentes dos parceiros escolhidos
  perform 1 from public.partner_commissions c
    where c.partner_id = any (p_partner_ids)
      and ((c.status = 'pending' and c.release_at <= now()) or (c.clawback and not c.clawback_settled))
    for update;

  insert into public.partner_payouts (status, total, note, created_by) values ('processing', 0, p_note, p_created_by) returning id into v_payout;

  for r in select p.* from public.partners p where p.id = any (p_partner_ids) order by p.name loop
    select coalesce(sum(c.amount) filter (where c.status = 'pending' and c.release_at <= now()), 0)
         - coalesce(sum(c.amount) filter (where c.clawback and not c.clawback_settled), 0)
      into v_net from public.partner_commissions c where c.partner_id = r.id;

    if r.status <> 'active' then
      v_skipped := v_skipped || jsonb_build_object('partner_id', r.id, 'name', r.name, 'reason', 'suspended');
    elsif r.pix_key is null or r.pix_key_type is null then
      v_skipped := v_skipped || jsonb_build_object('partner_id', r.id, 'name', r.name, 'reason', 'no_pix_key');
    elsif v_net < v_min then
      v_skipped := v_skipped || jsonb_build_object('partner_id', r.id, 'name', r.name, 'reason', 'below_minimum', 'amount', v_net);
    else
      insert into public.partner_payout_items (payout_id, partner_id, amount, pix_key, pix_key_type, status)
        values (v_payout, r.id, v_net, r.pix_key, r.pix_key_type, 'pending') returning id into v_item;
      update public.partner_commissions c set status = 'in_payout', payout_item_id = v_item, updated_at = now()
        where c.partner_id = r.id and c.status = 'pending' and c.release_at <= now();
      update public.partner_commissions c set clawback_settled = true, clawback_item_id = v_item, updated_at = now()
        where c.partner_id = r.id and c.clawback and not c.clawback_settled;
      v_total := v_total + v_net;
      v_items := v_items || jsonb_build_object('item_id', v_item, 'partner_id', r.id, 'name', r.name, 'amount', v_net, 'pix_key', r.pix_key, 'pix_key_type', r.pix_key_type);
    end if;
  end loop;

  if jsonb_array_length(v_items) = 0 then raise exception 'nothing_to_pay'; end if;
  if v_total > v_cap then raise exception 'payout_cap_exceeded'; end if;   -- desfaz tudo (a transacao inteira)

  update public.partner_payouts set total = v_total, updated_at = now() where id = v_payout;
  return jsonb_build_object('payout_id', v_payout, 'total', v_total, 'items', v_items, 'skipped', v_skipped);
end $$;
revoke all on function public.mb_partner_create_payout(uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.mb_partner_create_payout(uuid[], uuid, text) to service_role;

-- recalcula o estado do lote a partir dos itens
create or replace function public.mb_partner_refresh_payout(p_payout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total integer; v_done integer; v_failed integer;
begin
  select count(*), count(*) filter (where status = 'done'), count(*) filter (where status = 'failed')
    into v_total, v_done, v_failed from public.partner_payout_items where payout_id = p_payout_id;
  update public.partner_payouts set updated_at = now(), status =
    case when v_total = 0 then 'failed'
         when v_done = v_total then 'done'
         when v_failed = v_total then 'failed'
         when v_done + v_failed = v_total then 'partial'
         else 'processing' end
  where id = p_payout_id;
end $$;
revoke all on function public.mb_partner_refresh_payout(uuid) from public, anon, authenticated;
grant execute on function public.mb_partner_refresh_payout(uuid) to service_role;

-- a transferencia foi concluida: o item e as comissoes dele passam a "pagos"
create or replace function public.mb_partner_finish_item(p_item_id uuid, p_receipt text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_payout uuid;
begin
  update public.partner_payout_items set status = 'done', receipt_url = coalesce(p_receipt, receipt_url), fail_reason = null, updated_at = now()
    where id = p_item_id and status <> 'done' returning payout_id into v_payout;
  if v_payout is null then return; end if;   -- ja estava concluido (o Asaas repete eventos)
  update public.partner_commissions set status = 'paid', paid_at = now(), updated_at = now() where payout_item_id = p_item_id and status = 'in_payout';
  perform public.mb_partner_refresh_payout(v_payout);
end $$;
revoke all on function public.mb_partner_finish_item(uuid, text) from public, anon, authenticated;
grant execute on function public.mb_partner_finish_item(uuid, text) to service_role;

-- a transferencia falhou ou foi cancelada: o item falha e as comissoes voltam a ficar disponiveis para um novo lote
create or replace function public.mb_partner_fail_item(p_item_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_payout uuid;
begin
  update public.partner_payout_items set status = 'failed', fail_reason = left(coalesce(p_reason, 'falha'), 500), updated_at = now()
    where id = p_item_id and status not in ('done', 'failed') returning payout_id into v_payout;
  if v_payout is null then return; end if;
  update public.partner_commissions set status = 'pending', payout_item_id = null, updated_at = now() where payout_item_id = p_item_id and status = 'in_payout';
  -- o desconto de estornos que esse item tinha feito volta para o proximo lote
  update public.partner_commissions set clawback_settled = false, clawback_item_id = null, updated_at = now() where clawback_item_id = p_item_id;
  perform public.mb_partner_refresh_payout(v_payout);
end $$;
revoke all on function public.mb_partner_fail_item(uuid, text) from public, anon, authenticated;
grant execute on function public.mb_partner_fail_item(uuid, text) to service_role;
