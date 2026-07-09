-- Migration: Add expires_at to desktop_builds table
ALTER TABLE public.desktop_builds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create an index to speed up cron job deletion queries
CREATE INDEX IF NOT EXISTS idx_desktop_builds_expires_at ON public.desktop_builds (expires_at);
