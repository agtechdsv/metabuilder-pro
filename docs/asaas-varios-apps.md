# Vários apps na mesma conta do Asaas

Contexto (18/11/2026): o MetaBuilderPRO e o TraderMasterPRO usam a **mesma conta** do Asaas. Um aviso de chave expirada do TraderMasterPRO chegou ao admin do MetaBuilder como se fosse da nossa chave ("checkout e repasses parados"). Este documento fixa as regras para os apps conviverem sem atrapalhar um ao outro.

## O fato que explica tudo

O **webhook do Asaas é da conta**, não da chave nem do app: todo evento de qualquer app (pagamento, assinatura, nota fiscal, chave de API, transferência) chega a todos os endereços de webhook da conta. Cada app precisa **reconhecer o que é seu** e ignorar o resto. O Asaas não filtra por app.

## Convenções (valem para este e para qualquer app novo)

| O quê | Como o MetaBuilder se identifica | Como o outro app deve se identificar |
|---|---|---|
| **Chave de API** | Uma chave **só nossa**, com nome próprio (ex.: `MetaBuilderPRO`), em `ASAAS_API_KEY` nos Secrets das Edge Functions. Nunca reutilizar a chave de outro app. | Uma chave própria, com nome próprio. |
| **Pagamentos e assinaturas** | Referência externa `mb_ws_<workspace>_l_<n>_cy_<ciclo>_t_<ts>` (padrão da Família PRO, ver `docs/familia-pro-referencias.md`). Também vale estar na tabela `payments` ou em `profiles.asaas_subscription_id`. O formato antigo `w_`/`ws_`/`u_` só existe em dados de teste e é lido até a próxima limpeza geral. | O código do app dele: `tm_ws_...`, `vt_...`. |
| **Clientes** | Referência externa `mb_us_<id do usuário>`. Nunca se usa cliente só porque o e-mail bate. | `tm_us_<id>`, `vt_us_<id>`. |
| **Nome da chave nos alertas** | Cadastrado em **Sistema > Avisos de cobrança > Apps neste Asaas** (nossa ou de outro app). | Idem, do lado dele, se o app tiver o mesmo recurso. |

## O que o MetaBuilder faz hoje

1. **Clientes protegidos.** O checkout só usa um cliente do Asaas se ele é nosso: primeiro o que está ligado ao perfil do usuário (se ainda existir e não tiver marca de outro app), depois o que tem a marca `mb_us_<id>`; senão cria um novo, já com a marca. **Nunca** procura por e-mail e **nunca** altera um cliente que não seja nosso (antes, o checkout reaproveitava um cliente de outro app pelo e-mail e ainda desligava as notificações dele). A API do Asaas permite clientes duplicados.
2. **Alerta de chave por dono.** O alerta de chave de API (`ACCESS_TOKEN_*`) olha o **nome** da chave:
   - **nossa** (cadastrada como "Chave do MetaBuilder"): alerta de urgência, como sempre;
   - **de outro app** (cadastrada como "Chave de outro app"): e-mail discreto "… (outro app)", dizendo que não afeta o MetaBuilder, ou **nenhum** se a tela estiver em "Não avisar";
   - **desconhecida** (sem nome, ou nome não cadastrado): alerta de urgência com a linha "Chave cadastrada? Não…", pedindo para cadastrar. **Na dúvida, avisa.**
   - Sem nada cadastrado, tudo funciona como antes.
3. **Eventos de pagamento de outro app ignorados.** Evento de pagamento, assinatura ou nota cuja referência externa **existe, não é nossa e não está no nosso banco** é ignorado (resposta 200 para o Asaas não reenviar; no log da função aparece "[app-externo] … ignorado"). Isso evita alerta de "pagamento sem cliente identificado" e de estorno que não são nossos. **Sem referência externa**, o evento **não** é ignorado (não dá para saber de quem é) e o alerta de não identificado continua valendo.

## Configuração (uma vez)

1. Em **Sistema > Avisos de cobrança > Apps neste Asaas**, cadastre as chaves como o Asaas mostra o nome em *Integrações > Chaves de API* (por exemplo: `MetaBuilderPRO` como "Chave do MetaBuilder" e `TraderMasterPRO` como "Chave de outro app"). Maiúsculas e acentos não importam. Escolha se quer o aviso discreto ou nenhum para chaves de outros apps. Salve.
2. **Deploy das Edge Functions** `asaas-webhook` e `asaas-checkout` (CLI: `supabase functions deploy asaas-webhook asaas-checkout`; pelo painel, colar os arquivos únicos gerados por `node scripts/bundle-edge-functions.mjs`). O site (Next) também precisa ir ao ar, por causa da tela e do texto do e-mail.
3. Combine com o responsável pelo outro app um **prefixo próprio** de referência externa e de cliente (item 4 abaixo).

## Efeito na emissão de NFS-e (ver `docs/nfse-asaas-plano.md`)

