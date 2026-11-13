# Programa de parceiros (indicador com comissão): desenho, publicação e teste

Decisões fechadas com o dono em 2026-11-12. Código escrito, **nada publicado e nada testado com o Asaas real**.

## O que é
Um **parceiro** é uma pessoa ou empresa que indica clientes com um link/código e **ganha comissão em dinheiro** enquanto o indicado for assinante. O cliente paga o MetaBuilder normalmente (Asaas) e **não ganha desconto** (decisão: opção A). Um cliente indicado por parceiro **pode também indicar pelo iClub** (benefícios independentes). O parceiro não precisa ser cliente **nem ter conta no momento da aprovação**: sem conta, fica "aguardando cadastro" (guarda só o e-mail) e a conta é vinculada sozinha quando a pessoa entra com esse e-mail **confirmado** (`scripts/parceiros-vinculo-por-email.sql`).

## Regras
- **Comissão** = % sobre o valor **pago pelo cliente (bruto)** em **cada pagamento confirmado** do indicado, arredondada para baixo no centavo. O valor líquido (depois das taxas do Asaas) fica guardado só para consulta.
  - % padrão global (SuperAdmin edita; começa em 15) e % próprio por parceiro (vazio = padrão).
- **Carência**: a comissão nasce *pendente* e só fica **disponível** N dias depois do pagamento (padrão 7, SuperAdmin edita).
- **Estorno/reembolso/chargeback** do pagamento: a comissão pendente é **revogada**; se já estava num lote ou foi paga, vira **clawback** e o valor é **descontado do próximo lote** do parceiro. Cancelar a assinatura só **para** as comissões futuras (as já geradas valem).
- **Pagamento**: lote montado pelo SuperAdmin (filtra e seleciona parceiros), com **confirmação**, enviado por **Pix pela conta Asaas** do MetaBuilder. Valor mínimo por parceiro (padrão R$ 50) e **teto do lote** (padrão R$ 5.000, trava de segurança).
- **Código do link**: o mesmo mecanismo do iClub (`?ref=CODIGO` grava o cookie `iclub_ref_code`). Se o código for de um parceiro ativo, a indicação vai para o parceiro; senão, vale o iClub. O código do parceiro não pode repetir o código de nenhum cliente nem de outro parceiro.
- Parceiro **suspenso** não gera comissão nem entra em lote. Um e-mail só tem **um** parceiro. O parceiro não pode indicar a si mesmo.
- Só o **SuperAdmin** cadastra parceiros, muda %, chave Pix, carência, mínimo e teto. O parceiro só **lê** (a chave Pix aparece mascarada).

## Onde está
| Peça | Arquivo |
|---|---|
| Tabelas, funções do lote, ajustes | `scripts/parceiros.sql` |
| Regras puras (testadas) | `supabase/functions/_shared/partnerCommission.ts` |
| Banco + Asaas nas funções | `supabase/functions/_shared/partners.ts` |
| Gera/revoga comissão, aplica eventos `TRANSFER_*` | `supabase/functions/asaas-webhook/index.ts` |
| Envia os Pix | `supabase/functions/partner-payout/index.ts` |
| Valida o saque (Asaas pergunta antes de efetivar) | `supabase/functions/partner-transfer-validation/index.ts` |
| Ações do SuperAdmin e do parceiro | `src/app/actions/partners.ts` |
| Registro da indicação pelo código | `src/app/actions/iclub.ts` (`registerPartnerReferral`) |
| Tela do SuperAdmin | Regras da comissão: `PartnerSettingsAdmin.tsx` (aba **Regras de Preços** de `/admin/platform`, com link para a aba Parceiros). Gestão (interessados, parceiros, lotes): `PartnersAdmin.tsx` (aba **Parceiros**, com contador de candidaturas novas) |
| Painel do parceiro | `/parceiro` (`src/app/parceiro/page.tsx`, `src/components/partner/PartnerDashboardClient.tsx`) |
| Testes | `src/lib/__tests__/partnerCommission.test.ts` |

