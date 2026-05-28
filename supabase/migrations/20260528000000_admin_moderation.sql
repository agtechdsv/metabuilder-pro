-- Migration: Add fields for Admin Moderation (Hiding content & Blocking users)

-- 1. Add is_hidden to community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 2. Add is_hidden to community_comments
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 3. Add is_hidden to suggestions
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 4. Add is_blocked_community to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked_community BOOLEAN DEFAULT FALSE;

-- 5. Add is_blocked_metavoice to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked_metavoice BOOLEAN DEFAULT FALSE;
