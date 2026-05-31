-- Fix trigger to use asaas_subscription_id instead of plan_id since plan_id was removed

CREATE OR REPLACE FUNCTION public.handle_guest_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Guest added or updated -> Activate profile
    UPDATE public.profiles
    SET subscription_status = 'active',
        is_blocked = false
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Guest removed -> Check if they are still a guest of ANY owner
    IF NOT EXISTS (
      SELECT 1 FROM public.owner_guests WHERE user_id = OLD.user_id
    ) THEN
      -- Revert to pending/blocked if they don't have their own active plan and are not admin
      UPDATE public.profiles
      SET subscription_status = 'pending',
          is_blocked = true
      WHERE id = OLD.user_id 
        AND is_super_admin = false 
        AND asaas_subscription_id IS NULL;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
