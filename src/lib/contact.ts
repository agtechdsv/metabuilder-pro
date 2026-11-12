/**
 * Contatos que o MetaBuilder PRO mostra aos clientes. Um lugar só: para trocar o número, é aqui.
 * O WhatsApp é usado nos botões "Falar com a equipe" do plano Enterprise (página de preços e checkout).
 */

/** WhatsApp comercial, com código do país e DDD, só dígitos. */
export const SALES_WHATSAPP = '5531984838184'

/** Link wa.me já com a mensagem pronta (o texto é codificado aqui). */
export function salesWhatsappUrl(message: string): string {
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(message)}`
}
