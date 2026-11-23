# Reajuste de preços agendado (23/11/2026)

Como mudar o valor base do plano PRO sem surpreender quem já assina. Três partes que andam juntas: **reajuste agendado**, **avisos ao cliente** e
**preço promocional travado**.

## Regras combinadas

- O reajuste vale **na renovação** e é igual para todos. A cobrança com vencimento **a partir da data de vigência** já sai no valor novo; o período já
  pago (mensal, trimestral, semestral ou anual) nunca muda.
- **Aumento exige aviso de 30 dias** (conferido no servidor). Redução pode valer na hora (0 dias).
- Só o **valor base** é reajustado pela tela; faixas de volume e descontos de ciclo seguem como estão.
- **Salvar Regras** não aumenta mais o valor base quando há assinantes ativos: o aumento só entra pelo **Reajustar**.
- Quem comprou em campanha tem o preço promocional que viu **travado como teto** (`profiles.campaign_unit_price`), com a regra **"o melhor para o cliente"**
  (decidida em 23/11/2026): nos meses promocionais que restam ele paga o **menor** entre o que viu e a % da campanha sobre a tabela de hoje. Tabela que **sobe** não
  o encarece (50% de 10 = R$ 5,00 continua R$ 5,00 mesmo com a tabela em 12); tabela que **desce** o barateia (tabela em 6: R$ 3,00, igual a quem compra hoje). Depois
  dos meses da campanha vale a tabela nova. Campanhas antigas ganham o valor travado com a tabela de hoje (no SQL) e, por garantia, a Edge Function trava de novo, com a
  tabela de antes do reajuste, quem ainda estiver sem o valor.

## Como usar (SuperAdmin)

Regras de Preços > bloco **Reajustar o valor base**: informe o **novo valor base** e **em quantos dias passa a valer**, confira a prévia (data de vigência e
quantos assinantes serão avisados) e clique **Reajustar** > **Confirmar e avisar**. Só pode haver um reajuste agendado por vez; dá para **Cancelar
reajuste** antes da data (os avisos que ainda estiverem na fila deixam de sair; quem já recebeu o e-mail continua avisado, e nenhum preço muda).

## O que acontece

1. **Ao agendar:** grava em `pricing_changes` e envia, na hora, o e-mail `price_change` a cada assinante (assinatura no Asaas, não cancelada, com licenças),
   com o valor atual e o novo **do plano dele** (licenças, ciclo e desconto de indicação já considerados). Quem está em meses de campanha lê que o preço
   promocional dele não muda. Sai mesmo com os avisos de cobrança desligados (são o aviso prévio do reajuste).
2. **No painel do cliente** (aba Assinatura): aviso discreto "Reajuste de preço a partir de DD/MM" com o valor atual e o novo.
3. **7 dias antes da vigência:** lembrete `price_change_reminder` a todos. **30 dias antes da renovação** de quem paga trimestral, semestral ou anual e cuja
   renovação cai na vigência ou depois: `price_change_renewal`.
4. **Na data** (cron diário `/api/cron/price-change`, 04:30 UTC): a Edge Function `price-change-apply` trava o preço promocional de quem ainda não o tem, grava a
   regra nova em `pricing_rules`, marca o reajuste como `applied` e **recalcula as assinaturas em lotes de 20** (valor da assinatura e cobranças abertas com vencimento
   a partir da vigência; vencidas e anteriores não são tocadas). Cada cliente recalculado fica marcado em `profiles.price_change_synced_id`; se sobrar fila, o
   cron continua no dia seguinte.
5. Se o reajuste falhar em qualquer passo antes de gravar a regra, ele continua `scheduled` e a rotina tenta de novo no dia seguinte.

## Quem recebe o aviso

Assinantes com assinatura no Asaas que **não estão cancelados** (ativos e suspensos por atraso: se pagarem, pagam o valor novo). Quem cancelou a renovação não é
cobrado e não recebe aviso; se reativar, vê o valor novo no checkout. Se a assinatura for cancelada depois do aviso, o lembrete seguinte é descartado.

## Ordem de publicação (importante)

1. **Rodar `scripts/reajuste-precos.sql`** no SQL Editor **antes de tudo**: sem as colunas novas, o checkout e o recálculo de assinaturas falham.
2. Publicar as Edge Functions (arquivos únicos em `supabase/functions-dashboard/`, gerados por `node scripts/bundle-edge-functions.mjs`):
   `price-change-apply` (**nova**), `asaas-checkout`, `asaas-update-subscription`, `asaas-webhook`, `iclub-release`, `admin-cancel-billing` e `asaas-cancel`
   (as quatro últimas importam código compartilhado que mudou).
3. Deploy do site (a Vercel registra o cron novo do `vercel.json`).

## Limites conhecidos

- Cancelar um reajuste **não** envia e-mail de "reajuste cancelado" a quem já foi avisado.
- A prévia da tela e o e-mail mostram o preço **regular** do plano do cliente; o desconto de indicação é considerado, a campanha não (ela é explicada em frase).
- Descontos de ciclo e faixas de volume ainda são salvos na hora pelo Salvar Regras (só o aumento do valor base passa pelo aviso). Reduzir um desconto, na prática,
  também aumenta preço: combine isso com o aviso manual até existir o mesmo agendamento para eles.
- O pagamento adiantado de uma renovação ainda calcula o novo fim do acesso a partir de hoje, não do fim anterior (comportamento antigo do webhook).
- Não testado contra o Asaas real (recálculo de assinaturas e cobranças abertas) nem no navegador.
