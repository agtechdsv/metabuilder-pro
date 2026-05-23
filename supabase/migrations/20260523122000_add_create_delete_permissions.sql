-- ==============================================================================
-- Migration: Add can_create and can_delete granular permissions
-- Filename: 20260523122000_add_create_delete_permissions.sql
-- ==============================================================================

-- 1. Alter public.workspace_members table
ALTER TABLE public.workspace_members 
ADD COLUMN IF NOT EXISTS can_create BOOLEAN DEFAULT false;

ALTER TABLE public.workspace_members 
ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT false;

-- 2. Alter public.workspace_member_projects table
ALTER TABLE public.workspace_member_projects 
ADD COLUMN IF NOT EXISTS can_create BOOLEAN DEFAULT false;

ALTER TABLE public.workspace_member_projects 
ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT false;
