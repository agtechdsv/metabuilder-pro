# Avisos de cobrança (e-mail e tela) feitos pelo MetaBuilder: desenho, publicação e teste

Decisões fechadas com o dono em 2026-11-13. **Código escrito e verificado (tsc, testes, build); nada publicado e nada testado com o Asaas real.**

## Objetivo
Avisar o cliente (e o admin) sobre cobrança **sem pagar as notificações do Asaas**. No checkout o cliente do Asaas é criado com `notificationDisabled: true`, então o Asaas não manda lembrete, fatura nem aviso de atraso. Os avisos saem pelo **nosso SMTP** (o mesmo do checkout, parceiros e vagas) e por um **banner na tela do dono**.

## O que o cliente recebe (pt, en ou es, no idioma gravado no checkout)
| Aviso | Quando |
|---|---|
| Fatura gerada (Pix e boleto) | evento `PAYMENT_CREATED` do Asaas (renovação) |
| Lembrete: 3 dias antes | rotina diária |
| Lembrete: no dia do vencimento | rotina diária |
| Fatura vencida (1 dia depois) | evento `PAYMENT_OVERDUE` |
| Último aviso (3 dias depois) | rotina diária |
| Conta suspensa | rotina diária, ao fim da carência |
| Pagamento recebido (recibo; diz se o acesso foi restabelecido) | `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` |
| Cartão recusado | `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` |
| Estorno | `PAYMENT_REFUNDED` |
| Renovação cancelada | ao cancelar (`asaas-cancel`) |
| Acesso termina em 7 dias (quem cancelou) | rotina diária |

**Banner na tela do dono** (`/client/dashboard` e `/workspace`): fatura vencendo em até 7 dias, vencida (com a data de suspensão, se houver carência) ou cartão recusado. Só aparece com os avisos ligados.

## O que o admin recebe
Cobrança vencida, estorno/chargeback, **pagamento que o webhook não conseguiu ligar a nenhum cliente** (antes sumia em silêncio) e um **resumo diário só com contagens**.

## Regras
- **Interruptor** na aba **Sistema** > Avisos de cobrança: nasce **desligado**. Desligado = nada é enviado e o atraso suspende no mesmo dia, como sempre foi.
- **Carência** (padrão 3 dias, 0 a 30): ao vencer, o cliente só é marcado em atraso (`profiles.overdue_since`); a rotina diária suspende quando a carência acaba. Pagou: a marca zera. Carência 0 = suspende já.
- **Sem repetição:** `billing_notices` tem índice único em `(tipo, referência)`: o Asaas repetindo o evento, ou a rotina rodando de novo, nunca manda o mesmo aviso duas vezes. Falha de envio tenta de novo até 3 vezes. Aviso de cobrança que foi paga/estornada no meio tempo é descartado.
- **Idioma:** `profiles.billing_language`, gravado a cada checkout. Sem ele, português.

## Correções de ciclo de vida que vieram junto
1. **Cancelar a renovação:** o app publicado do cliente **não é mais suspenso na hora**; fica no ar até a data de fim do acesso (como a tela de assinatura promete). **Antes nada encerrava o acesso quando a data passava**: agora a rotina diária (sempre, mesmo com os avisos desligados) muda para bloqueado quem cancelou e passou da data.
2. **Assinatura duplicada:** o checkout que cria nova assinatura (ex.: cliente suspenso que volta a pagar) **cancela a antiga no Asaas antes**, limpando o vínculo no perfil primeiro (para o evento de exclusão não cancelar o cliente nem revogar recompensas).

## Onde está
| Peça | Arquivo |
|---|---|
| Tabela, colunas, ajuste | `scripts/avisos-cobranca.sql` |
| Regras puras (cadência, carência, ajustes) | `supabase/functions/_shared/billingCore.ts` |
| Fila e chamada ao site, nas Edge Functions | `supabase/functions/_shared/billing.ts` |
| Eventos do Asaas | `supabase/functions/asaas-webhook/index.ts` |
| Cancelamento e checkout | `supabase/functions/asaas-cancel`, `asaas-checkout` |
| E-mails (modelo da marca) | `src/lib/billing/billingMailText.ts` |
| Fila, lembretes, suspensão, resumo | `src/lib/billing/billingService.ts` |
| Rota que o webhook chama / rotina diária | `src/app/api/billing/notify/route.ts`, `src/app/api/cron/billing-notices/route.ts` (11:00 UTC = 8h em Brasília) |
| Tela do admin / banner | `src/components/admin/BillingNoticesAdmin.tsx`, `src/components/billing/BillingBanner.tsx` |
| Testes | `src/lib/__tests__/billingNotices.test.ts` |

## Ordem de publicação (importa)
1. **SQL:** rodar `scripts/avisos-cobranca.sql` no SQL Editor de produção (as Edge Functions passam a gravar `overdue_since`; sem o SQL, o webhook falha ao atualizar o perfil).
2. **Segredo compartilhado** (um texto longo e aleatório, igual nos dois lugares):
   - Vercel: `BILLING_NOTIFY_SECRET`.
   - Supabase > Edge Functions > Secrets: `BILLING_NOTIFY_SECRET` (o mesmo) e `BILLING_NOTIFY_URL` = `https://www.metabuilderpro.com/api/billing/notify`.
   - Sem eles nada quebra: o webhook só não cutuca o site e os avisos saem na rotina diária (até 24 h de atraso).
3. **Deploy das Edge Functions:** `supabase functions deploy asaas-webhook asaas-checkout asaas-cancel` (ou `node scripts/bundle-edge-functions.mjs` e colar no painel).
4. **Deploy do site** (Vercel; o cron novo entra com o `vercel.json`).
5. **Asaas > Integrações > Webhooks:** acrescentar os eventos `PAYMENT_CREATED` e `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` (confirmar o nome exato na documentação do Asaas) aos que já estão assinados.
6. Aba **Sistema** > Avisos de cobrança: conferir a carência e o e-mail dos alertas e **ligar**.

## Roteiro de teste
1. Ligar com um cliente de teste e conferir, em `billing_notices`, que os avisos entram e saem (status `sent`).
2. Pagar uma assinatura de teste por Pix: chega o recibo; na renovação seguinte, a fatura gerada.
3. Deixar uma cobrança de teste vencer: chega o aviso de vencida, o banner aparece na tela, e a conta só é suspensa depois da carência (e chega o aviso de suspensão). Pagar depois: o acesso volta e chega o recibo dizendo que foi restabelecido.
4. Cancelar a renovação de um cliente de teste: chega o aviso; o app publicado continua no ar até a data.
5. Rodar a rotina à mão: `GET /api/cron/billing-notices` com `Authorization: Bearer <CRON_SECRET>`.

## Limites honestos
- **Quando o Asaas marca como vencido** (normalmente no dia seguinte ao vencimento) e **o nome exato do evento de cartão recusado** dependem do Asaas e precisam ser confirmados no teste real.
- A validade (`subscription_expires_at`) continua sendo recalculada a cada confirmação ("agora + ciclo"); no cartão, o Asaas pode mandar o `RECEIVED` só na liquidação, o que empurra a data. Agora que a rotina fecha quem cancelou depois da data, vale conferir essa data no primeiro ciclo de cartão. **Não foi mexido nisso.**
- Estorno e chargeback **não bloqueiam** o acesso (só revogam recompensas e comissões e avisam o admin). Decisão de negócio pendente.
- O envio depende do SMTP (limites diários da hospedagem do e-mail). A deliverabilidade depende de SPF, DKIM e DMARC do domínio.
