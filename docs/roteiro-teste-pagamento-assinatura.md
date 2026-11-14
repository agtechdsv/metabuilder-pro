# Roteiro de teste: pagamento de assinatura (cliente avulso e cliente indicado por parceiro)

Escrito em 2026-11-14. O Asaas é de **produção**: o dinheiro é **real**. Use valores pequenos quando der e anote o que pagou para estornar depois, se quiser.

## 0. Antes de começar

### Estado conferido em 2026-11-14 (pelo banco, somente leitura)
- SQL dos avisos de cobrança, do vínculo de parceiro por e-mail e da chave Pix pendente: **rodados**.
- Avisos de cobrança: **desligados** (padrão). Vagas de sessão: **desligadas**.
- 1 parceiro: código `ALEXANDRE`, ativo, com conta, chave Pix ativa, 0 indicados, 0 comissões.
- Condições dos parceiros: 15%, carência 7 dias, mínimo R$ 50, teto R$ 5.000.

### O que eu **não** consigo ver e você precisa conferir
1. **As 3 Edge Functions estão publicadas com o código novo?** `asaas-webhook`, `asaas-checkout` e `asaas-cancel` mudaram (idioma do cliente no checkout, cancelamento da assinatura antiga, avisos, carência). Publicar é seguro: o SQL já está no banco.
   ```bash
   supabase functions deploy asaas-webhook asaas-checkout asaas-cancel
   ```
   (ou `node scripts/bundle-edge-functions.mjs` e colar cada `index.ts` no painel do Supabase.)
2. O **site** está no ar com o último commit (Vercel).

### Contas de teste (use e-mails que **nunca pagaram**)
| Papel | Quem | Observação |
|---|---|---|
| Parceiro | `ALEXANDRE` (já existe) | painel em `/parceiro` |
| Cliente avulso (**A**) | um e-mail novo seu | entra pelo site, **sem** `?ref=` |
| Cliente indicado (**B**) | outro e-mail novo seu | entra pelo link do parceiro |

- **A e B não podem ser o e-mail do parceiro** (a auto-indicação é barrada) e **cada um precisa ser uma conta nova** (a indicação é registrada no cadastro).
- Use **janela anônima** (ou perfil do Chrome limpo) para cada um: o código do parceiro fica num cookie.

### Ajustes provisórios só para o teste dos parceiros (volte depois)
`/admin/platform` > **Regras de Preços** > **Comissão dos parceiros**: **carência 0** e **mínimo R$ 1**. Salvar. (Voltar para **7** e **50** no fim.)

---

## A. Cliente que entrou sozinho (sem parceiro)

1. Janela anônima. Abra `https://metabuilderpro.com/` **sem** `?ref=`. Crie a conta **A** e confirme o e-mail.
2. Vá ao checkout: **1 licença, mensal, Pix** (o mais fácil de provar). **Anote o total mostrado** (ele vem do servidor).
3. Pague o Pix. A tela de espera deve confirmar sozinha em poucos segundos.
4. **Conferir no banco** (SQL Editor, ou me peça que eu leio):
   ```sql
   select subscription_status, is_blocked, subscription_cycle, subscription_licenses, subscription_amount,
          subscription_expires_at, (asaas_subscription_id is not null) as tem_assinatura, overdue_since, billing_language
     from public.profiles where lower(email) = lower('EMAIL_A');

   select status, amount, billing_type, cycle, due_date, created_at
     from public.payments where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_A'))
    order by created_at desc;
   ```
   Esperado: `subscription_status = active`, `is_blocked = false`, validade em torno de **hoje + 1 mês**, `subscription_amount` igual ao total pago, `tem_assinatura = true`, `billing_language` = o idioma que o cliente usava (`pt`, `en` ou `es`), pagamento `paid`.
5. **Nenhuma** indicação nem comissão deve existir para A:
   ```sql
   select count(*) from public.partner_referrals where lower(referred_email) = lower('EMAIL_A');   -- esperado: 0
   ```
6. No **painel do Asaas**: assinatura ativa, valor correto e **próxima cobrança** daqui a um mês.
7. Como cliente A, abra `/client/dashboard`: a assinatura aparece como ativa, com a data da próxima renovação.
8. (Opcional) **Cancelar a renovação** em Assinatura: o status vira `canceled`, o painel diz "acesso mantido até a data" e a assinatura some no Asaas. **O app publicado continua no ar** até a data (correção nova).

---

## B. Cliente indicado por um parceiro

1. Entre como parceiro (`agtechtrade@gmail.com`), abra `/parceiro` e **copie o link de indicação** (`https://metabuilderpro.com/?ref=ALEXANDRE`).
2. **Janela anônima nova.** Abra o link. Crie a conta **B** e confirme o e-mail.
3. **Conferir a indicação** (antes de pagar):
   ```sql
   select status, referred_email, created_at from public.partner_referrals where lower(referred_email) = lower('EMAIL_B');
   ```
   Esperado: 1 linha `registered`. No painel do parceiro, aba **Indicados**: o e-mail de B aparece **mascarado**.
