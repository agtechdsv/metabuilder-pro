-- Glicko-2 mathematical helper function `f(x)` for volatility iteration
CREATE OR REPLACE FUNCTION checkmeta_f(x numeric, delta numeric, phi numeric, v numeric, a numeric, tau numeric) 
RETURNS numeric AS $$
BEGIN
  RETURN (EXP(x) * (POWER(delta, 2) - POWER(phi, 2) - v - EXP(x))) / (2.0 * POWER(POWER(phi, 2) + v + EXP(x), 2)) - (x - a) / POWER(tau, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Glicko-2 Core Calculation function
CREATE OR REPLACE FUNCTION checkmeta_calculate_glicko2(
  p_r numeric, p_rd numeric, p_vol numeric,
  p_opponent_r numeric, p_opponent_rd numeric, p_opponent_vol numeric,
  p_score numeric
) RETURNS TABLE (new_r numeric, new_rd numeric, new_vol numeric) AS $$
DECLARE
  tau numeric := 0.5;
  SCALE numeric := 173.7178;
  mu numeric;
  phi numeric;
  mu_j numeric;
  phi_j numeric;
  g_phi_j numeric;
  E numeric;
  v numeric;
  delta numeric;
  a numeric;
  A_val numeric;
  B_val numeric;
  C_val numeric;
  f_A numeric;
  f_B numeric;
  f_C numeric;
  epsilon numeric := 0.000001;
  sigma_new numeric;
  phi_star numeric;
  phi_new numeric;
  mu_new numeric;
BEGIN
  -- Step 1
  mu := (p_r - 1500.0) / SCALE;
  phi := p_rd / SCALE;
  mu_j := (p_opponent_r - 1500.0) / SCALE;
  phi_j := p_opponent_rd / SCALE;

  -- Step 2
  g_phi_j := 1.0 / SQRT(1.0 + 3.0 * POWER(phi_j, 2) / POWER(PI(), 2));
  E := 1.0 / (1.0 + EXP(-g_phi_j * (mu - mu_j)));
  v := 1.0 / (POWER(g_phi_j, 2) * E * (1.0 - E));

  -- Step 3
  delta := v * g_phi_j * (p_score - E);

  -- Step 4 (Volatility update using Illinois algorithm)
  a := LN(POWER(p_vol, 2));
  
  A_val := a;
  IF POWER(delta, 2) > (POWER(phi, 2) + v) THEN
    B_val := LN(POWER(delta, 2) - POWER(phi, 2) - v);
  ELSE
    DECLARE
      k integer := 1;
    BEGIN
      WHILE checkmeta_f(a - k * tau, delta, phi, v, a, tau) < 0 LOOP
        k := k + 1;
      END LOOP;
      B_val := a - k * tau;
    END;
  END IF;

  f_A := checkmeta_f(A_val, delta, phi, v, a, tau);
  f_B := checkmeta_f(B_val, delta, phi, v, a, tau);

  WHILE ABS(B_val - A_val) > epsilon LOOP
    C_val := A_val + (A_val - B_val) * f_A / (f_B - f_A);
    f_C := checkmeta_f(C_val, delta, phi, v, a, tau);
    IF f_C * f_B <= 0 THEN
      A_val := B_val;
      f_A := f_B;
    ELSE
      f_A := f_A / 2.0;
    END IF;
    B_val := C_val;
    f_B := f_C;
  END LOOP;

  sigma_new := EXP(A_val / 2.0);

  -- Step 5
  phi_star := SQRT(POWER(phi, 2) + POWER(sigma_new, 2));

  -- Step 6
  phi_new := 1.0 / SQRT(1.0 / POWER(phi_star, 2) + 1.0 / v);
  mu_new := mu + POWER(phi_new, 2) * g_phi_j * (p_score - E);

  -- Step 7
  new_r := SCALE * mu_new + 1500.0;
  new_rd := SCALE * phi_new;
  new_vol := sigma_new;

  -- Ensure RD doesn't go below minimum (e.g. 30)
  IF new_rd < 30.0 THEN
    new_rd := 30.0;
  END IF;

  RETURN QUERY SELECT new_r, new_rd, new_vol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger Function: Update Glicko-2 ratings on match finish
CREATE OR REPLACE FUNCTION checkmeta_match_finished_trigger()
RETURNS trigger AS $$
DECLARE
  w_r numeric; w_rd numeric; w_vol numeric;
  b_r numeric; b_rd numeric; b_vol numeric;
  w_new_r numeric; w_new_rd numeric; w_new_vol numeric;
  b_new_r numeric; b_new_rd numeric; b_new_vol numeric;
  w_score numeric; b_score numeric;
BEGIN
  IF NEW.status = 'finished' AND OLD.status = 'playing' THEN
    -- Get current ratings
    SELECT rating, rd, volatility INTO w_r, w_rd, w_vol FROM public.checkmeta_ratings WHERE user_id = NEW.player_white_id;
    SELECT rating, rd, volatility INTO b_r, b_rd, b_vol FROM public.checkmeta_ratings WHERE user_id = NEW.player_black_id;

    -- If players don't have ratings yet for some reason, use defaults
    IF w_r IS NULL THEN w_r := 1500.0; w_rd := 350.0; w_vol := 0.06; END IF;
    IF b_r IS NULL THEN b_r := 1500.0; b_rd := 350.0; b_vol := 0.06; END IF;

    -- Determine score
    IF NEW.result = '1-0' THEN
      w_score := 1.0; b_score := 0.0;
    ELSIF NEW.result = '0-1' THEN
      w_score := 0.0; b_score := 1.0;
    ELSE
      w_score := 0.5; b_score := 0.5;
    END IF;

    -- Calculate new ratings
    SELECT * INTO w_new_r, w_new_rd, w_new_vol FROM checkmeta_calculate_glicko2(w_r, w_rd, w_vol, b_r, b_rd, b_vol, w_score);
    SELECT * INTO b_new_r, b_new_rd, b_new_vol FROM checkmeta_calculate_glicko2(b_r, b_rd, b_vol, w_r, w_rd, w_vol, b_score);

    -- Update ratings
    UPDATE public.checkmeta_ratings 
    SET rating = w_new_r, rd = w_new_rd, volatility = w_new_vol, games_played = games_played + 1, last_played_at = now() 
    WHERE user_id = NEW.player_white_id;
    
    UPDATE public.checkmeta_ratings 
    SET rating = b_new_r, rd = b_new_rd, volatility = b_new_vol, games_played = games_played + 1, last_played_at = now() 
    WHERE user_id = NEW.player_black_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_checkmeta_match_finished ON public.checkmeta_matches;
CREATE TRIGGER trg_checkmeta_match_finished
AFTER UPDATE OF status ON public.checkmeta_matches
FOR EACH ROW EXECUTE FUNCTION checkmeta_match_finished_trigger();


-- Trigger Function: Validate time mathematically
CREATE OR REPLACE FUNCTION checkmeta_validate_move_time()
RETURNS trigger AS $$
DECLARE
  elapsed_real_ms bigint;
  reported_spent_ms bigint;
  buffer_ms bigint := 1500; -- 1.5 seconds tolerance for lag/latency
BEGIN
  -- Only validate if it's an update during active play and time left changed
  IF NEW.status = 'playing' AND OLD.status = 'playing' AND OLD.last_move_at IS NOT NULL THEN
    
    -- Real time passed on the server
    elapsed_real_ms := EXTRACT(EPOCH FROM (now() - OLD.last_move_at)) * 1000;
    
    -- Validate White
    IF NEW.white_time_left_ms < OLD.white_time_left_ms THEN
      -- The client says they spent this much time (adding back the increment since the client added it)
      reported_spent_ms := OLD.white_time_left_ms - NEW.white_time_left_ms + (COALESCE(NEW.time_control_increment, 0) * 1000);
      
      -- If the client says they spent LESS time than elapsed on the server minus the buffer
      IF reported_spent_ms < (elapsed_real_ms - buffer_ms) THEN
        RAISE EXCEPTION 'Cheating detected! Server elapsed %ms, but client reported only %ms spent.', elapsed_real_ms, reported_spent_ms;
      END IF;
    END IF;

    -- Validate Black
    IF NEW.black_time_left_ms < OLD.black_time_left_ms THEN
      reported_spent_ms := OLD.black_time_left_ms - NEW.black_time_left_ms + (COALESCE(NEW.time_control_increment, 0) * 1000);
      
      IF reported_spent_ms < (elapsed_real_ms - buffer_ms) THEN
        RAISE EXCEPTION 'Cheating detected! Server elapsed %ms, but client reported only %ms spent.', elapsed_real_ms, reported_spent_ms;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_checkmeta_validate_time ON public.checkmeta_matches;
CREATE TRIGGER trg_checkmeta_validate_time
BEFORE UPDATE ON public.checkmeta_matches
FOR EACH ROW EXECUTE FUNCTION checkmeta_validate_move_time();
