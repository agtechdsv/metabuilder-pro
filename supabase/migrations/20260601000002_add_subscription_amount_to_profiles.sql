-- ==============================================================================
-- Migration: Add subscription_amount to profiles
-- ==============================================================================

-- 1. Add subscription_amount column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_amount NUMERIC(10, 2) DEFAULT 0.00;
