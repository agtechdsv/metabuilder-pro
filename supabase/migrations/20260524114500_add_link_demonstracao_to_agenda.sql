-- Add link_demonstracao column to agenda_compromissos table
ALTER TABLE public.agenda_compromissos 
ADD COLUMN IF NOT EXISTS link_demonstracao VARCHAR(512);
