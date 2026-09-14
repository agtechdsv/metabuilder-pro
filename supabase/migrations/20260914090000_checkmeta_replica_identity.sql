-- Ensure Realtime UPDATE and DELETE events work on RLS-enabled tables
ALTER TABLE public.checkmeta_matches REPLICA IDENTITY FULL;
ALTER TABLE public.checkmeta_challenges REPLICA IDENTITY FULL;
