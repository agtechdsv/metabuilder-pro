-- Migration: Add size_bytes to desktop_builds table
ALTER TABLE public.desktop_builds ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
