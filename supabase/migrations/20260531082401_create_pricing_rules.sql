CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 450.00,
    volume_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    cycle_discounts JSONB NOT NULL DEFAULT '{"quarterly": 10, "semiannual": 15, "yearly": 20}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage pricing_rules" ON public.pricing_rules
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_super_admin = true
        )
    );

-- Everyone can read pricing_rules (needed for checkout/landing page)
CREATE POLICY "Everyone can read pricing_rules" ON public.pricing_rules
    FOR SELECT
    USING (true);

-- Insert a default rule if empty
INSERT INTO public.pricing_rules (base_price, volume_tiers, cycle_discounts)
VALUES (
    450.00,
    '[{"min_licenses": 3, "discount_percent": 5}, {"min_licenses": 5, "discount_percent": 7}, {"min_licenses": 10, "discount_percent": 12}, {"min_licenses": 20, "discount_percent": 15}, {"min_licenses": 30, "discount_percent": 20}]'::jsonb,
    '{"quarterly": 10, "semiannual": 15, "yearly": 20}'::jsonb
);
