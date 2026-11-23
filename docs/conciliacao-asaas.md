# Conciliação diária das cobranças com o Asaas (23/11/2026)

## Por que existe

A tabela `payments` é alimentada pelo webhook do Asaas. Um evento pode se perder (configurado depois, fila pausada, falha). Quando isso aconteceu com a **renovação**
(`PAYMENT_CREATED`), a cobrança existia no Asaas e não existia aqui: o cliente não recebia os lembretes de vencimento e a aba Cobranças do admin não a mostrava.
Foi o caso das renovações geradas em 15/11 (MetaBuilder PRO), 18/11 (FeedBack) e 22/11 (LGPD).

## O que faz

Todo dia, 05:00 UTC (`/api/cron/asaas-reconcile`), a Edge Function `asaas-reconcile` percorre, em lotes de 25, os assinantes **ativos ou suspensos** com assinatura no Asaas:

- **Cobrança aberta (pendente ou vencida) no Asaas que não existe aqui:** grava em `payments` (mesma referência do webhook: `<referência>~<id>` ou `sub_<id>`).
  Se estiver vencida, começa também a contagem do atraso (`overdue_since`), como o webhook; a suspensão segue a carência.
- **Existe e diverge** (vencimento, valor, pendente x vencida): ajusta, **só se estiver aberta aqui**.
- **Aberta aqui e o Asaas já não lista como aberta:** consulta a cobrança. Se foi **apagada**, vira `canceled`. Se está **paga**, **não** marca como paga (isso ativa o plano,
  gera comissão e entra na fila de NFS-e: é do webhook); só aparece no log do cron e na resposta (`paidNotRecorded`) para você conferir.
- **Nunca reabre** cobrança paga, estornada ou cancelada.

## Publicação

1. Publicar a Edge Function `asaas-reconcile` (arquivo único em `supabase/functions-dashboard/asaas-reconcile/index.ts`).
2. Deploy do site (a Vercel registra o cron novo).
3. Para rodar na hora: Vercel > Settings > Cron Jobs > `/api/cron/asaas-reconcile` > **Run**. A resposta lista `scanned`, `inserted`, `updated`, `canceled`, `paidNotRecorded`.

## Como conferir

```sql
-- as renovações que faltavam (MetaBuilder PRO 15/12, FeedBack 18/12, LGPD 16/12) devem aparecer
select p.status, p.due_date, p.amount, p.asaas_payment_id, p.external_reference from payments p where p.due_date >= '2026-12-01' order by p.due_date;
```

Depois da conciliação, a aba Cobranças deve mostrar essas cobranças em "A vencer", e os lembretes (3 dias antes e no dia) passam a sair para elas.

## Limites

- Só olha cobranças **abertas**; histórico antigo que o webhook perdeu (por exemplo, uma cobrança já paga) não é reconstruído.
- Não envia e-mail de aviso do que descobre (a cobrança entra na fila de lembretes normal pelas datas). O relato de "paga no Asaas e aberta aqui" fica no log do cron.
- Cobrança de assinante FREE que só abriu o checkout não é conciliada (está fora do filtro de status ativo/suspenso).
