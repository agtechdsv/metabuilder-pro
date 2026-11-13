-- Parceiro aprovado ANTES de ter conta no MetaBuilder: o cadastro guarda so o e-mail e a conta e vinculada sozinha
-- quando a pessoa entra com esse e-mail (confirmado). Desenho em docs/parceiros-desenho.md.
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main) DEPOIS de scripts/parceiros.sql. Pode rodar de novo.
--
-- O que faz:
--  1) partners.user_id passa a aceitar vazio (parceiro "aguardando cadastro").
--  2) partners.email (minusculas): o e-mail com que a pessoa vai criar a conta. Unico (sem diferenciar maiusculas).
--  3) todo parceiro tem conta OU e-mail (check).
--  4) parceiros que ja existem recebem o e-mail da propria conta. Nada se perde.
--
-- Seguranca: continua sem policy e sem acesso para anon/authenticated (a tabela ja estava assim). O vinculo so e feito pelo servidor,
-- e so quando o e-mail da conta esta CONFIRMADO.

alter table public.partners alter column user_id drop not null;

alter table public.partners add column if not exists email text;

update public.partners p
   set email = lower(pr.email)
  from public.profiles pr
 where pr.id = p.user_id and p.email is null and pr.email is not null;

create unique index if not exists partners_email_uidx on public.partners (lower(email)) where email is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partners_user_or_email_chk') then
    alter table public.partners add constraint partners_user_or_email_chk check (user_id is not null or email is not null);
  end if;
end $$;