4. Como B, faça o checkout e **pague** (Pix ou cartão). **Anote o valor pago.**
5. **Conferir a comissão:**
   ```sql
   select r.status as indicacao, c.gross, c.net, c.percent, c.amount, c.status, c.release_at, c.clawback
     from public.partner_referrals r
     left join public.partner_commissions c on c.referral_id = r.id
    where lower(r.referred_email) = lower('EMAIL_B');
   ```
   Esperado: indicação `subscribed`; **1 comissão**; `gross` = valor pago; `percent` = 15; `amount` = **15% do bruto, arredondado para baixo no centavo**; `status = pending`; `release_at` = **agora** (carência 0).
6. **Painel do parceiro** (`/parceiro`): o cartão **Disponível/Próximo pagamento** mostra o valor; a aba **Indicados** mostra B como **Assinante**; a aba **Comissões** mostra o pagamento. Confira o texto "Sua comissão: 15%...".
7. **Pagar o parceiro:** `/admin/platform` > aba **Parceiros** > marque ALEXANDRE > **Pagar por Pix...** > confira o resumo > confirme. O item vai de **Enviando** para **Em processamento** e para **Pago**, o Pix chega na chave do parceiro e o **comprovante** aparece.
   - Se travar em **Enviando** sem comprovante, **não reenvie**: confira no painel do Asaas. Se não existir a transferência, use **Liberar**.
8. (Opcional) **Estorno:** estorne o pagamento de B no Asaas. Comissão ainda pendente vira **Cancelada**; já paga, aparece **A descontar** e o próximo lote desconta.
9. **Volte os ajustes:** carência **7**, mínimo **50**.

---

## C. Avisos de cobrança (só depois de A e B)

Os avisos nascem **desligados**. Para testar:

1. **Segredo compartilhado** (um texto longo e aleatório, igual nos dois lados): `BILLING_NOTIFY_SECRET` na Vercel e no Supabase (Edge Functions > Secrets), e `BILLING_NOTIFY_URL` = `https://www.metabuilderpro.com/api/billing/notify` no Supabase. Sem eles os avisos saem na rotina diária (até 24 h de atraso).
2. **Asaas > Integrações > Webhooks:** acrescente `PAYMENT_CREATED` e `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` (confirme o nome exato na documentação do Asaas).
3. **Aba Sistema > Avisos de cobrança:** confira a carência e o e-mail dos alertas, marque **Ligado**, salve.
4. **Recibo:** pague uma assinatura de teste. Em poucos segundos chega o e-mail "Recebemos o seu pagamento", no idioma do cliente. Em `billing_notices`:
   ```sql
   select kind, status, attempts, last_error, created_at, sent_at from public.billing_notices order by created_at desc limit 20;
   ```
   Esperado: `payment_received` com `sent`.
5. **Vencida e carência:** com um cliente de teste e uma cobrança de teste (Pix, vencimento curto), deixe vencer. Esperado: aviso de vencida (1 dia), **banner vermelho** na tela do cliente com a data de suspensão, **sem suspender** durante a carência, aviso final (3 dias), suspensão no fim da carência (com e-mail) e, ao pagar depois, acesso de volta com recibo "restabelecido".
6. **Rotina à mão:** `GET https://www.metabuilderpro.com/api/cron/billing-notices` com o cabeçalho `Authorization: Bearer <CRON_SECRET>` (roda sozinha às 8h de Brasília).
7. **Desligar** (caixa Desligado) volta ao comportamento antigo.

---

## D. Se algo não aparecer

| Sintoma | Onde olhar |
|---|---|
| Pagou e o acesso não liberou | Supabase > Edge Functions > **asaas-webhook** > Logs. Procure `Received Asaas Webhook event`. Sem log, o Asaas não está chamando: confira o token do webhook. |
| Comissão não nasceu | O indicado só gera comissão se existir `partner_referrals` para o e-mail dele **e** o parceiro estiver `active`. Se B já tinha conta antes do link, a indicação não é criada. |
| Comissão com valor estranho | `gross` é o valor **pago pelo cliente** (bruto); `amount` = 15% disso. |
| Aviso não chegou | Tabela `billing_notices`: `failed` com `last_error`. "o SMTP recusou ou não está configurado" = confira `SMTP_*` na Vercel. Veja também o spam. |
| Pix do parceiro não saiu | Aba Parceiros > lotes: o item mostra o motivo. Cheque a chave Pix aceita e a validação de saque do Asaas (`docs/parceiros-desenho.md`). |

## Depois do teste
- Anote o que pagou e estorne no Asaas o que não quiser manter.
- Volte os ajustes dos parceiros (carência 7, mínimo 50).
- Se for ligar os avisos de verdade, faça pela aba Sistema e acompanhe `billing_notices` nos primeiros dias.
