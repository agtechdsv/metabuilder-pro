-- Chave Pix enviada pelo PARCEIRO no painel dele: fica "pendente" ate o SuperAdmin conferir e aceitar. Desenho em docs/parceiros-desenho.md.
-- Rodar no SQL Editor do Supabase de PRODUCAO (projeto main) DEPOIS de scripts/parceiros.sql. Pode rodar de novo.
--
-- O que faz: guarda o pedido numa area separada (pix_pending_*), SEM mexer na chave ativa (pix_key). So a chave ativa entra em lote de
-- pagamento. O SuperAdmin ve a chave atual ao lado da nova e aceita (a nova passa a ser a ativa) ou recusa (o pedido e descartado).
-- Assim, uma conta de parceiro invadida nao consegue desviar pagamentos trocando a chave sozinha.
--
-- Seguranca: a tabela continua com RLS ligada, sem policy e sem acesso para anon/authenticated (nada muda nisso).

alter table public.partners add column if not exists pix_pending_key       text;
alter table public.partners add column if not exists pix_pending_type      text;
alter table public.partners add column if not exists pix_pending_document  text;   -- CPF/CNPJ do titular da chave, informado pelo parceiro
alter table public.partners add column if not exists pix_pending_at        timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partners_pix_pending_type_chk') then
    alter table public.partners add constraint partners_pix_pending_type_chk
      check (pix_pending_type is null or pix_pending_type in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'));
  end if;
end $$;
