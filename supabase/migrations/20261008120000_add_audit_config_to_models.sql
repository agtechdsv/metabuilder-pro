-- Auditoria por tabela (Studio > Dados & Schemas > "Auditoria"): quais colunas guardam quando/por quem o registro foi criado e alterado.
-- Formato: { "createdAt": "criado_em", "createdBy": "criado_por", "updatedAt": "atualizado_em", "updatedBy": "atualizado_por",
--            "by": { "source": "user.attr", "attr": "id" }, "disabled": false }
-- Sem valor (NULL) vale o reconhecimento pelo nome das colunas (criado_em/created_at, criado_por/created_by...).
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS audit_config jsonb;

COMMENT ON COLUMN public.models.audit_config IS 'Colunas de auditoria da tabela (preenchidas pelo servidor/Agente CLI, nunca pela tela).';
