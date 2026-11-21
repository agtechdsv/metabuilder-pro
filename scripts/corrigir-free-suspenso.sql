-- Corrige contas FREE que só abriram o checkout (nunca pagaram) e foram marcadas como "suspensas" por engano.
-- O app ignora o bloqueio de conta FREE, mas o status 'blocked' + overdue_since fazia a rotina enviar e-mails de atraso e suspensão.
-- Volta ao estado normal de quem ainda não assinou: subscription_status = 'pending', sem atraso marcado.
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez (só mexe em quem ainda está errado).

-- 1) Veja antes quem será corrigido:
select p.id, p.email, p.subscription_tier, p.subscription_status, p.is_blocked, p.overdue_since
from public.profiles p
where coalesce(p.subscription_tier, 'free') = 'free'
  and not exists (select 1 from public.payments x where x.user_id = p.id and x.status = 'paid')
  and (p.overdue_since is not null or p.subscription_status = 'blocked');

-- 2) Corrige:
update public.profiles p
set subscription_status = 'pending',
    overdue_since = null
where coalesce(p.subscription_tier, 'free') = 'free'
  and not exists (select 1 from public.payments x where x.user_id = p.id and x.status = 'paid')
  and (p.overdue_since is not null or p.subscription_status = 'blocked');
