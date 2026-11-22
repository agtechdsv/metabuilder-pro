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

## Cliente FREE que só abriu o checkout (21/11/2026)
- **Quem é:** plano grátis (`subscription_tier` free ou vazio) e nenhum pagamento `paid`. Regra pura em `billingCore.ts` (`isCheckoutOnly`).
- **Nunca é suspenso** e não recebe os avisos de atraso/suspensão do PRO: a rotina (`suspendAfterGrace`) o pula, o webhook (`PAYMENT_OVERDUE`) não grava `blocked` nem `overdue_since`, e `processQueue` descarta avisos desses tipos que tenham ficado na fila. O app já ignora o bloqueio de conta FREE, então suspender só gerava e-mail falso.
- **Recebe só o lembrete suave** `checkout_reminder`: 1 e 3 dias depois de gerada a cobrança, só da primeira cobrança, e nada depois de 10 dias. O botão abre `/client/dashboard?tab=subscription`.
- **Na tela:** o banner de cobrança aparece também para ele (texto suave) e a aba Assinatura (QR Code Pix e "Pagar com cartão") fica visível enquanto houver cobrança aberta, mesmo sem licenças.
- **Suspensão e cartão recusado** (PRO) também abrem a aba Assinatura.
- **Dados:** `scripts/corrigir-free-suspenso.sql` desfaz a marca de "suspenso" de contas FREE sem pagamento.
- **Pendente:** cancelar no Asaas a cobrança/assinatura abandonada depois do último lembrete. Hoje só o webhook/Edge Function fala com o Asaas; exige uma função nova e deploy.

## Correções do teste de 21/11/2026 (renovação paga pela tela)
- **QR da cobrança errada:** `asaas-update-subscription` (GET) só pedia `status=PENDING` ao Asaas, então a cobrança VENCIDA sumia e a tela mostrava (e o cliente pagava) a próxima, que ainda nem tinha vencido. Agora pede OVERDUE e PENDING e mostra a mais antiga primeiro.
- **Pagamento de renovação não gravado:** `payments.external_reference` é ÚNICO e o Asaas repete a referência da assinatura em todas as cobranças. O insert do webhook (PAYMENT_CREATED e PAYMENT_RECEIVED) falhava em silêncio quando a cobrança não existia no banco: sem histórico, sem fila de NFS-e, sem comissão. Agora a referência da renovação é `<referência>~<id do pagamento>` e o erro do insert vai para o log. Reconciliação do caso de teste: `scripts/reconciliar-pagamento-lgpd-dezembro.sql`.
- **Tela depois do Pix:** enquanto a cobrança está na tela, ela consulta o nosso banco a cada 5 s (o webhook grava lá) e, quando o pagamento entra, avisa, atualiza o perfil e a tela. Para sozinha em 15 min.
- **QR ampliado:** lupa no QR Code abre uma janela com o código grande para o banco ler.

## Cobrança abandonada do checkout é cancelada no Asaas (22/11/2026)

Quem abriu o checkout, gerou a cobrança (Pix) e nunca pagou fica com cliente, assinatura e cobrança abertos no Asaas. Passada a janela dos lembretes (`CHECKOUT_REMINDER_MAX_DAYS` = 10 dias), a rotina diária (`runBillingNotices`, só com os avisos ligados) cancela tudo:

- **Quem pede:** `cancelAbandonedCheckouts` (`billingService.ts`) chama a Edge Function `admin-cancel-billing` com a chave de serviço e `purpose: "abandoned"`. O site não tem a chave do Asaas.
- **Quem conta:** só entra quem é FREE e nunca pagou, e só quando a cobrança aberta MAIS NOVA do cliente já passou da janela (quem gerou outra cobrança há pouco não tem o checkout novo cancelado). Até 20 clientes por rodada.
- **Dupla conferência:** a função reconfere sozinha (FREE e sem pagamento recebido, senão responde 409). A chave de serviço só vale para `abandoned`; o resto continua exigindo o SuperAdmin.
- **O que acontece:** o vínculo `asaas_subscription_id` sai do perfil ANTES (o evento de exclusão do Asaas não marca o cliente como "cancelado" nem mexe em indicação); a assinatura e as cobranças abertas são apagadas no Asaas; as linhas abertas de `payments` viram `canceled` (saem do banner e dos lembretes). Se o Asaas falhar, o vínculo volta e a rotina tenta de novo no dia seguinte.
- **Quando o cliente volta:** o checkout cria assinatura e cobrança novas, como num cliente novo.
- **Deploy:** publicar a Edge Function `admin-cancel-billing` e o site.

## Cobranças do SuperAdmin: cancelar e estornar (22/11/2026, fase 2)

Tela **Clientes > Cobranças**, coluna Ações. Tudo passa pela Edge Function `admin-cancel-billing` (sessão do SuperAdmin; a chave do Asaas fica lá) e grava uma linha em `mb_admin_billing_log` **antes** de falar com o Asaas (sem a tabela, a ação é recusada).

| Ação | No Asaas | No nosso banco |
|---|---|---|
| **Cancelar cobrança** (pendente ou vencida) | apaga só essa cobrança; a assinatura continua | linha vira `canceled`; se era a única vencida, `overdue_since` é limpo |
| **Cancelar assinatura** | apaga a assinatura (e, por padrão, as cobranças abertas) | cliente `canceled`, acesso até o fim do período (como no cancelamento do próprio cliente); o vínculo permanece para o webhook revogar recompensas e comissão; aviso "renovação cancelada" |
| **Estornar** (só **Pix e cartão**; boleto no painel do Asaas) | `POST /payments/{id}/refund`, total ou parcial | NADA muda na hora: a linha vira `refunded` quando o webhook (`PAYMENT_REFUNDED`) confirmar; o registro fica `requested` até lá |

Guardas: motivo obrigatório no estorno e palavra de confirmação na tela; valor entre R$ 0,01 e o pago; pedido repetido da mesma cobrança em 10 min é recusado; o estorno pode cancelar a assinatura junto (opcional). Os eventos de estorno do webhook revogam comissão e recompensas, **exceto o parcial**, que só avisa o admin.

**Webhook (eventos novos, marcar no Asaas > Integrações > Webhooks):** `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED`, `PAYMENT_DELETED` (cobrança apagada, inclusive no painel do Asaas), `PAYMENT_UPDATED` (vencimento ou valor mudou), `PAYMENT_RESTORED`. Opcionais, só para alerta: `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`.

**Deploy:** 1) rodar `scripts/admin-cobrancas.sql` no SQL Editor; 2) publicar as Edge Functions `admin-cancel-billing` e `asaas-webhook`; 3) deploy do site; 4) marcar os eventos novos no Asaas. O estorno de Pix pode falhar por falta de saldo na conta do Asaas; a tela mostra a mensagem dele. Não verificado: se a chave de API do Asaas tem permissão de estorno.
