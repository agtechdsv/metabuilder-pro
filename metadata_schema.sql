-- Script SQL de Criação do Cérebro do MetaBuilderPRO
-- Copie e cole no SQL Editor do seu Supabase.

-- 1. Tabela de Projetos (Cada App de um cliente)
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    secret_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'), -- Token usado pelo CLI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own projects" 
    ON public.projects FOR ALL 
    USING (auth.uid() = owner_id);

-- 2. Tabela de Metadados das Tabelas
CREATE TABLE public.tables_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL, -- Nome original no banco local (ex: 'tb_clientes')
    display_name TEXT,           -- Nome amigável para a UI (ex: 'Clientes')
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, original_name)
);

-- RLS
ALTER TABLE public.tables_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tables of their projects" 
    ON public.tables_metadata FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = tables_metadata.project_id AND p.owner_id = auth.uid()
    ));

-- 3. Tabela de Metadados das Colunas
CREATE TABLE public.columns_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID REFERENCES public.tables_metadata(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    display_name TEXT,
    data_type TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    is_nullable BOOLEAN DEFAULT TRUE,
    is_visible BOOLEAN DEFAULT TRUE,
    ui_type TEXT DEFAULT 'text', -- 'text', 'number', 'date', 'select', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(table_id, original_name)
);

-- RLS
ALTER TABLE public.columns_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage columns of their projects" 
    ON public.columns_metadata FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM public.tables_metadata t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = columns_metadata.table_id AND p.owner_id = auth.uid()
    ));

-- 4. Tabela de Relacionamentos (Foreign Keys)
CREATE TABLE public.relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    foreign_table_id UUID REFERENCES public.tables_metadata(id) ON DELETE CASCADE,
    foreign_column_id UUID REFERENCES public.columns_metadata(id) ON DELETE CASCADE,
    referenced_table_id UUID REFERENCES public.tables_metadata(id) ON DELETE CASCADE,
    referenced_column_id UUID REFERENCES public.columns_metadata(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage relations of their projects" 
    ON public.relations FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = relations.project_id AND p.owner_id = auth.uid()
    ));

-- Atenção: O CLI usará uma Service Key ou ignorará RLS na API do Next.js 
-- (pois o CLI não é um usuário logado tradicional, mas sim um serviço daquele projeto).
