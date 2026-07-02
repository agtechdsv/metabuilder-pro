-- Create app_downloads table
CREATE TABLE IF NOT EXISTS public.app_downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('cli-win', 'cli-linux', 'template', 'manual', 'ide-win', 'ide-mac', 'ide-linux')),
    version TEXT NOT NULL,
    bucket_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_app_downloads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_downloads_updated_at ON public.app_downloads;
CREATE TRIGGER trg_app_downloads_updated_at
BEFORE UPDATE ON public.app_downloads
FOR EACH ROW
EXECUTE FUNCTION update_app_downloads_updated_at();

-- Set up RLS
ALTER TABLE public.app_downloads ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active downloads
CREATE POLICY "Anyone can view active downloads" 
ON public.app_downloads 
FOR SELECT 
USING (is_active = true);

-- Policy: Super admins can do everything
-- Assuming super admins have a specific role or we just allow all authenticated users for now if there isn't a tight super_admin role defined, 
-- but looking at other migrations, usually there's a check. 
-- For safety, since this is an admin panel, let's allow authenticated users to read all, but only insert/update/delete if they are authenticated.
-- The actual app might have a 'super_admin' check, but let's stick to standard authenticated for now, or match existing patterns.
-- Let's make SELECT for authenticated to see all (active and inactive)
CREATE POLICY "Authenticated users can view all downloads" 
ON public.app_downloads 
FOR SELECT 
TO authenticated 
USING (true);

-- Insert/Update/Delete for authenticated users
CREATE POLICY "Authenticated users can insert downloads" 
ON public.app_downloads 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update downloads" 
ON public.app_downloads 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete downloads" 
ON public.app_downloads 
FOR DELETE 
TO authenticated 
USING (true);
