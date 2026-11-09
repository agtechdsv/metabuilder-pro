# iClub completo + Campanhas (Black November): publicação e teste

Regras combinadas em 2026-11-09. O cálculo de preço mora em `supabase/functions/_shared/pricing.ts` (puro, testado em `src/lib/__tests__/pricing.test.ts`).

## O que mudou
- **Preço único** para checkout, troca de plano e webhook (antes eram 3 contas diferentes; `|| 15` transformava um 0% digitado em 15%).
- **Campanha**: nos N primeiros meses de uso o cliente paga X% da tabela por licença; esse preço **substitui** os descontos de volume e ciclo (vale o menor). Só para quem nunca pagou. Semestral/anual: a primeira cobrança já traz os meses da campanha somados; a renovação vem a preço normal. Licenças acrescentadas depois pagam preço regular.
- **iClub**: o desconto de indicação agora é **vitalício enquanto o indicado seguir assinante** (o valor da assinatura no Asaas é recalculado a cada pagamento), com **teto** (padrão 30%) e **carência** (padrão 7 dias), ambos editáveis pelo SuperAdmin. Cancelamento, estorno e reembolso do indicado encerram o desconto. **Licença grátis** a cada 12 licenças contadas (as da campanha só contam depois dos meses da campanha).
- O valor da assinatura no Asaas passa a ser sempre **o valor da próxima cobrança**; o webhook o recalcula depois de cada pagamento confirmado.
- Correção no webhook: renovação sem `externalReference` não zera mais as licenças do perfil.

## Ordem de publicação (importa)
1. **SQL**: rodar `scripts/iclub-campanhas.sql` no SQL Editor de produção (pode repetir).
2. **Edge Functions**:
   - Pela CLI: `supabase functions deploy asaas-checkout asaas-update-subscription asaas-webhook iclub-release`.
   - Pelo painel: o editor só leva o `index.ts` e dá "Module not found ... _shared/iclub.ts". Rode `node scripts/bundle-edge-functions.mjs`, que gera versões de arquivo único em `supabase/functions-dashboard/<nome>/index.ts` (ignoradas pelo git); cole o conteúdo de cada uma no editor da função correspondente (a `iclub-release` é nova: crie-a no painel). Gere de novo sempre que mexer em `_shared` ou numa função.
3. **Site** (Vercel): o deploy normal. O cron novo `/api/cron/iclub-release` (04:00) já está no `vercel.json`.
4. Conferir no Supabase: `platform_settings` tem `iclub_referral_cap_percent` e `iclub_grace_days`.

Reverter: as versões anteriores das funções estão no git (`git log -- supabase/functions`).

## Teste em produção (o sandbox do Asaas não é confiável)
Use uma conta que **nunca pagou**.
1. `/admin/platform` → aba **Planos** → **Campanhas de preço** → nova campanha: 50%, 2 meses, de agora até amanhã, e **só para o seu e-mail** (campo de restrição). Confira a prévia (1 licença: mensal 174,50; semestral 1.605,40; anual 3.141,00).
2. Logado com esse e-mail, a faixa aparece no topo do site e na seção de preços (para os demais visitantes ela não aparece: a regra de segurança do banco esconde campanhas restritas).
3. Checkout mensal, 1 licença: o total mostrado deve ser **R$ 174,50** (vem do servidor). Pague.
4. Depois do webhook, conferir: `profiles.campaign_*` preenchido, `campaign_months_used = 1`, a assinatura no Asaas com o valor da cobrança seguinte (174,50) e, depois da 2ª cobrança paga, **349,00**.
5. Indicação: criar outra conta pelo link `?ref=`, pagar; a recompensa do indicador nasce `pending` (carência). Para testar sem esperar, ponha a carência em 0 no painel **iClub: desconto de indicação**, ou aguarde o cron.

## Pontos a observar (não dá para provar sem o Asaas real)
- `PUT /subscriptions/{id}` com `updatePendingPayments: true`: se o Asaas ignorar, o código também ajusta cada cobrança PENDENTE (`POST /payments/{id}`), mas confira no 1º teste.
- O risco de receita: se o webhook falhar depois da 1ª cobrança da campanha, a 2ª sairia com o valor da campanha. Acompanhe os logs da função `asaas-webhook` nos primeiros dias.
- Existente e não alterado: `asaas-update-subscription` (troca de plano) redefine `subscription_expires_at` para hoje + ciclo; o prorata do upgrade usa o valor pago (com campanha) como base.
