-- ==========================================================
-- Migration: Convert iclub_rules.name to JSONB for Multi-Language
-- ==========================================================

DO $$
BEGIN
    -- Check if name column is of type text or varchar
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'iclub_rules' 
          AND column_name = 'name' 
          AND data_type IN ('text', 'character varying')
    ) THEN
        -- Convert existing TEXT names into JSONB objects
        ALTER TABLE public.iclub_rules 
        ALTER COLUMN name TYPE JSONB 
        USING CASE 
            -- If already stored as JSON string
            WHEN name ~ '^\s*\{.*\}\s*$' THEN name::jsonb
            -- Specific predefined rules
            WHEN name ILIKE '%indica%' THEN jsonb_build_object(
                'pt', 'Desconto por Indicação Ativa',
                'en', 'Active Referral Discount',
                'es', 'Descuento por Referido Activo'
            )
            WHEN name ILIKE '%volume%' OR name ILIKE '%grátis%' OR name ILIKE '%gratis%' THEN jsonb_build_object(
                'pt', 'Licença Grátis por Volume',
                'en', 'Free License by Volume',
                'es', 'Licencia Gratis por Volumen'
            )
            -- Fallback
            ELSE jsonb_build_object('pt', name, 'en', name, 'es', name)
        END;
    END IF;
END $$;
