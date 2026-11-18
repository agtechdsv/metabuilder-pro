# Padrão de referências da Família PRO

Definido em 18/11/2026. Vale para o **MetaBuilderPRO** e para os apps que usam a mesma conta do Asaas (**TraderMasterPRO**, **VeritumPRO**). Código: `supabase/functions/_shared/familyRefs.ts` (regras puras e testadas em `src/lib/__tests__/familyRefs.test.ts`). Contexto: `docs/asaas-varios-apps.md`.

## O formato

```
<app>_<entidade>_<id>[_<rótulo>_<valor>]...
```

Tudo em minúsculas, separado por `_`.

| Parte | Valores |
|---|---|
| **app** | `mb` MetaBuilderPRO · `tm` TraderMasterPRO · `vt` VeritumPRO (2 letras, fixas, **nunca reutilizadas**) |
| **entidade** | `ws` workspace (pagamentos e assinaturas) · `us` usuário (cliente no Asaas) |
| **rótulos** | `l` licenças · `u` upgrade (licenças acrescentadas) · `cy` ciclo (`mo`, `qu`, `se`, `ye`) · `t` timestamp em segundos |

Os rótulos só precisam ser únicos **dentro do app**: o código do app vem primeiro, então não colidem com os dos outros.

| O quê | Exemplo |
|---|---|
| Pagamento ou assinatura (compra) | `mb_ws_646311ab0c4d4e5f8a9b0c1d2e3f4a5b_l_3_cy_mo_t_1763000000` |
| Pagamento (upgrade) | `mb_ws_646311ab0c4d4e5f8a9b0c1d2e3f4a5b_u_2_cy_mo_t_1763000000` |
| Cliente no Asaas | `mb_us_<id do usuário>` |

Tamanho: cerca de 64 caracteres (o limite da referência do Asaas é 100).

## Regras

1. **Cada app usa só o próprio código** em tudo que cria no Asaas (pagamentos, assinaturas, clientes). Códigos novos de app entram na lista `FAMILY_APPS` do módulo, em todos os apps.
2. **Nunca se acha cliente só pelo e-mail**: ele pode ser de outro app. Cada app usa o cliente ligado ao perfil do usuário ou o marcado com a própria marca (`mb_us_...`), e só altera cliente que é seu.
3. **Cada app lê as próprias referências pelo módulo** (`parsePaymentRef`), e não pela posição das letras. Evento cuja referência existe, não é do app e não está no banco dele é **ignorado** (o webhook da conta recebe os eventos de todos).
4. **Chave de API com nome próprio** por app, cadastrada em "Apps neste Asaas" (aba Sistema) como "nossa" ou "de outro app".
5. Ao levar o módulo para outro app, troca-se `OWN_APP_CODE` (e, se a entidade do app não for workspace, a entidade do padrão e o regex de `parsePaymentRef`).

## LEGADO: apagar na primeira limpeza geral

Antes deste padrão, o checkout usava `w_<workspace>_<l|u>_<licenças>_c_<ciclo>_<timestamp>` (54 caracteres), e antes disso `ws_...` e `u_...`. **Não há cliente real**: só 5 cobranças de **teste** e as assinaturas de teste do Asaas têm esse formato. O leitor ainda entende o formato antigo **só para essas cobranças de teste** (renovações e baixas que ainda chegam).

**Na primeira oportunidade de zerar os dados de teste e recomeçar, apagar o legado:**
- em `familyRefs.ts`: a constante `LEGACY_OWN_REF_PREFIXES`, o `legacyRefPattern` e a parte do `parsePaymentRef` e do `isOwnRef`/`appOfRef` que os usa;
- em `src/lib/__tests__/familyRefs.test.ts`: o bloco "LEGADO";
- e conferir que nenhuma assinatura ou cobrança do Asaas ainda tem referência `w_`/`ws_`/`u_`.

Só o formato **novo** é escrito desde 18/11/2026.

## Nota sobre o webhook

A antiga "estratégia 3" do `asaas-webhook`, que tentava achar o usuário na própria referência, foi **removida**: ela nunca resolvia nada (a referência traz o workspace, e não o usuário). O usuário sai sempre do banco: pelo pagamento (`payments.asaas_payment_id`) ou pela assinatura (`profiles.asaas_subscription_id`).
