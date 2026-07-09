-- Migration: Create desktop_builds table to track Github Actions desktop builds
CREATE TABLE IF NOT EXISTS public.desktop_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    context_type VARCHAR(50) NOT NULL,
    context_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    download_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_desktop_builds_user ON public.desktop_builds(user_id);
CREATE INDEX IF NOT EXISTS idx_desktop_builds_status ON public.desktop_builds(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.desktop_builds ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own builds
CREATE POLICY "Users can view their own desktop builds" ON public.desktop_builds
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own builds
CREATE POLICY "Users can insert their own desktop builds" ON public.desktop_builds
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can manage all builds
CREATE POLICY "Service role can manage all desktop builds" ON public.desktop_builds
    USING (true)
    WITH CHECK (true);

-- Trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_desktop_builds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_desktop_builds_updated_at ON public.desktop_builds;
CREATE TRIGGER trg_desktop_builds_updated_at
BEFORE UPDATE ON public.desktop_builds
FOR EACH ROW
EXECUTE FUNCTION update_desktop_builds_updated_at();
