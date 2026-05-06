-- ==============================================================================================
-- MetaBuilderPRO - Agent Tasks Queue
-- This schema defines the queue system for asynchronous communication between the Next.js UI 
-- and the local CLI Agents (Opção 1).
-- ==============================================================================================

CREATE TABLE public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL, -- The specific agent executing the task
    
    -- Task Details
    action TEXT NOT NULL CHECK (action IN ('introspect_schema', 'read_data', 'insert_data', 'update_data', 'delete_data')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- The command itself (e.g., table name, data to insert)
    
    -- Status & Lifecycle
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_payload JSONB, -- The data returned by the agent (e.g., rows from a SELECT, or error message)
    error_message TEXT,
    
    created_by UUID REFERENCES auth.users(id), -- Which user triggered this?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================================

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

-- Users can only see tasks related to projects they have access to
CREATE POLICY "Users can access tasks of their projects"
    ON public.agent_tasks FOR ALL
    USING (project_id IN (SELECT id FROM public.projects));

-- ==============================================================================================
-- REALTIME SETUP
-- We need to tell Supabase to broadcast changes on this table so the CLI can listen
-- ==============================================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
