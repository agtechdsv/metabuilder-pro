-- Migration: Automatically Activate and Unblock Invited Guest Developers
-- Filename: 20260529000000_activate_invited_devs.sql

-- 1. Create trigger function to handle guest profile changes
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
        AND plan_id IS NULL;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind trigger to owner_guests table
DROP TRIGGER IF EXISTS tr_handle_guest_profile_changes ON public.owner_guests;
CREATE TRIGGER tr_handle_guest_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.owner_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_guest_profile_changes();

-- 3. Retroactively activate all currently registered guest users
UPDATE public.profiles
SET subscription_status = 'active',
    is_blocked = false
WHERE id IN (SELECT user_id FROM public.owner_guests)
  AND is_super_admin = false;
