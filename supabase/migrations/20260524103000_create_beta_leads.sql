-- Create beta_leads table for landing page waitlist
CREATE TABLE IF NOT EXISTS public.beta_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    company_name TEXT,
    company_size TEXT,
    challenge TEXT,
    operator TEXT,
    urgency TEXT,
    database_type TEXT,
    objective TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.beta_leads ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Permitir insercoes publicas para lista de espera" ON public.beta_leads;

-- Create policy to allow anyone to insert a new lead (public lead generation)
CREATE POLICY "Permitir insercoes publicas para lista de espera" 
ON public.beta_leads 
FOR INSERT 
WITH CHECK (true);

-- Drop policy if exists
DROP POLICY IF EXISTS "Permitir apenas leitura admin" ON public.beta_leads;

-- Create policy to allow service_role to read (or disable read for public)
CREATE POLICY "Permitir apenas leitura admin"
ON public.beta_leads
FOR SELECT
USING (auth.jwt()->>'role' = 'service_role');
