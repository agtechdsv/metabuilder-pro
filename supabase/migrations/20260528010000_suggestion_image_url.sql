-- Add image_url column to suggestions table
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS image_url TEXT;
