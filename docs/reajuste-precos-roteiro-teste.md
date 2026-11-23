# Roteiro de testes: reajuste de preços agendado

Feito para rodar em produção **só com as contas de teste** (FeedBack, MetaBuilder PRO, LGPD...). Cada teste diz o que clicar, o que esperar e como conferir no banco
(SQL Editor, só leitura, a não ser onde está escrito "restaurar"). Visão geral e regras: `docs/reajuste-precos.md`.

> Antes de começar, abra Regras de Preços > **Reajustar** e olhe a prévia: ela diz **quantos assinantes serão avisados**. Se for maior que o número de contas de
> teste com assinatura ativa, **pare**: o e-mail sairia para clientes reais.

## 0. Pré-requisitos (1 minuto)

```sql
-- as colunas novas existem?  (esperado: 2 linhas)
select column_name from information_schema.columns where table_name = 'profiles' and column_name in ('campaign_unit_price', 'price_change_synced_id');
-- quem já comprou em campanha tem o preço promocional travado?  (esperado: FeedBack com campaign_unit_price = 5.00)
select email, campaign_percent, campaign_months, campaign_months_used, campaign_unit_price from profiles where campaign_id is not null;
-- valor base de hoje
select base_price from pricing_rules order by created_at desc limit 1;
```

Anote: **valor base de hoje** (nos exemplos, R$ 10,00) e **meses de campanha usados** do FeedBack. As funções `price-change-apply`, `asaas-checkout`, `asaas-update-subscription`,
`asaas-webhook` e `iclub-release` precisam estar publicadas, e o site com o deploy feito.

## 1. Validações da tela (sem efeitos)

Em Reajustar, preencha e **não** confirme:

| Entrada | Esperado |
|---|---|
| valor vazio | nenhuma mensagem de erro e o botão **Reajustar** desabilitado |
| valor 0, ou negativo | "Informe um valor base válido, maior que zero." |
| mesmo valor de hoje (10) | "O valor novo é igual ao atual." |
| valor 12 e dias 20 | "Aumento exige aviso de pelo menos 30 dias." |
| valor 12 e dias vazio/-1/400 | "Informe os dias até valer (número inteiro, de 0 a 365)." |
| valor 12 e dias 30 | prévia: "Aumento de R$ 10,00 para R$ 12,00. Vale nas renovações com vencimento a partir de **DD/MM** (hoje + 30)", com o número de assinantes |
| valor 9,50 e dias 0 | prévia de **Redução** (reduzir pode valer na hora) |

Depois, em **Salvar Regras**, troque o valor base para 12 e salve: deve **recusar** ("Para AUMENTAR o valor base use Reajustar..."). Volte o campo para o valor de hoje.
Reduzir o valor e salvar deve continuar funcionando (se testar, restaure depois).

## 2. Agendar, avisar e cancelar (reduzindo R$ 0,01, com 7 dias)

Reduções não exigem os 30 dias, então este teste não encarece ninguém.

1. Reajustar: novo valor **9,99**, dias **7** > Reajustar > **Confirmar e avisar**.
2. **Esperado na tela:** toast "Reajuste agendado para DD/MM. N assinante(s) avisado(s)". O bloco vira "Reajuste agendado: R$ 10,00 → R$ 9,99 a partir de DD/MM" com **Cancelar reajuste**.
3. **E-mail** (caixa de cada conta de teste ativa): assunto "Reajuste de preço do MetaBuilder PRO a partir de DD/MM/AAAA". Confira: valor atual e novo **do plano dela**,
   "por mês", "primeira renovação a partir dessa data", "cancelar a renovação"; no **FeedBack** (campanha) deve aparecer a frase de que o **preço promocional não muda**; nas
   outras, não. O botão leva à aba Assinatura.
4. **Aba Assinatura** de um assinante ativo: aviso "Reajuste de preço a partir de DD/MM" com o valor atual e o novo. Conta cancelada (LGPD) **não** vê o aviso nem recebe o e-mail.
5. Tentar agendar de novo com o primeiro já agendado: "Já existe um reajuste agendado...".
6. Banco:

```sql
select id, status, effective_on, notice_days, old_base_price, new_base_price, notified_at from pricing_changes order by created_at desc limit 3;
select kind, status, sent_at, last_error, payload->>'currentAmount' atual, payload->>'newAmount' novo, payload->>'campaignActive' campanha, user_id
  from billing_notices where kind like 'price_change%' order by created_at desc;
```

   Esperado: 1 linha `scheduled`; avisos `price_change` com `status = sent` (um por assinante), sem `last_error`.

## 3. Lembrete de 7 dias e cancelamento

O lembrete sai quando faltam exatamente 7 dias, e o reajuste do teste 2 está a 7 dias.

