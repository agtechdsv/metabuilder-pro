-- ==============================================================================
-- Migration: Add Insert Policy for Payments
-- ==============================================================================

-- Política para o próprio usuário conseguir registrar as intenções de pagamento
DROP POLICY IF EXISTS "Permitir usuário inserir pagamentos" ON public.payments;
CREATE POLICY "Permitir usuário inserir pagamentos"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