- Cada nota é pedida **por pagamento nosso**, de forma explícita pela API; o outro app não interfere.
- O ponto de atenção está no painel do Asaas: a **emissão automática por assinatura** deve ficar **desligada nas assinaturas do MetaBuilder** (nós emitimos pela API, depois do prazo de arrependimento) e pode ficar ligada nas do outro app. A configuração fiscal do Asaas é da conta; nossas chamadas levam o código de serviço e os valores explicitamente em cada nota.
- Os eventos `INVOICE_*` também chegam de todos os apps; o filtro do webhook já olha a referência externa das notas.

## Levando a mesma estrutura para os outros apps (TraderMasterPRO, VeritumPRO)

A ideia é simétrica: **cada app tem o seu próprio cadastro** (no banco dele) e marca **o próprio nome como "nossa"** e os demais como "de outro app". Cadastro feito em 18/11/2026 no MetaBuilder: `MetaBuilderPRO` (nossa), `TraderMasterPRO` e `VeritumPRO` (outros), aviso de outros apps em "Não avisar".

Quando o TraderMasterPRO (ou o VeritumPRO) receber a mesma estrutura, o que se leva e o que se ajusta:

1. **O módulo** `supabase/functions/_shared/asaasApps.ts` (regras puras), a tela "Apps neste Asaas" e a ação do SuperAdmin. No cadastro dele: o próprio nome como "Chave do app" e os outros (incluindo `MetaBuilderPRO`) como "outro app".
2. **O código do app** nas referências de pagamentos e assinaturas: no MetaBuilder é `mb` (constante `OWN_APP_CODE` em `familyRefs.ts`: `mb_ws_...`); no TraderMasterPRO é `tm`, no VeritumPRO `vt`. O padrão completo está em `docs/familia-pro-referencias.md`.
3. **A marca de cliente:** no MetaBuilder é `mb_us_<id>`; no TraderMasterPRO, `tm_us_<id>`; no VeritumPRO, `vt_us_<id>`. Clientes antigos dele, sem marca, são adotados e marcados na próxima compra, como foi feito aqui.
4. **O filtro no webhook** (evento de pagamento, assinatura ou nota que não é dele e não está no banco dele é ignorado) e a leitura do nome da chave nos alertas.
5. **Cada app com o seu endereço de webhook** e a sua chave, com nome próprio. Todos recebem todos os eventos da conta; o filtro de cada um decide o que é seu. (Se a conta aceita mais de um webhook, não confirmei; se aceitar só um, o endereço único precisa tratar todos os apps.)

## Limites conhecidos

- A identificação de pagamentos depende da **referência externa**. Pagamento de outro app **sem** referência continua gerando o alerta de "não identificado" (melhor avisar do que perder um pagamento nosso).
- A identificação de chaves depende do **nome**. Duas chaves com o mesmo nome em apps diferentes se confundem: dê nomes distintos.
- Clientes antigos do MetaBuilder (sem marca) são **adotados e marcados** na próxima compra do usuário, se ainda estiverem ligados ao perfil.
- Eu não verifiquei como o Asaas trata dois clientes com o mesmo CPF/CNPJ além do que a documentação diz (permite duplicados). Se o checkout de alguém falhar ao criar o cliente, a mensagem do Asaas aparece na tela e o log da função traz o motivo.

## Como testar

**Automáticos** (rodam em `npm test`, arquivo `src/lib/__tests__/asaasApps.test.ts`): reconhecimento das referências, leitura segura do cadastro de apps, classificação da chave (maiúscula e acento), decisão do aviso (nossa e desconhecida sempre avisam), evento de outro app (só com referência, não nossa e fora do banco), e-mails por tipo de chave, e que o webhook ignora o evento antes de qualquer tratamento e o checkout nunca usa cliente por e-mail.

**Simulador do webhook** (`scripts/simular-webhook-asaas.mjs`, em produção, sem mexer em cliente nem pagamento real). No seu terminal, defina `SUPABASE_URL` e `ASAAS_WEBHOOK_TOKEN` (o mesmo token do webhook; **não cole no chat nem em arquivo**) e rode:

```powershell
node scripts/simular-webhook-asaas.mjs todos
```

| Cenário | Esperado |
|---|---|
| `chave-nossa` | HTTP 200; alerta de urgência na fila e e-mail ao admin: "Chave de API do Asaas expirou" |
| `chave-outro-app` | HTTP 200; aviso discreto "… (outro app)" (ou nenhum, se "Não avisar") |
| `chave-desconhecida` | HTTP 200; alerta de urgência com "Chave cadastrada? Não…" |
| `pagamento-outro-app` | HTTP 200 com `{"success":true,"ignored":"other_app"}`; nada na fila |

Depois, no SQL Editor: `select kind, status, payload from billing_notices order by created_at desc limit 5;` (o `payload.scope` mostra `own`, `other` ou `unknown`).

**Em produção, com um cliente de verdade:**
- [ ] Cadastrar, em um cliente de teste do MetaBuilder, uma compra (R$ 5) com o **mesmo e-mail** de um cliente já existente no outro app. O Asaas deve mostrar **dois clientes** (o do outro app intacto, com as notificações como estavam, e o nosso com a referência `mb_us_<id>`).
- [ ] Uma segunda compra do mesmo usuário deve reutilizar o cliente marcado (não criar outro).
- [ ] Um pagamento do outro app deve aparecer no log do webhook como "[app-externo] … ignorado", sem aviso ao admin.
