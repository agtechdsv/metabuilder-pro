-- 1. Create CheckMeta Tournaments Table
CREATE TABLE IF NOT EXISTS public.checkmeta_tournaments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open', -- 'open', 'ongoing', 'finished'
  start_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Create CheckMeta Tournament Participants Table
CREATE TABLE IF NOT EXISTS public.checkmeta_tournament_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid REFERENCES public.checkmeta_tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tournament_id, user_id)
);

-- 3. Create CheckMeta Matches Table
CREATE TABLE IF NOT EXISTS public.checkmeta_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid REFERENCES public.checkmeta_tournaments(id) ON DELETE CASCADE,
  player_white_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  player_black_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'playing', -- 'playing', 'finished'
  fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text,
  result text, -- '1-0', '0-1', '1/2-1/2'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Realtime settings
alter publication supabase_realtime add table checkmeta_matches;
alter publication supabase_realtime add table checkmeta_tournaments;
alter publication supabase_realtime add table checkmeta_tournament_participants;

-- RLS Policies

ALTER TABLE public.checkmeta_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkmeta_tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkmeta_matches ENABLE ROW LEVEL SECURITY;

-- Tournaments Policies
-- Anyone can view tournaments
CREATE POLICY "Tournaments are viewable by everyone" ON public.checkmeta_tournaments FOR SELECT USING (true);

-- Only super admins can insert, update, or delete tournaments
CREATE POLICY "Super Admins can insert tournaments" ON public.checkmeta_tournaments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);
CREATE POLICY "Super Admins can update tournaments" ON public.checkmeta_tournaments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);
CREATE POLICY "Super Admins can delete tournaments" ON public.checkmeta_tournaments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);


-- Tournament Participants Policies
-- Anyone can view participants
CREATE POLICY "Participants are viewable by everyone" ON public.checkmeta_tournament_participants FOR SELECT USING (true);

-- Users can join (insert) themselves
CREATE POLICY "Users can join tournaments" ON public.checkmeta_tournament_participants FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- Users can leave (delete) themselves, AND Super Admins can delete anyone
CREATE POLICY "Users can leave or Admins can remove" ON public.checkmeta_tournament_participants FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);


-- Matches Policies
-- Anyone can view matches
CREATE POLICY "Matches are viewable by everyone" ON public.checkmeta_matches FOR SELECT USING (true);

-- Only involved players or super admins can create matches (basic setup for now)
CREATE POLICY "Players can create matches" ON public.checkmeta_matches FOR INSERT WITH CHECK (
  auth.uid() = player_white_id OR auth.uid() = player_black_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- Only involved players can update matches (e.g. making a move)
CREATE POLICY "Players can update matches" ON public.checkmeta_matches FOR UPDATE USING (
  auth.uid() = player_white_id OR auth.uid() = player_black_id
);
