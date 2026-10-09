-- Correção da migração 20261009120000 (já aplicada).
--
-- O gatilho protect_profile_privileged_columns comparava subscription_tier, que é uma coluna GERADA (calculada a partir de
-- is_super_admin e subscription_status). Num BEFORE UPDATE o valor novo de uma coluna gerada ainda é nulo, então a comparação
-- dava "diferente" sempre e o gatilho bloqueava TODA edição de perfil feita por usuário (nome, avatar, MFA...).
-- Aqui ela sai da lista: o plano continua protegido, porque is_super_admin e subscription_status (que o geram) seguem protegidos.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if new.is_super_admin is distinct from old.is_super_admin
       or new.subscription_status is distinct from old.subscription_status
       or new.subscription_cycle is distinct from old.subscription_cycle
       or new.subscription_expires_at is distinct from old.subscription_expires_at
       or new.subscription_licenses is distinct from old.subscription_licenses
       or new.subscription_amount is distinct from old.subscription_amount
       or new.asaas_customer_id is distinct from old.asaas_customer_id
       or new.asaas_subscription_id is distinct from old.asaas_subscription_id
       or new.card_brand is distinct from old.card_brand
       or new.card_last_digits is distinct from old.card_last_digits
       or new.is_blocked is distinct from old.is_blocked
       or new.is_blocked_community is distinct from old.is_blocked_community
       or new.is_blocked_metavoice is distinct from old.is_blocked_metavoice
       or new.referral_code is distinct from old.referral_code then
      raise exception 'Este dado do perfil só pode ser alterado pelo servidor.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
