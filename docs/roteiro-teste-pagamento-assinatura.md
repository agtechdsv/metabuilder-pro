# Roteiro de teste: pagamento de assinatura (cliente avulso e cliente indicado por parceiro)

Escrito em 2026-11-14 e **atualizado em 2026-11-16** com o que já foi feito. O Asaas é de **produção**: o dinheiro é **real**. Marque cada passo com `[x]` ao passar e anote o que fugir do esperado.

## Situação em 2026-11-16

| Bloco | Estado |
|---|---|
| **A.** Cliente que entrou sozinho | feito (A1 a A7); falta só o **A8**, cancelar a renovação da conta de teste |
| **B.** Cliente indicado por parceiro | feito (B1 a B7: comissão, painel, repasse Pix a 2 parceiros e e-mails); **B8** (estorno) não feito, é opcional |
| **C.** Avisos de cobrança | passos 1 a 4 e 6 feitos; **passo 5 (vencida, carência, suspensão e restabelecido) aguardando as datas**; passo 7 não testado |

**Próximos marcos** (conta de teste LGPD, fatura de R$ 5,00 em Pix, **sem pagar até o passo 5f**): 17/11, 19/11 e 20/11.

## 0. Antes de começar

### Estado atual (conferido pelo banco, somente leitura)
- SQL dos avisos de cobrança, do vínculo de parceiro por e-mail e da chave Pix pendente: **rodados**.
- Avisos de cobrança: **ligados**, carência de **3 dias**. Vagas de sessão: em teste (veja `docs/sessoes-dispositivos-roteiro-teste.md`).
- Condições dos parceiros (definidas por você em 16/11): **18%**, carência **7 dias**, mínimo **R$ 50**, teto do lote **R$ 5.000**. A comissão é sobre o valor **bruto pago**, vale enquanto o indicado for assinante, e o percentual fica gravado no dia da comissão.
- Preço-base: **R$ 349,00** por licença (Regras de Preços), com descontos por volume (5 licenças = 5%, 20 = 10%, 50 = 15%) e por ciclo (semestral 10%, anual 20%). A campanha **Black November** dá 50% nos 2 primeiros meses de cliente novo: **um Pix de teste de 1 licença mensal custa R$ 174,50**.
- Notificações do Asaas ao cliente ficam **desabilitadas** na criação do cliente (`notificationDisabled`): o cliente só recebe os **nossos** e-mails.

### O que eu **não** consigo ver e você precisa conferir
1. **As Edge Functions estão publicadas com o código novo?** `asaas-webhook`, `asaas-checkout`, `asaas-cancel` e `admin-cancel-billing`.
   ```bash
   supabase functions deploy asaas-webhook asaas-checkout asaas-cancel admin-cancel-billing
   ```
   (ou `node scripts/bundle-edge-functions.mjs` e colar cada arquivo de `supabase/functions-dashboard/` no painel do Supabase.)
2. O **site** está no ar com o último commit (Vercel). O endereço oficial é `https://www.metabuilderpro.com` (com `www`).

### Contas de teste (use e-mails que **nunca pagaram**)
| Papel | Quem | Observação |
|---|---|---|
| Parceiro | `ALEXANDRE` (já existe) | painel em `/parceiro` |
| Cliente avulso (**A**) | um e-mail novo seu | entra pelo site, **sem** `?ref=` |
| Cliente indicado (**B**) | outro e-mail novo seu | entra pelo link do parceiro |
| Avisos de cobrança | `lgpd@metabuilderpro.com` | conta grátis (`pending`, 0 licenças) com uma fatura Pix de R$ 5,00 em aberto |

- **A e B não podem ser o e-mail do parceiro** (a auto-indicação é barrada) e **cada um precisa ser uma conta nova**.
- Se o e-mail de B já teve uma indicação **cancelada** (conta apagada e recriada), a indicação antiga é arquivada e a nova entra (corrigido em 16/11). Indicação **ativa** continua valendo.
- Use **janela anônima** (ou perfil do Chrome limpo) para cada um: o código do parceiro fica num cookie.

