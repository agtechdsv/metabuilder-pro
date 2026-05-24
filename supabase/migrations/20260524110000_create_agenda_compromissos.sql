-- Create agenda_compromissos table with client details columns for waitlist scheduler
CREATE TABLE IF NOT EXISTS public.agenda_compromissos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente'::VARCHAR NOT NULL,
    categoria VARCHAR(100) DEFAULT 'Geral'::VARCHAR,
    prioridade VARCHAR(20) DEFAULT 'Média'::VARCHAR,
    cor_etiqueta VARCHAR(7) DEFAULT '#4F46E5'::VARCHAR,
    cliente_nome VARCHAR(255),
    cliente_email VARCHAR(255),
    cliente_whatsapp VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.agenda_compromissos ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Permitir insercoes publicas" ON public.agenda_compromissos;

-- Create policy to allow anyone to insert a new appointment (public scheduler)
CREATE POLICY "Permitir insercoes publicas" 
ON public.agenda_compromissos 
FOR INSERT 
WITH CHECK (true);

-- Drop policy if exists
DROP POLICY IF EXISTS "Permitir controle completo por admins" ON public.agenda_compromissos;

-- Create policy to allow service_role / admin complete control
CREATE POLICY "Permitir controle completo por admins"
ON public.agenda_compromissos
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Add table to Supabase Realtime publication if not already added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'agenda_compromissos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_compromissos;
    END IF;
END $$;
