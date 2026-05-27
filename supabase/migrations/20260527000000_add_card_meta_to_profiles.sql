-- ==============================================================================
-- Migration: Add Card Metadata to Profiles
-- Filename: 20260527000000_add_card_meta_to_profiles.sql
-- ==============================================================================

-- Adicionar colunas de dados do cartão na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_brand TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_last_digits TEXT;
