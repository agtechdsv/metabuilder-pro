-- ==============================================================================================
-- MetaBuilderPRO - Core Metadata Engine Schema
-- This schema defines the structure that stores the configurations of the dynamic applications.
-- ==============================================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WORKSPACES
-- Isolates data between different tenants/companies
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROJECTS (The Apps)
-- A workspace can have multiple dynamic projects
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- URL or lucide-icon name
    theme_config JSONB DEFAULT '{}'::jsonb, -- Store colors, layouts, etc
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AGENTS (CLI Connectors)
-- Represents the local CLI agents running on the client's infrastructure
CREATE TABLE public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    agent_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE, -- Used by CLI to authenticate
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
    last_ping TIMESTAMP WITH TIME ZONE,
    connection_config JSONB DEFAULT '{}'::jsonb, -- Info about the DB type (Oracle, Postgres), no credentials
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MODELS (Tables/Entities)
-- Represents the database tables that the CLI agent introspects
CREATE TABLE public.models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    db_schema_name TEXT DEFAULT 'public',
    db_table_name TEXT NOT NULL,
    display_name TEXT NOT NULL, -- Human readable name for the UI (e.g. "Customers")
    display_name_plural TEXT,
    description TEXT,
    is_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT TRUE,
    can_update BOOLEAN DEFAULT TRUE,
    can_delete BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, db_schema_name, db_table_name)
);

-- 5. FIELDS (Columns)
-- Represents the columns within those tables and how they should be rendered
CREATE TABLE public.fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    db_column_name TEXT NOT NULL,
    data_type TEXT NOT NULL, -- e.g., varchar, integer, timestamp
    
    -- DB constraints
    is_primary_key BOOLEAN DEFAULT FALSE,
    is_nullable BOOLEAN DEFAULT TRUE,
    default_value TEXT,
    
    -- UI Configurations
    display_name TEXT NOT NULL,
    ui_widget TEXT DEFAULT 'text_input', -- text_input, number_input, date_picker, select, toggle, relation_picker
    is_visible_in_list BOOLEAN DEFAULT TRUE, -- Show in the data grid?
    is_visible_in_form BOOLEAN DEFAULT TRUE, -- Show in the create/edit form?
    is_searchable BOOLEAN DEFAULT FALSE,
    is_sortable BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0, -- Order in forms/tables
    
    -- Additional configurations like Enum options or specific validation rules
    widget_options JSONB DEFAULT '{}'::jsonb, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(model_id, db_column_name)
);

-- 6. RELATIONS (Foreign Keys)
-- Represents relationships between models (1:1, 1:N, N:M)
CREATE TABLE public.relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT, -- e.g., "customer_orders"
    
    from_model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    from_field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    
    to_model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    to_field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    
    relation_type TEXT NOT NULL CHECK (relation_type IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;

-- Workspace Policy: Users can only see and edit their own workspaces
CREATE POLICY "Users can access their own workspaces"
    ON public.workspaces FOR ALL
    USING (auth.uid() = owner_id);

-- Project Policy: Users can access projects linked to their workspaces
CREATE POLICY "Users can access projects of their workspaces"
    ON public.projects FOR ALL
    USING (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    );

-- Cascading access policies based on project ownership
CREATE POLICY "Users can access agents of their projects"
    ON public.agents FOR ALL
    USING (project_id IN (SELECT id FROM public.projects));

CREATE POLICY "Users can access models of their projects"
    ON public.models FOR ALL
    USING (project_id IN (SELECT id FROM public.projects));

CREATE POLICY "Users can access fields of their models"
    ON public.fields FOR ALL
    USING (model_id IN (SELECT id FROM public.models));

CREATE POLICY "Users can access relations of their projects"
    ON public.relations FOR ALL
    USING (project_id IN (SELECT id FROM public.projects));