## Segurança (o que protege o dinheiro)
1. As tabelas têm RLS ligada **sem policy** e sem acesso para `anon`/`authenticated`: tudo passa por server actions e Edge Functions, que conferem quem age (sessão do SuperAdmin ou do próprio parceiro).
2. As funções SQL do lote só rodam para o `service_role`. O lote é **atômico** (trava as comissões `for update`, respeita mínimo, chave Pix e teto; passou do teto, desfaz tudo).
3. A chave do Asaas só existe na Edge Function `partner-payout` (que só aceita a chave de serviço). O navegador nunca a vê.
4. Cada item de lote **sai uma vez** (só envia o que está `pending`, e o marca `sending` antes de chamar o Asaas). Se a chamada não responder, o item fica `sending` para você conferir no Asaas e **liberar** manualmente; nada é reenviado sozinho.
5. O **webhook de validação de saque** do Asaas só aprova transferências **do nosso lote** (mesmo valor e mesma chave Pix) e recusa todo o resto, inclusive qualquer erro (falha segura).
6. A comissão é única por pagamento (`asaas_payment_id`), então eventos repetidos do Asaas não duplicam nada.

## Ordem de publicação (importa)
1. **SQL**: rodar `scripts/parceiros.sql` no SQL Editor de produção (pode repetir). Depende de `platform_settings` (já existe).
2. **Edge Functions** (pela CLI): `supabase functions deploy asaas-webhook partner-payout partner-transfer-validation`.
   - Pelo painel: `node scripts/bundle-edge-functions.mjs` e cole o `index.ts` de cada pasta em `supabase/functions-dashboard/`. `partner-payout` e `partner-transfer-validation` são **novas**: crie-as no painel.
   - **`partner-transfer-validation` é chamada pelo Asaas, sem login do Supabase**: desligue a verificação de JWT dessa função (na CLI: `--no-verify-jwt`; no painel: opção "Verify JWT" desligada), como já é na `asaas-webhook`. Ela se protege pelo token abaixo.
