# BPM: roteiro de testes (23/11/2026)

Dois blocos, nesta ordem: **Parte 1** confere que a plataforma e o CLI continuam certos (o motor foi refeito por baixo e os gatilhos de 04/11 nunca foram testados com o CLI real);
**Parte 2** testa o BPM no **app exportado** (novo). Marque cada item e me mande o que falhar, com a tela ou o log.

## O que já foi verificado por mim (sem navegador seu, sem CLI real)

- `tsc`, `npm test` (1928 testes) e `npm run build` limpos.
- Núcleo do motor com 18 testes de conformidade (condição, update/insert/delete, e-mail, webhook, laço, bloqueio, Oracle e PostgreSQL).
- Gerador: app **sem fluxos fica idêntico** ao de antes; com fluxos, o código gerado compila (`next build` real).
- **App exportado de verdade (PostgreSQL + Node, banco de testes):** "Antes de criar" bloqueia e mostra a mensagem, nada é gravado; "Ao criar" insere o produto; histórico em `mb_bpm_runs`; webhook recusa sem segredo/segredo errado/método errado/fluxo inexistente e roda com o segredo certo. (`e2e/tests/bpm.spec.ts`, 3 testes passando.)

## O que **não** foi testado (é o objetivo deste roteiro)

CLI real com o motor novo; os gatilhos de 04/11 com o CLI real; **Oracle** (nada rodou em Oracle de verdade); **agendamento** disparando de fato no app exportado; **e-mail** pelo SMTP; botão ligado a fluxo no navegador;
exportação de **workspace** com fluxos; app exportado atrás do login (proxy com sessão); Java (fora do escopo).

---

## Parte 1 — Plataforma e CLI

**Preparação.** Use um projeto de teste (ex.: Vendas PG, banco `crm`). Rode o CLI do código novo: `cd cli; node index.js` (o `.exe` só pega a mudança depois de `npm run build` dentro de `cli/`).
Acompanhe o terminal do CLI: as linhas `[BPM] ...` mostram o que o motor fez. Para cada fluxo abaixo, **publique** o fluxo no Studio (ativo).

| # | O que montar no Studio | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| 1.1 | Fluxo **Ao criar** na tabela X, condição de um campo, ação **atualizar** outro campo do mesmo registro (filtro `id = {{X.id}}`) | Criar registro que atende e outro que não atende | Só o que atende é alterado; terminal mostra `Executando Update` | ☐ |
| 1.2 | Fluxo **Ao editar** com ação **inserir** em outra tabela (campos com `{{X.campo}}`) | Editar um registro | Linha nova na outra tabela com os valores certos | ☐ |
| 1.3 | Fluxo **Antes de criar** com condição + nó **Resposta** bloqueando (mensagem com `{{X.campo}}`) | Salvar registro que cai na condição | Bloqueia, mostra a mensagem, **nada gravado** | ☐ |
| 1.4 | Fluxo **Antes de editar** com ação **mutate** (muda um campo) + Resposta permitindo com mensagem | Editar | Grava o valor mudado pelo fluxo; mensagem aparece | ☐ |
| 1.5 | Fluxo **Antes de excluir** com Resposta bloqueando (04/11) | Excluir registro que cai na condição, e outro que não | O primeiro **não** é excluído e mostra a mensagem; o segundo é excluído | ☐ |
| 1.6 | Fluxo **Ao excluir** com ação inserir em tabela de log (04/11) | Excluir um registro | Linha no log com os dados do registro excluído | ☐ |
| 1.7 | Fluxo **Ao carregar formulário** com mutate (04/11) | Abrir o formulário de edição | Campo já vem alterado | ☐ |
| 1.8 | Fluxo com **Webhook de entrada** (04/11) que insere linha com `{{webhook.codigo}}`; copie o segredo (aparece uma vez) | Chame o endereço do fluxo (veja abaixo) com e sem segredo | Sem segredo/errado: recusa. Certo: linha inserida | ☐ |
| 1.9 | Fluxo **Agendado** recorrente para daqui a 2 minutos, ação inserir | Esperar o horário | Executa; terminal `Agendamento disparado`. **Mudança desta etapa:** o disparo agora também é registrado como execução (antes não era) | ☐ |
| 1.10 | **Ação customizada** (botão) ligada a um fluxo, em um caso de uso | Clicar no botão | Fluxo roda; tela atualiza | ☐ |
| 1.11 | Fluxo com ação **e-mail** para "usuários e grupos do sistema" e outro para "campo da tabela" | Disparar | E-mails chegam (pela plataforma); sem destinatário cai no e-mail padrão | ☐ |
| 1.12 | Fluxo com ação **webhook** para um endereço inexistente | Disparar | Fluxo termina; execução marcada como **erro**; e-mail de falha (se ligado no Studio) | ☐ |
| 1.13 | Fluxo em **laço** (A → B → A) | Disparar | Interrompe em 100 passos; execução `loop` | ☐ |
| 1.14 | Fluxo em tabela **Oracle**, se tiver banco Oracle à mão | Repetir 1.1 e 1.3 | Mesmo resultado do PostgreSQL | ☐ |

