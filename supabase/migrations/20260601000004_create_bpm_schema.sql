-- Create bpm_workflows table to store workflow JSON definitions

CREATE TABLE bpm_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_table TEXT,
    flow_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE bpm_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflows for their projects" ON bpm_workflows
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.projects WHERE id = bpm_workflows.project_id
    ));

CREATE POLICY "Users can manage workflows for their projects" ON bpm_workflows
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.projects WHERE id = bpm_workflows.project_id
    ));

-- Create an index to quickly load workflows for a project
CREATE INDEX idx_bpm_workflows_project ON bpm_workflows(project_id);
