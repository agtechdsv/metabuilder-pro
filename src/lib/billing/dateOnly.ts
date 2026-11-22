/**
 * Data "só dia" (YYYY-MM-DD, como o vencimento do Asaas e `payments.due_date`) para texto dd/mm/aaaa, SEM fuso.
 * `new Date('2026-11-16')` vale meia-noite UTC; no Brasil (UTC-3) isso é o dia 15 às 21h, e a tela mostrava 15/11 para uma fatura de 16/11.
 * Devolve null se não for uma data só-dia (quem chama segue com o tratamento de data e hora).
 */
export function formatDateOnly(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}
