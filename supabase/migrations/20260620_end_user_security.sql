-- Migração para a tabela project_users_security
-- Armazena segredos de MFA e Passkeys para usuários finais

CREATE TABLE IF NOT EXISTS public.project_users_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL,
    totp_secret TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    passkeys JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, external_user_id)
);

-- Habilitar RLS
ALTER TABLE public.project_users_security ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Apenas os desenvolvedores do projeto podem gerenciar essa segurança
CREATE POLICY "Developers can manage end user security" ON public.project_users_security
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.workspaces w ON w.id = p.workspace_id
            JOIN public.workspace_members wm ON wm.workspace_id = w.id
            WHERE p.id = project_users_security.project_id
            AND wm.user_id = auth.uid()
        )
    );

-- Criação de um index para melhorar a performance da busca no login
CREATE INDEX IF NOT EXISTS idx_project_users_security_external_user_id 
ON public.project_users_security(project_id, external_user_id);
