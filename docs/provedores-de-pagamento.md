# Provedores de pagamento: Asaas e BTG (desenho, 23/11/2026)

**Status: só desenho e descoberta. Nada de BTG foi codado.** Este documento junta o que descobrimos da API do BTG Pactual Empresas e propõe como o MetaBuilder
passaria a usar **mais de um provedor**, com o SuperAdmin escolhendo **por função** (por exemplo: Pix e boleto no BTG, cartão no Asaas). A decisão de seguir
depende do **preço** (ver "Decisões pendentes").

## 1. Ideia do dono

Não é trocar o Asaas. É poder escolher, na aba Sistema, qual banco atende cada função. No mínimo, escolher um banco; o ideal é escolher por função.
Inter e Mercado Pago foram avaliados e descartados por ora (Inter: Pix barato, sem cartão recorrente confirmado; Mercado Pago: cartão mais caro, sem vantagem).

## 2. O que o BTG tem (lido na documentação oficial, sandbox/Wiremock)

| Função | BTG | Observações |
|---|---|---|
| Cobrança Pix (QR dinâmico imediato, `cob`) | Sim | criar location + criar cobrança; `emv` (copia e cola) e imagem do QR; `tags` livres voltam no webhook; webhook `instant-collection.paid`; cancelar = desvincular QR. **Sem vencimento (cobv)**, sem consulta por `txId` (só lista com filtros) |
| Pix Automático (recorrência) | Sim | autorização (Jornada 3 = Pix imediato + recorrência) com período semanal, mensal, trimestral, semestral ou anual; **nós agendamos cada ciclo**, 3 a 10 dias antes; webhooks `automatic-pix.*` |
| Boleto | Sim | único, parcelado, em lote, híbrido com Pix; `bank-slips.paid` (liquidação D+1) |
| Estorno de Pix recebido (`PIX_REVERSAL`) | Sim | parcial permitido (saldo restante); janela de data; precisa do `originalEndToEndId` |
| Repasse por Pix (`PIX_KEY`) | Sim | `tags.externalId` volta nos webhooks `payments.*`; lote com `batchId`; `x-idempotency-key` (24 h) |
| Cartão de crédito de clientes | **Não** | "Cartão de crédito e faturas" é consulta dos cartões da própria empresa; "Antecipação" é de recebíveis do cartão BTG |
| Assinatura gerenciada | **Não** | só Pix Automático; o resto o agendador teria que fazer |

### Fatos que pesam na decisão

- **Token:** todas as APIs de Banking exigem **Authorization Code** (Client Credentials NÃO dá acesso). Consentimento de um usuário **operador ou superior**.
  Access token 24 h; refresh token 10 dias que **se renova a cada uso** (cron diário). Gerar novo access invalida o anterior: a renovação precisa de **trava**.
  Se o usuário sair, tiver o acesso revogado ou o refresh lapsar (sistema fora mais de 10 dias), é preciso autorizar de novo.
- **Aprovação humana nos pagamentos:** estorno e repasse são "iniciações" que um representante **aprova no app do BTG** (`operation-expired` se não aprovar a tempo;
  `pending-approval`; `payments.retained` pela antifraude). A resposta traz `operationNeedsApproval`. Vantagem de segurança: um token vazado só cria iniciações.
- **Token do Pix Automático é sensível:** o escopo `collections` pode agendar débitos nos clientes que autorizaram. Usar **uma autorização por produto, com o menor escopo**.
- **Sandbox:** Wiremock (respostas estáticas) e só para o CNPJ do próprio BTG (30306294000145). A validação real é em produção, que exige o **Plano Avançado**.
- **Resposta do BTG (WhatsApp, 23/11/2026, protocolo 30287295):** conta PJ sem taxa de abertura e manutenção; transferências Pix ilimitadas e gratuitas, "incluindo
  pagamentos recorrentes" (ambíguo); TED, boleto e QR Code têm franquia mensal gratuita, sem número nem tarifa depois dela; nada sobre cartão; nada sobre o Plano Avançado.

## 3. Arquitetura proposta

### 3.1 Configuração (aba Sistema)

Um ajuste `payment_providers` em `platform_settings`, com um provedor por função:

```json
{ "pix": "asaas", "boleto": "asaas", "card": "asaas", "pix_recurring": "asaas", "payouts": "asaas" }
```

Vale para **cobranças novas**. Assinaturas e cobranças que já existem ficam no provedor em que nasceram (guardado em cada `payments` e em cada assinatura).
Se a conexão com o BTG estiver doente (token vencido, falha de renovação), o checkout **volta sozinho para o Asaas** e o admin recebe alerta (já existe o tipo `admin_key_alert`).

### 3.2 Camada de provedores

Uma interface única, com um adaptador por provedor:

