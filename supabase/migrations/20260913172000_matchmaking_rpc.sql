-- Matchmaking RPC for atomical queueing and pairing
CREATE OR REPLACE FUNCTION join_matchmaking_queue(p_minutes integer, p_increment integer)
RETURNS uuid AS $$
DECLARE
  v_user_rating numeric;
  v_opponent_id uuid;
  v_match_id uuid;
BEGIN
  -- 1. Get user rating (initialize if missing)
  SELECT rating INTO v_user_rating FROM public.checkmeta_ratings WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.checkmeta_ratings (user_id) VALUES (auth.uid()) RETURNING rating INTO v_user_rating;
  END IF;

  -- 2. Try to find an opponent (locked for update to prevent race conditions)
  SELECT user_id INTO v_opponent_id
  FROM public.checkmeta_matchmaking_queue
  WHERE time_control_minutes = p_minutes 
    AND time_control_increment = p_increment
    AND user_id != auth.uid()
    AND rating BETWEEN v_user_rating - 150 AND v_user_rating + 150
  ORDER BY joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- 3. Match found! Remove opponent from queue
    DELETE FROM public.checkmeta_matchmaking_queue WHERE user_id = v_opponent_id;
    
    -- Also remove myself if I was in the queue for something else
    DELETE FROM public.checkmeta_matchmaking_queue WHERE user_id = auth.uid();

    -- 4. Create Match and randomize colors
    IF random() < 0.5 THEN
      INSERT INTO public.checkmeta_matches (player_white_id, player_black_id, status, time_control_minutes, time_control_increment)
      VALUES (auth.uid(), v_opponent_id, 'playing', p_minutes, p_increment) RETURNING id INTO v_match_id;
    ELSE
      INSERT INTO public.checkmeta_matches (player_white_id, player_black_id, status, time_control_minutes, time_control_increment)
      VALUES (v_opponent_id, auth.uid(), 'playing', p_minutes, p_increment) RETURNING id INTO v_match_id;
    END IF;

    RETURN v_match_id;
  ELSE
    -- 5. No match found. Join or update queue
    INSERT INTO public.checkmeta_matchmaking_queue (
      user_id, time_control_minutes, time_control_increment, rating
    ) VALUES (
      auth.uid(), p_minutes, p_increment, v_user_rating
    ) ON CONFLICT (user_id) DO UPDATE SET
      time_control_minutes = EXCLUDED.time_control_minutes,
      time_control_increment = EXCLUDED.time_control_increment,
      rating = EXCLUDED.rating,
      joined_at = EXCLUDED.joined_at;

    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to leave queue
CREATE OR REPLACE FUNCTION leave_matchmaking_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM public.checkmeta_matchmaking_queue WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
