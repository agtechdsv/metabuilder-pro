-- Marca de "relação só de auditoria" (quem criou/alterou o registro).
-- Relações marcadas ficam fora do caminho sugerido automaticamente nas abas do Orquestrador.
-- Rodar no SQL Editor do Supabase (projeto da plataforma). É seguro rodar mais de uma vez.
-- Sem esta coluna tudo continua funcionando: a detecção pelo nome da coluna (created_by, criado_por...) não depende dela;
-- só o botão "Marcar como só auditoria" na tela de relacionamentos precisa dela.

alter table public.relations
  add column if not exists audit_only boolean not null default false;

comment on column public.relations.audit_only is
  'true = relação de auditoria (criado_por/atualizado_por...), ignorada na sugestão de caminho do Orquestrador';
