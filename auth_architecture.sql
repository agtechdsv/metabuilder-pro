-- 1. Tabela de Configuração de Autenticação por Projeto
CREATE TABLE IF NOT EXISTS public.project_auth_config (
    project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
    auth_type TEXT NOT NULL DEFAULT 'managed' CHECK (auth_type IN ('managed', 'database', 'ldap', 'sso')),
    
    -- Configurações para auth_type = 'database' (Validação via Agente CLI)
    db_table_name TEXT,
    db_email_column TEXT,
    db_password_column TEXT,
    db_password_hash_type TEXT DEFAULT 'bcrypt' CHECK (db_password_hash_type IN ('bcrypt', 'md5', 'sha256', 'plain')),
    
    -- Configurações para auth_type = 'ldap'
    ldap_server_url TEXT,
    ldap_base_dn TEXT,
    
    -- Configuração Visual (Design da Tela de Login)
    ui_config JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.project_auth_config ENABLE ROW LEVEL SECURITY;
-- Por enquanto, liberado para facilitar o dev (ajustar em prod)
CREATE POLICY "Enable all for project_auth_config" ON public.project_auth_config FOR ALL USING (true);


-- 2. Tabela de Usuários Gerenciados (Para auth_type = 'managed')
-- Separação total da tabela auth.users principal do Supabase
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL, -- Hasheado no backend via bcrypt
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, email) -- Email deve ser único por projeto
);

-- Habilitar RLS
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for tenant_users" ON public.tenant_users FOR ALL USING (true);


-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_project_auth_config_updated_at ON public.project_auth_config;
CREATE TRIGGER update_project_auth_config_updated_at
    BEFORE UPDATE ON public.project_auth_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
