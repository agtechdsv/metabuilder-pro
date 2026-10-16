-- ==============================================================================================
-- MetaBuilderPRO - Execuções dos fluxos de Automações / BPM
-- ==============================================================================================
-- O Agente CLI executa os fluxos na máquina do cliente e reporta cada execução em POST /api/automations/runs.
-- Daqui saem: o aviso por e-mail quando um fluxo falha (E-mail para notificação de falhas) e a limpeza por
-- "Retenção de logs (dias)" (cron diário /api/cron/cleanup-bpm-runs). Os dois ajustes ficam em ui_views.layout_config
-- da tela de slug 'automations'.

CREATE TABLE IF NOT EXISTS public.bpm_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.bpm_workflows(id) ON DELETE SET NULL,
    workflow_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'loop')),
    trigger_source TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error_message TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bpm_runs_project_started_idx ON public.bpm_runs (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS bpm_runs_workflow_idx ON public.bpm_runs (workflow_id);

ALTER TABLE public.bpm_runs ENABLE ROW LEVEL SECURITY;

-- Quem tem acesso ao projeto lê o histórico. Gravar e apagar só pelo servidor (service role): sem policy de escrita.
DROP POLICY IF EXISTS "Membros do projeto leem as execuções de BPM" ON public.bpm_runs;
CREATE POLICY "Membros do projeto leem as execuções de BPM" ON public.bpm_runs
    FOR SELECT TO authenticated
    USING (public.has_project_access(project_id));