### Ajustes provisórios para o teste dos parceiros (já feitos)
Em `/admin/platform` > **Regras de Preços** > **Comissão dos parceiros**, o teste usou carência 0 e mínimo R$ 1. **Já voltaram** e ficaram em **18% / 7 dias / R$ 50 / R$ 5.000**.

---

## A. Cliente que entrou sozinho (sem parceiro)

- [x] **A1.** Janela anônima. Abra `https://www.metabuilderpro.com/` **sem** `?ref=`. Crie a conta **A** e confirme o e-mail.
- [x] **A2.** Vá ao checkout: **1 licença, mensal, Pix**. **Anote o total mostrado** (ele vem do servidor).
- [x] **A3.** Pague o Pix. A tela de espera deve confirmar sozinha em poucos segundos.
- [x] **A4.** **Conferir no banco** (SQL Editor, ou me peça que eu leio):
   ```sql
   select subscription_status, is_blocked, subscription_cycle, subscription_licenses, subscription_amount,
          subscription_expires_at, (asaas_subscription_id is not null) as tem_assinatura, overdue_since, billing_language
     from public.profiles where lower(email) = lower('EMAIL_A');

   select status, amount, billing_type, cycle, due_date, created_at
     from public.payments where user_id = (select id from public.profiles where lower(email) = lower('EMAIL_A'))
    order by created_at desc;
   ```
   Esperado: `subscription_status = active`, `is_blocked = false`, validade em torno de **hoje + 1 mês**, `subscription_amount` igual ao total pago, `tem_assinatura = true`, `billing_language` = o idioma do cliente (`pt`, `en` ou `es`), pagamento `paid`.
- [x] **A5.** **Nenhuma** indicação nem comissão deve existir para A:
   ```sql
   select count(*) from public.partner_referrals where lower(referred_email) = lower('EMAIL_A');   -- esperado: 0
   ```
- [x] **A6.** No **painel do Asaas**: assinatura ativa, valor correto e **próxima cobrança** daqui a um mês.
- [x] **A7.** Como cliente A, abra `/client/dashboard`: a assinatura aparece como ativa, com a data da próxima renovação.
- [ ] **A8.** (Opcional) **Cancelar a renovação** em Assinatura: o status vira `canceled`, o painel diz "acesso mantido até a data" e a assinatura some no Asaas. **O app publicado continua no ar** até a data. *(Pendente: fazer pelo painel do cliente antes da próxima cobrança, por volta de 13 a 16/12; se quiser ver a renovação automática, espere essa data e cancele depois.)*

---

## B. Cliente indicado por um parceiro

- [x] **B1.** Entre como parceiro, abra `/parceiro` e **copie o link de indicação** (`https://www.metabuilderpro.com/?ref=ALEXANDRE`).
- [x] **B2.** **Janela anônima nova.** Abra o link. Crie a conta **B** e confirme o e-mail. *(O cadastro com Google também registra a indicação; ela é gravada no retorno do login.)*
- [x] **B3.** **Conferir a indicação** (antes de pagar):
   ```sql
   select status, referred_email, created_at from public.partner_referrals where lower(referred_email) = lower('EMAIL_B');
   ```
   Esperado: 1 linha `registered`. No painel do parceiro, aba **Indicados**: o e-mail de B aparece **mascarado**.
- [x] **B4.** Como B, faça o checkout e **pague** (Pix ou cartão). **Anote o valor pago.**
- [x] **B5.** **Conferir a comissão:**
   ```sql
   select r.status as indicacao, c.gross, c.net, c.percent, c.amount, c.status, c.release_at, c.clawback
     from public.partner_referrals r
     left join public.partner_commissions c on c.referral_id = r.id
    where lower(r.referred_email) = lower('EMAIL_B');
   ```
   Esperado: indicação `subscribed`; **1 comissão**; `gross` = valor pago; `percent` = o vigente no dia (hoje **18**); `amount` = **percentual do bruto, arredondado para baixo no centavo**; `status = pending`; `release_at` = hoje + a carência vigente.
