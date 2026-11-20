-- Fila de notas fiscais (NFS-e) do MetaBuilder PRO.
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo: e idempotente). Ordem: este script primeiro, depois o deploy do site.
--
-- O que faz:
--   1. Cria mb_nfse_queue: uma linha por pagamento recebido, com a data em que a nota deve ser emitida (pagamento + 8 dias, hora de Brasilia).
--   2. Uma trigger em payments cria a linha sozinha quando o pagamento vira "paid" e marca a nota quando o pagamento e devolvido.
--      A trigger NUNCA derruba o webhook do Asaas: qualquer erro dela vira apenas um aviso no log do banco.
--   3. Cria os ajustes nfse_mode (manual) e nfse_wait_days (8) em platform_settings.
--
-- Pagamentos que ja existem NAO entram na fila (os de hoje sao testes). Se quiser incluir algum depois, e so inserir a linha a mao.

create table if not exists public.mb_nfse_queue (
  id                   uuid primary key default gen_random_uuid(),
  payment_id           uuid not null unique,                 -- payments.id (sem FK de proposito: o registro fiscal tem de sobreviver ao pagamento/usuario)
  asaas_payment_id     text,
  user_id              uuid,
  amount               numeric(12,2) not null,
  paid_at              timestamptz not null,
  emit_on              date not null,                        -- dia em que a nota deve sair (pagamento + prazo)
  status               text not null default 'pending' check (status in ('pending', 'issued', 'canceled')),
  customer_name        text,                                 -- retrato do cliente na hora do pagamento (a tela prefere o cadastro atual, se existir)
  customer_doc         text,
  customer_email       text,
  nfse_number          text,
  issued_at            timestamptz,
  customer_emailed_at  timestamptz,
  refunded             boolean not null default false,       -- o pagamento foi devolvido DEPOIS de emitir: a nota precisa ser cancelada
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists mb_nfse_queue_status_emit_idx on public.mb_nfse_queue (status, emit_on);

alter table public.mb_nfse_queue enable row level security;      -- sem politicas: so o servidor (service_role) le e grava
revoke all on public.mb_nfse_queue from public, anon, authenticated;
grant all on public.mb_nfse_queue to service_role;

insert into public.platform_settings (key, value) values
  ('nfse_mode', '{"mode":"manual"}'::jsonb),
  ('nfse_wait_days', '{"days":8}'::jsonb)
on conflict (key) do nothing;

create or replace function public.mb_nfse_enqueue() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_wait int;
  v_paid timestamptz;
  v_p record;
begin
  begin
    if new.status = 'paid' and coalesce(new.amount, 0) > 0 and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      select (value ->> 'days')::int into v_wait from public.platform_settings where key = 'nfse_wait_days';
      v_wait := least(60, greatest(0, coalesce(v_wait, 8)));
      v_paid := coalesce(new.webhook_received_at, now());
      select coalesce(nullif(company_name, ''), nullif(full_name, '')) as nm, cnpj as doc, email as em into v_p from public.profiles where id = new.user_id;
      insert into public.mb_nfse_queue (payment_id, asaas_payment_id, user_id, amount, paid_at, emit_on, customer_name, customer_doc, customer_email)
      values (new.id, new.asaas_payment_id, new.user_id, new.amount, v_paid, ((v_paid at time zone 'America/Sao_Paulo')::date + v_wait), v_p.nm, v_p.doc, v_p.em)
      on conflict (payment_id) do nothing;
    elsif new.status = 'refunded' and (tg_op = 'INSERT' or old.status is distinct from 'refunded') then
      -- ainda nao emitida: some da fila; ja emitida: fica marcada para cancelar a nota
      update public.mb_nfse_queue set status = 'canceled', note = coalesce(note, 'Pagamento devolvido antes da emissao'), updated_at = now()
        where payment_id = new.id and status = 'pending';
      update public.mb_nfse_queue set refunded = true, updated_at = now() where payment_id = new.id and status = 'issued';
    end if;
  exception when others then
    raise warning 'mb_nfse_enqueue: %', sqlerrm;   -- a fila nunca pode quebrar o recebimento do pagamento
  end;
  return new;
end
$fn$;

revoke all on function public.mb_nfse_enqueue() from public, anon, authenticated;

drop trigger if exists mb_nfse_enqueue_trg on public.payments;
create trigger mb_nfse_enqueue_trg
  after insert or update of status on public.payments
  for each row execute function public.mb_nfse_enqueue();
