-- 4. Create CheckMeta Ratings Table
CREATE TABLE IF NOT EXISTS public.checkmeta_ratings (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  rating numeric NOT NULL DEFAULT 1500.0,
  rd numeric NOT NULL DEFAULT 350.0,
  volatility numeric NOT NULL DEFAULT 0.06,
  games_played integer NOT NULL DEFAULT 0,
  last_played_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Matchmaking Queue Table
CREATE TABLE IF NOT EXISTS public.checkmeta_matchmaking_queue (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  time_control_minutes integer NOT NULL,
  time_control_increment integer NOT NULL,
  rating numeric NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add clock columns to checkmeta_matches
ALTER TABLE public.checkmeta_matches
ADD COLUMN time_control_minutes integer,
ADD COLUMN time_control_increment integer,
ADD COLUMN white_time_left_ms bigint,
ADD COLUMN black_time_left_ms bigint,
ADD COLUMN last_move_at timestamp with time zone;

-- Realtime Settings
ALTER PUBLICATION supabase_realtime ADD TABLE checkmeta_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE checkmeta_matchmaking_queue;

-- RLS
ALTER TABLE public.checkmeta_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkmeta_matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Ratings Policies
CREATE POLICY "Ratings are viewable by everyone" ON public.checkmeta_ratings FOR SELECT USING (true);
-- Ratings are only updated by server triggers (no manual INSERT/UPDATE allowed by users)

-- Queue Policies
CREATE POLICY "Queue is viewable by everyone" ON public.checkmeta_matchmaking_queue FOR SELECT USING (true);
CREATE POLICY "Users can join queue" ON public.checkmeta_matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave queue" ON public.checkmeta_matchmaking_queue FOR DELETE USING (auth.uid() = user_id);

-- Glicko-2 / Elo calculation will be done either via Edge Function or PL/pgSQL Trigger when match finishes.
-- For now we implement the base trigger that initializes rating on queue join if missing.
CREATE OR REPLACE FUNCTION initialize_checkmeta_rating_if_missing(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.checkmeta_ratings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