- [x] **B6.** **Painel do parceiro** (`/parceiro`): o cartão **Disponível/Próximo pagamento** mostra o valor; a aba **Indicados** mostra B como **Assinante**; a aba **Comissões** mostra o pagamento e o texto "Sua comissão: ...%".
- [x] **B7.** **Pagar o parceiro:** `/admin/platform` > aba **Parceiros** > marque o parceiro > **Pagar por Pix...** > confira o resumo > confirme. O item vai de **Enviando** para **Em processamento** e para **Pago**, o Pix chega na chave do parceiro e o **comprovante** aparece. *(Feito com 2 parceiros; chegaram um e-mail para cada parceiro e um resumo para o administrador.)*
   - Se travar em **Enviando** sem comprovante, **não reenvie**: confira no painel do Asaas. Se não existir a transferência, use **Liberar**.
- [ ] **B8.** (Opcional) **Estorno:** estorne o pagamento de B no Asaas. Comissão ainda pendente vira **Cancelada**; já paga, aparece **A descontar** e o próximo lote desconta. *(Não feito.)*
- [x] **B9.** **Ajustes dos parceiros:** ficaram em carência **7**, mínimo **50**, comissão **18%**, teto **R$ 5.000** (decisão de 16/11).

**Também validado em 15 e 16/11:**
- [x] Excluir ou bloquear um cliente pelo painel **cancela a cobrança e a assinatura no Asaas** (a exclusão é abortada se o Asaas falhar, e um cliente que é parceiro não pode ser excluído).
- [x] Cliente excluído e recriado com o mesmo e-mail por outro link de indicação: a indicação cancelada é arquivada e a nova entra.

---

## C. Avisos de cobrança (só depois de A e B)

Os avisos nasceram **desligados** e já foram **ligados**. Resumo do que foi feito e do que falta:

- [x] **C1.** **Segredo compartilhado** (`BILLING_NOTIFY_SECRET` na Vercel e no Supabase) e `BILLING_NOTIFY_URL` = `https://www.metabuilderpro.com/api/billing/notify` no Supabase.
- [x] **C2.** **Asaas > Integrações > Webhooks:** `PAYMENT_CREATED`, `PAYMENT_OVERDUE` e `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` ativos. *(O `PAYMENT_OVERDUE` só será provado de verdade no C5a, quando a fatura da LGPD vencer: confira `overdue_since` e o log do `asaas-webhook`.)*
- [x] **C3.** **Aba Sistema > Avisos de cobrança:** carência de **3 dias** e e-mail dos alertas conferidos, **Ligado**, salvo.
- [x] **C4.** **Recibo:** o pagamento de teste gerou o e-mail "Recebemos o seu pagamento", no idioma do cliente. Em `billing_notices`:
   ```sql
   select kind, status, attempts, last_error, created_at, sent_at from public.billing_notices order by created_at desc limit 20;
   ```
   Esperado: `payment_received` com `sent`.
- [ ] **C5.** **Vencida e carência** (aguardando as datas). Conta de teste **LGPD**: fatura de **R$ 5,00** em Pix, vencimento **16/11/2026**, **sem pagar**. A conta está `pending` com 0 licenças (nunca foi assinante ativa): observe se a suspensão se comporta como a de um assinante que atrasou.
   - [ ] **C5a. 17/11 (manhã, a rotina roda às 8h de Brasília e pode atrasar até 1 hora):** chega o aviso de **vencida** (1 dia) no e-mail da conta, aparece o **banner vermelho** na tela do cliente com a data da suspensão, e a conta **não** é suspensa. *(17/11: chegaram o e-mail ao cliente "Sua fatura do MetaBuilder PRO está vencida" (R$ 5,00, vencida em 16/11, pagar até 20/11), o aviso interno "Cobrança vencida: LGPD" na pasta Admin e o "Resumo diário de cobranças" (1 vencida em aberto, 0 suspensas). Falta ver o banner vermelho na tela e conferir que a conta segue sem suspensão.)*
   - [ ] **C5b. 19/11:** chega o **aviso final** (3 dias).
   - [ ] **C5c. 20/11:** ao fim da carência a conta é **suspensa**, com e-mail de suspensão.
   - [ ] **C5d.** Depois disso, **pague o Pix de R$ 5,00**: o acesso volta e chega o recibo **"restabelecido"**.
   - **Como conferir em cada marco** (me peça ou rode no SQL Editor):
     ```sql
     select kind, status, last_error, created_at, sent_at from public.billing_notices order by created_at desc limit 20;
     select subscription_status, is_blocked, overdue_since from public.profiles where email = 'lgpd@metabuilderpro.com';
     ```
     E, no Supabase, Edge Functions > **asaas-webhook** > Logs, para ver `PAYMENT_OVERDUE` e `PAYMENT_RECEIVED`.
