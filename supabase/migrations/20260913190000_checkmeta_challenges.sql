CREATE TABLE IF NOT EXISTS public.checkmeta_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenged_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, declined
  match_id uuid REFERENCES public.checkmeta_matches(id) ON DELETE SET NULL,
  time_control_minutes integer NOT NULL DEFAULT 5,
  time_control_increment integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER PUBLICATION supabase_realtime ADD TABLE checkmeta_challenges;

ALTER TABLE public.checkmeta_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their challenges" 
ON public.checkmeta_challenges FOR SELECT 
USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges" 
ON public.checkmeta_challenges FOR INSERT 
WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges" 
ON public.checkmeta_challenges FOR UPDATE 
USING (auth.uid() = challenged_id OR auth.uid() = challenger_id);
