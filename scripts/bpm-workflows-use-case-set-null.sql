-- MetaBuilder PRO: excluir um caso de uso NÃO deve mais apagar os fluxos de automação.
--
-- O fluxo é da TABELA (o motor dispara por tabela + evento, em qualquer tela). Hoje a chave estrangeira
-- bpm_workflows.use_case_id -> ui_views(id) é ON DELETE CASCADE: apagar um caso de uso apaga os fluxos que foram desenhados nele,
-- e esses fluxos continuavam valendo para as outras telas da mesma tabela. Com SET NULL os fluxos ficam (sem caso de uso).
-- Rode no SQL Editor do Supabase da PLATAFORMA (projeto main). Pode ser rodado a qualquer momento; não muda nenhum fluxo existente.

ALTER TABLE public.bpm_workflows DROP CONSTRAINT IF EXISTS fk_bpm_workflows_use_case;

ALTER TABLE public.bpm_workflows
  ADD CONSTRAINT fk_bpm_workflows_use_case
  FOREIGN KEY (use_case_id) REFERENCES public.ui_views(id) ON DELETE SET NULL;

-- conferir
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public.bpm_workflows'::regclass AND conname = 'fk_bpm_workflows_use_case';