| 1.15 | Fluxo **Ao editar** com **Restringir a um campo** (De/Para, 24/11), campo `status`, Para `Enviado`, ação inserir em tabela de log | Mudar o status para Enviado; depois editar só outro campo | Dispara só na mudança do status. Detalhes e regras em `docs/bpm-roteiro-gatilhos.md` (teste 3) | ☐ |

Webhook de entrada (1.8), PowerShell (troque `<ID>`, o endereço do site e o segredo):

```powershell
Invoke-RestMethod -Method Post -Uri "https://SEU-SITE/api/v1/webhook/<ID>" -Headers @{ "X-Webhook-Secret" = "<segredo>" } -ContentType "application/json" -Body '{"codigo":"A1"}'
```

**Critério da Parte 1:** tudo igual ao que funcionava antes do refator (1.1 a 1.4, 1.9 a 1.13) e os de 04/11 (1.5 a 1.8) funcionando. Qualquer divergência: **pare e me avise** antes da release do CLI.

---

## Parte 2 — App exportado (Node + PostgreSQL)

**Preparação.**

1. No Studio, abra um fluxo e confira o **selo** ao lado do nome: "Vai no app exportado" (verde), "parcialmente" (amarelo) ou "Não vai" (cinza). Passe o mouse no amarelo: diz o que fica de fora.
2. Use o **mesmo projeto e os fluxos da Parte 1** (ativos). Exporte para uma **pasta** (IDE Local: Sincronizar, ou Entrega > Código-fonte limpo, escolhendo PostgreSQL + Node).
3. Na pasta: `npm install`, crie o `.env` a partir do `.env.example` (preencha `DATABASE_URL`, `MB_SESSION_SECRET` e, para e-mail, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`), `npm run build` e `npm start` (ou `npm run dev`).
4. Use o app com **um usuário comum** (com login, se o projeto tiver login) e, em outra aba, o seu cliente SQL no banco.

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 2.1 | Conferir os arquivos novos na pasta: `lib/bpm/core.js`, `lib/bpm/workflows.json`, `lib/bpm/runtime.ts`, `instrumentation.ts` (e `app/api/bpm/webhook/...` se houver fluxo de webhook) | Existem; `workflows.json` só tem os fluxos **ativos** | ☐ |
| 2.2 | Repetir **1.3** (Antes de criar bloqueia) no app | Mensagem do fluxo aparece no aviso vermelho; nada gravado | ☐ |
| 2.3 | Repetir **1.4** (Antes de editar com mutate) | Grava o valor mudado pelo fluxo | ☐ |
| 2.4 | Repetir **1.5** (Antes de excluir bloqueia) | Registro permanece e a mensagem aparece | ☐ |
| 2.5 | Repetir **1.1, 1.2 e 1.6** (Ao criar/editar/excluir) | Mesmos efeitos no banco; a tela **não** espera o fluxo terminar | ☐ |
| 2.6 | Consultar o histórico: `SELECT workflow_name, status, trigger_source, started_at, duration_ms, error_message FROM mb_bpm_runs ORDER BY id DESC LIMIT 20;` | Uma linha por execução; bloqueio aparece como `success` com `details.blocked = true`; origem `evento INSERT`, `validação BEFORE_INSERT` etc. | ☐ |
| 2.7 | Fluxo com **e-mail** (destinatário fixo ou campo da tabela) | E-mail chega pelo seu SMTP, com o modelo escolhido. Sem SMTP no `.env`: o fluxo segue e a execução fica como **erro** ("SMTP não configurado") | ☐ |
| 2.8 | Fluxo com e-mail para **usuários e grupos do sistema** | **Não** resolve (limitação): vai para `BPM_MAIL_FALLBACK`/`SMTP_USER`. Confirme que o selo avisou | ☐ |
| 2.9 | **Webhook de entrada** (como em 1.8, mas em `http://localhost:3000/api/bpm/webhook/<ID>`) | Recusa sem segredo/errado (401), método errado (405); roda com o segredo certo. Se o app tem login, o endereço funciona **sem sessão** | ☐ |
| 2.10 | **Agendado** (como 1.9) com o servidor ligado | Dispara no horário (fuso `BPM_TIMEZONE`, padrão São Paulo); linha em `mb_bpm_runs` com origem `agendamento` | ☐ |
| 2.11 | Subir **duas instâncias** do app (portas diferentes, mesmo banco) com um fluxo agendado | Cada disparo roda **uma vez só** (confira `mb_bpm_runs` e `mb_bpm_locks`) | ☐ |
| 2.12 | `BPM_SCHEDULER=off` em uma instância e reiniciar | Essa instância não agenda mais | ☐ |
| 2.13 | **Botão ligado a fluxo** (como 1.10) | Clica, fluxo roda e a tela recarrega; erro vira alerta | ☐ |
| 2.14 | **Retrato:** mude um fluxo no Studio (ex.: outra mensagem de bloqueio) | O app **não muda** até exportar/sincronizar de novo; depois de sincronizar, passa a valer | ☐ |
| 2.15 | Exportar um projeto **sem fluxos ativos** | Sem `lib/bpm`, sem `instrumentation.ts`, sem variáveis de SMTP no `.env.example`, nada de `nodemailer`/`node-cron` no `package.json` | ☐ |
| 2.16 | Fluxo com **webhook de saída** para endereço lento ou inexistente | Termina em até ~10 s; execução `error`; app continua respondendo | ☐ |
| 2.17 | `.env.example` e `DEPLOY.md` | Têm as variáveis (`SMTP_*`, `BPM_*`) e a seção "Automações (BPM)" | ☐ |
| 2.18 | Log do servidor | **Não** mostra dados dos registros (só `[BPM] ...` sem valores). Com `BPM_VERBOSE=1` mostra os detalhes | ☐ |
| 2.19 | Exportar um **workspace** com mais de um projeto, sendo um com fluxos | Cada app leva só os fluxos do **seu** projeto | ☐ |
| 2.20 | App **Oracle** exportado, se tiver banco Oracle | 2.2 a 2.6 funcionam; `mb_bpm_runs` e `mb_bpm_locks` criadas sozinhas | ☐ |

| 2.21 | Repetir **1.15** (De/Para) no app | Dispara só quando o campo muda para o valor "Para"; edição de outro campo não dispara | ☐ |

## Limitações conhecidas (confirme que são aceitáveis)

- **"Ao carregar formulário"** não vai no app exportado (o selo avisa).
- E-mail para **usuários e grupos do sistema** não é resolvido no app exportado.
- A **mensagem de sucesso** do fluxo (ação permitida com mensagem) não é mostrada no app exportado; só a de **bloqueio** aparece.
- Bloqueio em tabelas de **detalhe** gravadas pelas abas do formulário (itens do pedido) impede a gravação, mas **sem mensagem** na tela.
- **Sem tela** de execuções: o histórico fica na tabela `mb_bpm_runs`.
- O app exportado é **retrato**: muda só ao sincronizar/entregar de novo.
- Só **Node + PostgreSQL/Oracle**. MySQL, SQL Server, Supabase e Java Spring não levam fluxos (ainda).
- Para o CLI com o motor novo ir para produção: **publicar a release da IDE/CLI antes do deploy do site** (o protocolo do túnel não mudou).

## Como me passar o resultado

Para cada item que falhar: o número, o que você fez, o que esperava, o que aconteceu, e a linha do terminal do CLI ou do servidor (sem senhas), mais o resultado de `mb_bpm_runs` quando for do app exportado.