- `createCharge(method, customer, amount, reference)` devolve `{ externalId, qr?, copyPaste?, boletoUrl?, dueDate }`;
- `createRecurring(...)` e `cancelRecurring(...)` (no Asaas é a assinatura; no BTG é o Pix Automático);
- `cancelCharge(externalId)`;
- `refund(externalId, value?)`: no BTG vira iniciação `PIX_REVERSAL` e fica **"Estorno solicitado"** até a aprovação (o nosso estado `requested` já existe);
- `payout(items)`: no BTG vira lote `PIX_KEY` aprovado no app;
- `parseWebhook(request)` normaliza para um evento interno (`payment.paid`, `payment.refunded`, `subscription.canceled`...), reaproveitando o que o webhook faz hoje.

O que **já é independente de banco** e não muda: tabela `payments`, avisos de cobrança, fila de NFS-e, comissão de parceiros, reajuste agendado (o preço é calculado por nós) e a conciliação.

### 3.3 Banco de dados

Colunas hoje com nome do Asaas (`asaas_payment_id`, `asaas_subscription_id`, `asaas_customer_id`) passam a ter um **provedor** ao lado (`provider`, `external_id`),
com migração que preenche `asaas` para tudo o que existe. Uma tabela de credenciais do BTG (somente `service_role`), com o refresh token **criptografado** (chave nos Secrets).

### 3.4 Regras

1. **O estorno segue o provedor que RECEBEU a cobrança.** Um Pix recebido no BTG não se estorna pelo Asaas, e vice-versa.
2. **Cartão fica no Asaas** (ou outro adquirente) enquanto o BTG não tiver gateway.
3. **Preço por vencimento** continua como no reajuste: no BTG o valor vai em cada agendamento do Pix Automático (autorização de **valor variável**, sem o campo `amount`).
4. **Mudança de plano ou ciclo no Pix Automático exige nova autorização** (o PATCH não altera valor nem período).
5. Cobrança Pix avulsa no BTG é **imediata**: o QR é gerado na hora em que o cliente abre a aba Assinatura (não há cobrança com vencimento).

## 4. Fases

| Fase | O que entrega | Tamanho |
|---|---|---|
| 0. Descoberta | perguntas ao BTG por escrito (preço), abrir a conta PJ, testar o sandbox (Postman), validar o fluxo de token | pequeno, sem código |
| 1. Camada de provedores | interface, colunas `provider`/`external_id`, tela de escolha por função, com **só o Asaas** (nada muda para o cliente) | médio |
| 2. BTG para Pix e boleto | gerenciador de token (conexão, renovação com trava, alerta), adaptador de cobrança Pix/boleto, webhook do BTG, **agendador de ciclos**, conciliação para o BTG, estorno por iniciação | grande |
| 3. Repasse e Pix Automático | lote de repasse a parceiros por `PIX_KEY`; Pix Automático com autorização de valor variável e agendamento 3 a 10 dias antes | grande |

## 5. Riscos

- Dependência de **uma pessoa** para o token; indisponibilidade de 10 dias derruba a conexão.
- **Janela de 3 a 10 dias** do agendamento no Pix Automático: o agendador falhar nesse período significa um ciclo não cobrado (precisa de monitoramento e alerta).
- Aprovações humanas com **prazo** (não sabemos o prazo): repasse e estorno podem expirar.
- Documentação com inconsistências de nomes de evento (`instant-collection.paid` x `instant-collections.paid`, `cancelled` x `canceled`): só o teste real resolve.
- Esforço grande para economizar, hoje, o R$ 1,99 por Pix do Asaas.

## 6. Decisões pendentes (bloqueiam a fase 1)

1. **Preço do Plano Avançado** e tarifas: Pix recebido depois da franquia, Pix Automático, devolução, Pix enviado.
2. Se o Pix Automático entra em "Pix gratuito" ou na franquia de QR Code.
3. Se `operationNeedsApproval` pode ser dispensado até um limite (automatizaria o repasse, com menos proteção).
4. Prazo da aprovação das iniciações.
5. Como obter o `originalEndToEndId` de um Pix recebido (o payload de `instant-collection.paid` não o traz).
6. Quem cria o aplicativo e autoriza o token: o dono (administrador ou operador); definir um segundo operador de reserva.

## 7. Perguntas ao BTG (já enviadas ao atendente)

1. Tamanho da franquia mensal para recebimentos por QR Code Pix e por boleto, e a tarifa depois dela.
2. O Pix Automático entra em "Pix gratuito" ou na franquia de QR Code? Há tarifa por débito?
3. Preço do Plano Avançado e o que inclui.
4. A devolução de Pix recebido tem tarifa?
5. Prazo de abertura da conta PJ e de liberação do Plano Avançado.

## 8. Critério de decisão

- Se o recebimento depois da franquia custar **menos que os R$ 1,99** do Asaas **e** o Plano Avançado for gratuito ou barato: seguir para a fase 1.
- Se o Plano Avançado tiver mensalidade, é provável que ela supere a economia no volume atual: manter só o Asaas.