3. **Segredos** das funções (painel do Supabase > Edge Functions > Secrets): `ASAAS_TRANSFER_VALIDATION_TOKEN` = um texto longo e aleatório que só você conhece. (`ASAAS_API_KEY`, `ASAAS_URL` e a chave de serviço já existem.)
4. **Asaas**:
   - A chave de API usada em `ASAAS_API_KEY` precisa ter a permissão **TRANSFER** (Integrações > Chaves de API > permissões).
   - **Integrações > Mecanismos de segurança** (validação de saque): URL `https://<projeto>.supabase.co/functions/v1/partner-transfer-validation`, o mesmo token do passo 3 e um e-mail para avisos de erro. Deixe **desligadas** as opções "validar operações pela interface web", "estornos Pix" e "Splits", porque a função recusa tudo que não for transferência do lote.
   - **Atenção**: ao ativar esse mecanismo, **todo saque pela API** passa a ser validado. Só o nosso lote é aprovado.
   - **Webhooks**: o webhook que já aponta para `asaas-webhook` precisa também assinar os eventos de transferência (`TRANSFER_CREATED`, `TRANSFER_PENDING`, `TRANSFER_IN_BANK_PROCESSING`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`, `TRANSFER_BLOCKED`).
5. **Site** (Vercel): deploy normal. Não precisa de variável nova.
6. Conferir em `platform_settings`: `partner_default_percent`, `partner_grace_days`, `partner_min_payout`, `partner_payout_cap`.

Reverter: as versões anteriores estão no git. As tabelas novas não afetam o resto; desligar é parar de usar o link de parceiro e remover a assinatura de `TRANSFER_*` no webhook.

## Candidatura de parceiros (formulário em `/parceiros`)
Quem quer ser parceiro preenche o formulário da página (nome, e-mail, perfil, como pretende divulgar, consentimento LGPD). Não há autocadastro: a candidatura só **cai numa fila** e o SuperAdmin decide.
- **Ordem de publicação do vínculo por e-mail:** rodar `scripts/parceiros-vinculo-por-email.sql` **antes** do deploy (o código passa a gravar `partners.email`; sem o SQL, cadastrar parceiro dá erro).
- **Tabela** `partner_applications` em `scripts/parceiros-interessados.sql` (RLS sem policy, sem acesso de `anon`/`authenticated`; o IP só como hash). **Rodar esse SQL antes de testar.**
- **Anti-robô e abuso**: campo isca escondido, tempo mínimo de 3 s entre abrir e enviar, no máximo 5 envios por hora por IP (hash) e mesma pessoa em análise não duplica. A validação de verdade é no servidor (`src/lib/partnerApplications.ts`, `src/app/actions/partnerApplications.ts`).
- **Aviso por e-mail** à equipe a cada candidatura, pelo mesmo SMTP do checkout. Destino: variável `PARTNER_NOTIFY_EMAIL` na Vercel; sem ela, a própria caixa do SMTP. Se o e-mail falhar, a candidatura continua salva.
- **SuperAdmin**: na aba Parceiros (com contador de novas na própria aba) aparece o quadro **Interessados em ser parceiro**: **Aprovar e cadastrar...** (abre o cadastro do parceiro já preenchido, com código sugerido; ao salvar, a candidatura vira Aprovada), **Recusar**, **Reabrir** e **Apagar** (LGPD). Aprovar não exige conta: sem ela, o parceiro fica "aguardando cadastro" e o e-mail de boas-vindas pede para criar a conta com o mesmo e-mail.
- O WhatsApp continua na página como alternativa.

## Roteiro de teste em produção (com valores pequenos)
Use uma conta de parceiro de teste (outra conta sua) e um cliente de teste que **nunca pagou**.
0. **Candidatura**: depois do SQL e do deploy, abra `/parceiros` em janela anônima, preencha o formulário com o e-mail da conta de teste e envie. Conferir: mensagem de sucesso; e-mail de aviso na caixa; a aba **Parceiros** mostra o contador e o quadro com a candidatura. Reenviar o mesmo e-mail não duplica. Enviar rápido demais (menos de 3 s) ou sem marcar o consentimento é recusado. Depois use **Aprovar e cadastrar...** e siga o passo 1.
1. `/admin/platform` > **Regras de Preços** > **Comissão dos parceiros**: ajuste **carência 0 dias** e **mínimo R$ 1** (só para o teste; volte depois) e salve. Na aba **Parceiros**, cadastre a conta de teste como parceiro: código (ex.: `TESTE1`), chave Pix **sua**, % próprio (ex.: 10).
2. Abra uma janela anônima em `https://<site>/?ref=TESTE1`, cadastre o cliente de teste e pague a assinatura.
3. Conferir: em `/parceiro` (logado como o parceiro) aparece o indicado (e-mail mascarado) como **Assinante** e uma comissão. Em `partner_commissions`: `net` e `amount` corretos (amount = net × %, para baixo) e `release_at` = agora (carência 0).
4. Em **Parceiros** (SuperAdmin) o parceiro mostra o valor em **A pagar**. Marque-o, **Pagar por Pix...**, confira o resumo e confirme.
5. Conferir: o item vai de *Enviando* para *Em processamento* e para *Pago* (evento `TRANSFER_DONE`), o Pix chega na sua chave e o comprovante aparece. Se travar em *Enviando* sem id, **não reenvie**: confira no painel do Asaas.
6. **Estorno**: estorne o pagamento do cliente de teste no Asaas. Se a comissão estava *pendente*, vira *Cancelada*; se já estava paga, aparece **A descontar** e o próximo lote desconta.
7. Volte os ajustes (carência 7, mínimo 50).

## Limites e próximos passos
- **Pagamento automático em data fixa** (o SuperAdmin programa uma data e o sistema envia sozinho): fica para uma segunda etapa, depois que o fluxo manual estiver provado. A base (comissões disponíveis, lotes, validação) já serve a isso.
- **Chave Pix do parceiro:** ele a **envia** no painel (tipo, chave, CPF/CNPJ do titular e declaração), mas ela fica **pendente** e **só vale depois que o SuperAdmin aceita** na aba Parceiros (chave atual ao lado da nova). Só a chave ativa entra em lote; uma conta invadida não desvia pagamentos trocando a chave. O SuperAdmin é avisado por e-mail (chave mascarada). Rodar `scripts/parceiros-chave-pix-pendente.sql` antes do deploy.
- O painel está em `/parceiro` e **ainda não tem atalho no menu** do site.
- Impostos e nota fiscal da comissão são com o contador.
