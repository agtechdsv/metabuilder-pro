-- ==============================================================================================
-- MetaBuilderPRO - Activity Logs and Use Case Delivery Status
-- ==============================================================================================

-- 1. ACTIVITY LOGS
-- Tabela para armazenar os eventos de telemetria agregados dos desenvolvedores (Heartbeat)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ui_view_id UUID REFERENCES public.ui_views(id) ON DELETE CASCADE, -- opcional, pois pode ser acao em banco
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE NOT NULL,
    active_time_seconds INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    events JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ALTER UI VIEWS (Casos de Uso)
-- Adiciona a coluna de status para controlar o ciclo de vida (Entrega/Retrabalho)
ALTER TABLE public.ui_views 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'delivered', 'reopened'));

-- ==============================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================================

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Workspace Policy: Apenas o owner da workspace pode ler os logs detalhados
CREATE POLICY "Users can read activity logs of their workspaces"
    ON public.activity_logs FOR SELECT
    USING (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    );

-- Insert Policy: Devs logados podem inserir seus próprios logs
CREATE POLICY "Users can insert their own activity logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Update Policy: Devs logados podem atualizar seus próprios logs (necessário para consolidar as sessões)
CREATE POLICY "Users can update their own activity logs"
    ON public.activity_logs FOR UPDATE
    USING (auth.uid() = user_id);

