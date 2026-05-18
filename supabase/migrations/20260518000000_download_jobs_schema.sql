-- Migration to create the download_jobs table for asynchronous downloads tracking
CREATE TABLE IF NOT EXISTS public.download_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    workspace_slug VARCHAR(255) NOT NULL,
    project_id UUID NOT NULL,
    view_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    progress INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    file_url TEXT,
    record_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for high performance queries
CREATE INDEX IF NOT EXISTS idx_download_jobs_user ON public.download_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_download_jobs_workspace ON public.download_jobs(workspace_slug);

-- Enable Row Level Security (RLS)
ALTER TABLE public.download_jobs ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own download jobs
CREATE POLICY "Users can view their own download jobs" ON public.download_jobs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert their own download jobs
CREATE POLICY "Users can insert their own download jobs" ON public.download_jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own download jobs
CREATE POLICY "Users can delete their own download jobs" ON public.download_jobs
    FOR DELETE
    USING (auth.uid() = user_id);

-- Allow service_role to manage all download jobs
CREATE POLICY "Service role can manage all download jobs" ON public.download_jobs
    USING (true)
    WITH CHECK (true);
