-- ==============================================================================
-- Migration: Add Foreign Key from workspaces(owner_id) to profiles(id)
-- ==============================================================================

ALTER TABLE public.workspaces
ADD CONSTRAINT workspaces_owner_id_profiles_fk
FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