- [x] **C6.** **Rotina à mão:** `GET https://www.metabuilderpro.com/api/cron/billing-notices` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`. Em produção, **sem** `CRON_SECRET` configurado a rota recusa tudo (corrigido em 16/11); com o segredo, aceita só o cabeçalho exato. Roda sozinha às 8h de Brasília.
- [ ] **C7.** **Desligar** (caixa Desligado) volta ao comportamento antigo. *(Não testado.)*
- [ ] **C8.** **Lembrete antes do vencimento** (o aviso de "vai vencer"): só acontece num ciclo real, por volta de 13 a 16/12, na renovação da conta de teste ativa (passo 1 da rotina). *(Aguardando a data.)*

---

## D. Se algo não aparecer

| Sintoma | Onde olhar |
|---|---|
| Pagou e o acesso não liberou | Supabase > Edge Functions > **asaas-webhook** > Logs. Procure `Received Asaas Webhook event`. Sem log, o Asaas não está chamando: confira o token do webhook. |
| Comissão não nasceu | O indicado só gera comissão se existir `partner_referrals` para o e-mail dele **e** o parceiro estiver `active`. Se B já tinha conta antes do link, a indicação não é criada. |
| Comissão com valor estranho | `gross` é o valor **pago pelo cliente** (bruto); `amount` = o percentual vigente no dia (hoje 18%) desse valor, arredondado para baixo no centavo. |
| Aviso não chegou | Tabela `billing_notices`: `failed` com `last_error`. "o SMTP recusou ou não está configurado" = confira `SMTP_*` na Vercel. Veja também o spam e o Gerenciador de e-mails (aba Sistema), que define o remetente de cada assunto. |
| Pix do parceiro não saiu | Aba Parceiros > lotes: o item mostra o motivo. Cheque a chave Pix aceita, o **teto do lote** (hoje R$ 5.000: um lote acima disso é recusado) e a validação de saque do Asaas (`docs/parceiros-desenho.md`). |
| Vencida não chegou | A rotina diária roda às 8h de Brasília e, no plano Hobby da Vercel, pode atrasar até 1 hora. Veja `billing_notices` e os logs do `asaas-webhook` (`PAYMENT_OVERDUE`). |

## Depois do teste
- [ ] Concluir o **C5** (17, 19 e 20/11 e o Pix de R$ 5,00) e atualizar este arquivo com o resultado.
- [ ] **Cancelar as assinaturas de teste** antes da próxima cobrança (por volta de 15 a 16/12): a conta A pelo painel do cliente (A8) e a conta indicada por **Bloquear** com "Cancelar também as cobranças futuras". Anote o que pagou e estorne no Asaas o que não quiser manter.
- [ ] **Reduzir as permissões da chave de API do Asaas** e trocar o e-mail de falha do webhook, que ficaram abertos para os testes.
- [x] Condições dos parceiros definidas (18% / 7 dias / R$ 50 / R$ 5.000).
- [ ] Se for ligar os avisos de verdade para clientes, acompanhe `billing_notices` nos primeiros dias.
