-- ==============================================================================
-- MetaBuilder PRO - Cancellation Feedback Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cancellation_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    reasons TEXT[] NOT NULL,
    comment TEXT,
    subscription_id TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cancellation_feedbacks ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to insert their own feedback
DROP POLICY IF EXISTS "Permitir insercao por usuarios autenticados" ON public.cancellation_feedbacks;
CREATE POLICY "Permitir insercao por usuarios autenticados"
    ON public.cancellation_feedbacks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to view their own feedback, and super admins to view all feedbacks
DROP POLICY IF EXISTS "Permitir leitura por super admins ou pelo proprio criador" ON public.cancellation_feedbacks;
CREATE POLICY "Permitir leitura por super admins ou pelo proprio criador"
    ON public.cancellation_feedbacks FOR SELECT
    USING (
        auth.uid() = user_id OR EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
        )
    );
