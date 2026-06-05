-- ==============================================================================================
-- Migration: Safe Sync (Introspection Conflict Resolution)
-- Adds fields to handle draft schemas and avoid cascading deletes.
-- ==============================================================================================

-- 1. Add fields to Projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'draft_pending')),
ADD COLUMN IF NOT EXISTS last_sync_payload JSONB DEFAULT '{}'::jsonb;

-- 2. Add visual safety field to Models and Fields
ALTER TABLE public.models 
ADD COLUMN IF NOT EXISTS is_missing BOOLEAN DEFAULT FALSE;

ALTER TABLE public.fields 
ADD COLUMN IF NOT EXISTS is_missing BOOLEAN DEFAULT FALSE;