1. Rode a rotina: Vercel > Settings > **Cron Jobs** > `/api/cron/price-change` > **Run** (ela leva o segredo sozinha; ou espere 04:30 UTC).
2. **Esperado:** nos logs, `success: true` com `reminders` igual ao número de assinantes. E-mail "Lembrete: o valor do plano PRO muda em DD/MM". Rodar de novo não duplica (fila única).
3. Banco: `select kind, status, ref from billing_notices where kind = 'price_change_reminder';` (um por assinante).
4. Clique em **Cancelar reajuste**. **Esperado:** toast "Reajuste cancelado. Nenhum preço foi alterado."; o bloco volta ao formulário; em "Reajustes anteriores" aparece "cancelado";
   `pricing_rules.base_price` continua com o valor de hoje. O aviso do cliente some da aba Assinatura.

## 4. Aplicação na data (reduzir R$ 0,01 com 0 dias)

1. Anote antes: valor da assinatura e da cobrança aberta de cada conta ativa no painel do Asaas, e `campaign_months_used` do FeedBack.
2. Reajustar: **9,99**, dias **0** > Confirmar e avisar (hoje é a data de vigência).
3. Rode a rotina como no teste 3 (Run do cron).
4. **Esperado no banco:**

```sql
select status, effective_on, applied_at, resync_done from pricing_changes order by created_at desc limit 1;   -- applied, resync_done = true
select base_price from pricing_rules order by created_at desc limit 1;                                         -- 9.99
select email, price_change_synced_id, campaign_unit_price from profiles where asaas_subscription_id is not null; -- todos com o id do reajuste
```

5. **Esperado no Asaas:**
   - conta **sem campanha** (MetaBuilder PRO): assinatura e cobrança aberta com vencimento **a partir de hoje** em **R$ 9,99**;
   - **FeedBack** (campanha): se ainda resta mês promocional, a próxima cobrança **continua R$ 5,00** (o preço promocional não segue a tabela); se a campanha acabou, R$ 9,99;
   - cobrança **vencida ou anterior** a hoje e cobranças **pagas**: **não mudam**.
6. **Restaurar** (o valor volta a R$ 10,00 sem aviso de 30 dias, só porque é teste):

```sql
update pricing_rules set base_price = 10, updated_at = now()
 where id = (select id from pricing_rules order by created_at desc limit 1);
```

   Depois corrija à mão, no Asaas, o valor das assinaturas e das cobranças abertas das contas de teste que foram para 9,99 (ou espere o próximo pagamento delas, que recalcula).

## 5. Aumento de verdade, com 30 dias (opcional; só com as contas de teste)

Reajustar: valor **10,50**, dias **30**. Esperado: a prévia mostra "Aumento" e a data a 30 dias; o e-mail mostra "R$ 10,00 → R$ 10,50". **Cancele** em seguida (não aplique).
O que isto prova: o aumento passa só com 30 dias e o e-mail sai com o valor certo.

## 6. Lembrete de renovação de ciclo longo (opcional)

Só para quem paga trimestral, semestral ou anual, 30 dias antes da renovação dele, com a renovação a partir da vigência. Para simular numa conta de teste (restaure depois):

```sql
update profiles set subscription_cycle = 'semiannual', subscription_expires_at = now() + interval '30 days' where email = 'metabuilderpro@gmail.com';  -- anote os valores antigos antes!
```

Com um reajuste **agendado** de vigência até daqui a 30 dias (por exemplo, o do teste 2, com 7 dias), rode o cron: **esperado** um e-mail "Sua próxima renovação terá o novo valor",
"por semestre", com a data da renovação. Restaure o ciclo e a data da conta.

## 7. Idiomas

Para ver os e-mails em inglês ou espanhol: `update profiles set billing_language = 'en' where email = '...'` (ou `'es'`), repita o teste 2 e confira o assunto
("MetaBuilder PRO price update starting MM/DD/YYYY" / "Actualización de precio de MetaBuilder PRO desde el DD/MM/AAAA"). Volte para `'pt'` (ou o valor antigo).

## 8. Checkout com o preço promocional travado

Com a tabela em R$ 9,99 (durante o teste 4, antes de restaurar), abra o checkout de reativação de uma conta de teste cancelada **que tenha campanha** e confira o total do ciclo:
deve ser o promocional que ela viu, e não 50% de 9,99. (Não precisa finalizar a compra.)

## Se algo falhar

- **Toast de erro ao agendar:** confira se o SQL `reajuste-precos.sql` foi rodado (tabela `pricing_changes`).
- **Aviso não saiu:** `select kind, status, attempts, last_error from billing_notices where kind like 'price_change%' order by created_at desc;` e confira o SMTP em Sistema.
- **Cron responde 502:** a Edge Function `price-change-apply` não está publicada ou deu erro; veja os logs dela no Supabase.
- **`pending: true` ou `moreToResync`:** ainda há assinaturas para recalcular; o cron continua no dia seguinte (ou rode o Run de novo).
