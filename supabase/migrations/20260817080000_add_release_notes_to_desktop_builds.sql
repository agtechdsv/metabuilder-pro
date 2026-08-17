-- Migration: Add release_notes to desktop_builds table and allow public read of version history
ALTER TABLE public.desktop_builds ADD COLUMN IF NOT EXISTS release_notes TEXT;

-- Policy: Allow reading desktop_builds version history
DROP POLICY IF EXISTS "Public can view desktop builds history" ON public.desktop_builds;
CREATE POLICY "Public can view desktop builds history" ON public.desktop_builds
    FOR SELECT
    USING (true);
