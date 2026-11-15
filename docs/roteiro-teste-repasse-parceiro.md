# Roteiro: teste do repasse de comissão por Pix (parceiro)

Objetivo: conferir de ponta a ponta que o SuperAdmin paga a comissão de um parceiro por Pix, pela conta do Asaas, e que o painel do parceiro e o banco refletem isso.

**É dinheiro real.** O teste usa R$ 0,75 (a comissão do teste B), para a chave Pix do parceiro ALEXANDRE (você mesmo), então o valor volta para a sua conta. Pode haver uma tarifa de Pix do Asaas.

## Antes de começar (conferir)
1. **Chave de API do Asaas** com a permissão **TRANSFER** (Integrações > Chaves de API > editar a chave). Sem ela a transferência é recusada. Se mudar a chave, atualize `ASAAS_API_KEY` nos Secrets das Edge Functions.
2. **Funções publicadas:** `partner-payout` e `partner-transfer-validation`. O Asaas pode pedir validação da transferência por webhook (segredo `ASAAS_TRANSFER_VALIDATION_TOKEN`, já existe nos Secrets). Se a conta usar autorização por token/SMS, a transferência fica aguardando e não conclui sozinha.
3. **Saldo na conta Asaas** de pelo menos R$ 0,75 (o pagamento do teste B entrou como R$ 3,01 líquidos).
4. No SuperAdmin > Parceiros, o parceiro precisa ter: status ativo, **chave Pix aceita** (não pendente) e **a pagar ≥ mínimo** (hoje R$ 1,00 no teste; R$ 0,75 é menor!).
   - Como o mínimo atual (R$ 1,00) é maior que a comissão (R$ 0,75), **baixe o mínimo para R$ 0,50 antes** (aba Regras de Preços) ou gere mais uma comissão.

## Passo a passo
1. SuperAdmin > **Parceiros**: marque a caixa do parceiro na lista. Deve aparecer "1 selecionado(s): 1 entram no lote, R$ 0,75".
   - Se aparecer "fora: ... (sem chave / abaixo do mínimo / suspenso)", corrija o motivo (item 4 acima).
2. Clique em **Pagar por Pix...** e leia o resumo: valor, tipo e chave. Confira que é a sua chave.
3. Clique em confirmar o envio. **Não dá para desfazer.**
4. Espere a mensagem "Lote criado: R$ 0,75. 1 Pix enviado(s)".

## O que conferir
| Onde | Esperado |
|---|---|
| SuperAdmin > "Últimos lotes" | lote `concluído` com o item `Pago` e link do comprovante (se aparecer `Em processamento`, atualize em alguns segundos; `Falhou` mostra o motivo) |
| Asaas > Transferências | um Pix de R$ 0,75 para a sua chave |
| Seu banco | o Pix entrou |
| Painel do parceiro (`/parceiro`) | "Já pago" R$ 0,75; "Disponível" volta a R$ 0,00; aba Pagamentos com o lote |
| Banco (peça para eu conferir) | comissão `paid` com `payout_item_id` preenchido |

## Se algo falhar
- **"Falhou (volta para o saldo)":** o valor volta para o parceiro, nada se perde. Veja o motivo no item do lote (chave inválida, saldo, permissão TRANSFER ausente, transferência aguardando autorização).
- **Item preso em "Enviando" sem id de transferência:** use o botão de liberar do item (só aparece nesse caso) e tente de novo.
- **Nada acontece:** me diga a mensagem exata; eu olho os logs de `partner-payout` e `partner-transfer-validation`.

## Depois do teste
Volte as condições normais do parceiro: **carência 7 dias** e **mínimo R$ 50** (Regras de Preços).
