-- Migration: Add version to desktop_builds table
ALTER TABLE public.desktop_builds ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0';
