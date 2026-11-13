-- Interessados em ser parceiro (formulario publico em /parceiros). Desenho em docs/parceiros-desenho.md.
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main). Pode rodar de novo: tudo e "if not exists".
--
-- O que faz: cria partner_applications, onde cai cada candidatura enviada pelo formulario. O SuperAdmin ve a lista em
-- Planos > Parceiros, aprova (abre o cadastro do parceiro ja preenchido), recusa ou apaga.
--
-- Seguranca: RLS ligada e SEM policy, e sem acesso para anon/authenticated. Quem grava e a server action do formulario
-- (service_role), que valida os campos, barra robos (campo escondido, tempo minimo) e limita por IP. O IP so e guardado como hash.
-- LGPD: a pessoa marca o consentimento no formulario (consent_at); o SuperAdmin pode apagar a candidatura a qualquer momento.

create table if not exists public.partner_applications (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null check (char_length(email) between 5 and 200),
  phone       text check (char_length(phone) <= 40),
  company     text check (char_length(company) <= 120),
  channel     text not null check (channel in ('consulting', 'freelancer', 'community', 'integrator', 'other')),
  audience    text check (char_length(audience) <= 600),   -- como pretende divulgar / para quem
  message     text check (char_length(message) <= 2000),
  lang        text,
  ip_hash     text,                                        -- hash com segredo; nunca o IP
  consent_at  timestamptz not null,
  status      text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  partner_id  uuid references public.partners(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists partner_applications_status_idx on public.partner_applications (status, created_at desc);
create index if not exists partner_applications_email_idx on public.partner_applications (lower(email));
create index if not exists partner_applications_ip_idx on public.partner_applications (ip_hash, created_at);

alter table public.partner_applications enable row level security;
revoke all on public.partner_applications from anon, authenticated;
