-- Add subscription_licenses to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_licenses INTEGER DEFAULT 1;
