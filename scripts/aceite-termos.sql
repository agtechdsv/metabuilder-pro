-- Registro do aceite dos Termos de Serviço e da Política de Privacidade (rodar no SQL Editor do Supabase; é seguro rodar mais de uma vez).
--
-- Uma linha por usuário, documento e versão. O aceite é gravado pelo SERVIDOR do site (ações com a sessão do usuário), nunca pelo navegador:
--  - no checkout, antes de a cobrança ser criada;
--  - no aviso do painel, para quem já era cliente quando os termos mudaram.
-- A versão vigente está em src/lib/legal/legalVersions.ts (LEGAL_VERSION).
--
-- Segurança: RLS ligada e SEM policy, e sem acesso para anon/authenticated. Só o servidor (service_role) lê e grava.

create table if not exists public.terms_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc         text not null check (doc in ('terms', 'privacy')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  source      text not null check (source in ('checkout', 'notice')),
  user_agent  text
);

create unique index if not exists terms_acceptances_user_doc_version_uidx on public.terms_acceptances (user_id, doc, version);
create index if not exists terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at desc);

alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from public, anon, authenticated;
grant all on public.terms_acceptances to service_role;
