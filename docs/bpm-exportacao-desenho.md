# BPM no app exportado e na IDE Local: desenho (23/11/2026)

**Status: só desenho. Nada foi codado.** Este documento diz o que o BPM faz hoje, o que precisa mudar para os fluxos do Studio rodarem **dentro do app exportado**
(Node e Java Spring) e o que isso significa para a IDE Local. Decisões em aberto estão no fim (seção 9). Contexto: o dono quer fazer ("vou querer isto sim"),
começando pelas validações síncronas ("Antes de..."), que são as mais valiosas.

## 1. O que significa "BPM no app exportado"

Hoje o BPM é um recurso da **plataforma**: o fluxo é desenhado no Studio, guardado em `bpm_workflows.flow_data` e executado pelo **Agente CLI** (`cli/bpmEngine.js`),
que fala com o banco do cliente. O app exportado não tem plataforma nem CLI: ele é código que o cliente roda na própria infraestrutura. Para o fluxo funcionar
ali, o app precisa ter **os fluxos, um motor e os pontos de disparo dentro dele**, falando só com o banco do próprio app.

## 2. Como o BPM funciona hoje (resumo do que o motor faz)

**Gatilhos** (nó `trigger`, campo `triggerType`):

| Gatilho | Quando | Quem dispara hoje |
|---|---|---|
| `INSERT`, `UPDATE`, `DELETE` | depois de gravar, não bloqueia | CLI (`processEvent`) após a ação no banco |
| `BEFORE_INSERT`, `BEFORE_UPDATE` | antes de gravar o formulário; **pode bloquear e alterar os dados** | runtime web (`useRecordFormLogic.requestBpmSync`) |
| `BEFORE_DELETE` | antes de excluir; pode bloquear | CLI lê o registro e roda `processSyncEvent` |
| `ON_LOAD` | ao abrir o formulário; pode preencher valores e mostrar mensagem | runtime web |
| `SCHEDULED` | cron: recorrente (dias da semana + hora) ou uma vez (data e hora) | `node-cron` dentro do CLI |
| `WEBHOOK` | chamada externa com segredo por fluxo (hash SHA-256) | rota `/api/v1/webhook/[workflowId]` repassa ao CLI |
| ação personalizada | botão da tela ligado a fluxos (`trigger_bpm`) | runtime web, via túnel |

**Nós:** `trigger`, `condition` (um grupo de regras com E/OU e operadores `== != > < >= <=`), `action` e `response` (só nos fluxos síncronos: `responseAllowAction` + mensagem).

**Ações:** `update`, `insert`, `delete` (os dois destrutivos exigem filtros: sem filtro são **ignorados**), `webhook` (GET/POST... com variáveis), `email` (destinatário por tabela,
personalizado ou "do sistema" = usuários e grupos do projeto) e, nos síncronos, `mutate` (altera os dados em memória antes de gravar).

**Variáveis:** `{{tabela.campo}}` lê do registro do gatilho, da tabela da ação, ou de **outra tabela por convenção de chave estrangeira** (`<tabela sem s>_id`, `<tabela>_id`, `id_<tabela>`).
No webhook de entrada, `{{webhook.campo}}`.

**Execução:** percurso em largura, máximo **100 passos** (acima disso é "laço"). O resultado de cada execução (sucesso, erro ou laço) vai para `bpm_runs` pela rota `/api/automations/runs`,
com aviso por e-mail em caso de erro. Falha de webhook ou de e-mail **não interrompe o fluxo**, mas a execução termina como erro.

### Dependências da plataforma (o que NÃO existe no app exportado)

1. **Os fluxos** (`bpm_workflows`, via Supabase, com atualização em tempo real).
2. **O dicionário de modelos** (`models`: id do modelo → nome da tabela), usado em todo gatilho e ação (`triggerModelId`, `actionModelId`).
3. **O envio de e-mail:** o motor chama `/api/automations/email` da plataforma, que usa o SMTP dela.
4. **O registro das execuções:** `/api/automations/runs` (tabela `bpm_runs` na plataforma).
5. **Destinatários "do sistema":** `project_auth_config`, `project_roles`, `project_user_roles` (ou as tabelas de grupos do banco do cliente).

## 3. O que muda no app exportado (decisões de desenho)

1. **Fluxos viram um arquivo gerado** (por exemplo `bpm/workflows.json`), um **retrato** dos fluxos ativos no momento da geração. Os ids de modelo já saem resolvidos para o nome da tabela.
   Consequência a dizer ao cliente: no app exportado o fluxo só muda quando o dev **sincroniza ou entrega de novo** (na plataforma é em tempo real).
2. **Execuções:** tabela `mb_bpm_runs` no **banco do cliente** (criada pelo `npm run db:setup`, como as demais `mb_*`), com retenção configurável. Aviso de erro por e-mail pelo SMTP do app.
3. **E-mail:** SMTP direto, com variáveis no `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `BPM_MAIL_FROM`...). Os modelos de e-mail (`emailTemplates`) são embutidos.
   Destinatário "do sistema" usa as tabelas de acesso que a exportação já gera (usuários e grupos); o mapeamento exato precisa ser confirmado na fase 1.
4. **Webhook de entrada:** rota pública do próprio app, com a mesma segurança de hoje (segredo apresentado em `Authorization: Bearer` ou `X-Webhook-Secret`, comparado ao **hash** guardado, corpo máximo de 64 KB,
   até 100 campos). Sem hash configurado, fechado por padrão.
5. **Agendador:** no Node, iniciado na subida do servidor; no Java, `@Scheduled`/`TaskScheduler`. **Só uma instância** deve agendar (duas instâncias duplicariam o fluxo): liga-se por
   `BPM_SCHEDULER=on` e, por segurança, usa uma trava no banco. Fuso horário configurável (`BPM_TIMEZONE`).
6. **Escopo de bancos no primeiro corte:** **PostgreSQL e Oracle**, os mesmos do CLI hoje (aspas duplas e `$1`/`:1`). MySQL, SQL Server e a pilha Supabase (que não tem SQL direto, só REST) ficam fora,
   e o Studio avisa isso no fluxo.

## 4. Arquitetura: um núcleo de motor compartilhado

Como foi feito com o BI (o app exportado usa o **mesmo planejador** do painel, embutido por um script e protegido por teste), o motor do BPM deve ter **um núcleo único**.

```
bpmCore (CommonJS puro)          portas injetadas
  percurso do grafo               db        query(sql, params) + dialeto (postgres | oracle)
  condições                       models    id do modelo -> tabela
  variáveis {{tabela.campo}}      mailer    send({ to, subject, html })
  ações (update/insert/delete/    http      chamada de webhook (com limite de tempo)
        webhook/email/mutate)     runs      registrar a execução
  gatilhos (evento, síncrono,     recipients  resolver destinatários "do sistema"
        webhook, agendado)        clock     agora / agendador
```

- **CLI:** `bpmEngine.js` passa a ser uma casca fina sobre o núcleo, com as portas ligadas à plataforma (Supabase, e-mail e registro de execuções pela API). **Comportamento idêntico ao de hoje.**
- **App Node exportado:** o gerador **embute o núcleo** (como `biRuntimeFiles.generated.ts`, com um script `gen-bpm-runtime.mjs` e um teste de guarda que falha se esquecerem de regenerar), com as portas ligadas ao banco do app, ao SMTP e à tabela `mb_bpm_runs`.
- **App Java exportado:** **não reaproveita código**. É um porte do mesmo comportamento em Java (`JdbcTemplate`, JavaMail, cliente HTTP, `@Scheduled`).
- **Teste de conformidade:** uma biblioteca de **fixtures JSON** (fluxo + dado + resultado esperado: quais ações, qual SQL e parâmetros, qual resposta) executada pelo núcleo JS **e** pelo Java. É o que garante que os dois fazem o mesmo.
  O repositório já tem uma auditoria de paridade entre Node e Java (`parityAudit.ts`) que serve de modelo.

### Semântica a preservar (e a fixar nas fixtures)

Percurso em largura, 100 passos máximo; condição avalia **só o primeiro grupo** (hoje é assim, "simplificado para MVP"); `update` e `delete` sem filtro são ignorados; `mutate` altera só os dados em memória;
`response` com `allowAction = false` aborta na hora com a mensagem; em fluxos síncronos "a última mensagem vence"; falha de webhook ou e-mail vira erro da execução sem parar o fluxo;
ordem de execução dos fluxos e dos gatilhos igual à de hoje.

### Pontos a corrigir ao extrair o núcleo (achados na leitura do motor)

| Achado | Onde | Proposta |
|---|---|---|
| Em `update` e `insert` o nome do campo é montado como `"${f.field}"` **sem sanitizar** (nos filtros há `replace(/[^a-zA-Z0-9_]/g, '')`) | `runNodeAction` | sanitizar igual aos filtros; no app exportado a configuração é do dev, mas é defesa em profundidade |
| `replaceVariables` consulta **qualquer tabela** citada em `{{tabela.campo}}` | `replaceVariables` | restringir às tabelas dos modelos do projeto |
| Webhook de saída sem **limite de tempo** e sem bloqueio de destinos internos (rede privada, `localhost`) | ação `webhook` | limite de tempo e, no app exportado, opção de bloquear IP interno |
| E-mail "do sistema" cai em `contato@metabuilderpro.com` quando não acha destinatário | ação `email` | no app exportado usar uma variável (`BPM_MAIL_FALLBACK`) ou o próprio `SMTP_USER` |
| Registros de depuração imprimem os **dados completos** do registro (dados pessoais) | todo o motor | no app exportado, registro mínimo (ids, contagens), sem dados |
| Agendamento usa o fuso da máquina | `initScheduledJobs` | fuso explícito e configurável |

## 5. Onde mexer no app gerado (pontos de integração)

**Gerador (`src/lib/generator`):**
- `projectSource.ts` e `workspaceData.ts`: buscar os fluxos **ativos** do projeto (e dos projetos do workspace) em `bpm_workflows`, junto com o dicionário de modelos.
- `parser.ts` e `ast.ts`: um tipo `bpm` no AST (lista de fluxos já com as tabelas resolvidas).
- `layers/actions.ts` (`generatePgActions` e o equivalente Oracle): em `create`, `update` e `delete`, chamar o motor:
  - `BEFORE_INSERT`/`BEFORE_UPDATE`/`BEFORE_DELETE`: **síncrono**, antes de gravar; pode bloquear, mostrar mensagem e alterar os dados;
  - `INSERT`/`UPDATE`/`DELETE`: **depois** de gravar, sem bloquear a resposta ao usuário (como no CLI).
- Telas geradas (`layers/routes`, `components`): `ON_LOAD` do formulário e o aviso de mensagem do fluxo; **ações personalizadas** ligadas a fluxo (`trigger_bpm`).
- Nova rota de **webhook de entrada** e o **agendador** na subida do servidor.
- `emitter/node-project.ts`, `access-setup-script.ts`: tabelas `mb_bpm_runs` (e a trava do agendador) no `db:setup`.
- `emitter/java-spring-backend.ts`: gancho em `${Model}Service` (`create`, `update`, `delete`) e `${Model}Controller`, serviço de agendamento.
- `emitter/deploy-pack.ts`: variáveis no `.env.example` (SMTP e `BPM_*`), nota no `DEPLOY.md` de que o servidor precisa ficar ligado para os fluxos agendados.

**Observação:** o `src/utils/export/generators/FeatureGenerator.ts` (que fixa `isAutomationsEnabled: false`) **não é importado por nenhum arquivo**. É o exportador antigo, substituído pelo motor único. Não é ali que o BPM entra. Confirmar antes de apagar.

## 6. A IDE Local

A IDE Local (Sincronizar, Entrega, Ambiente de Testes) pede o código ao mesmo motor (`/api/project-source` e `/api/workspace-source`). **Se o gerador passar a emitir o BPM, a IDE recebe os arquivos sozinha**,
sem código novo para o sincronizador. O que muda por lá é pequeno:

1. **Ambiente de Testes** (`IdeTestModal`): o plano é gerado a partir do que está configurado no Studio. Incluir os fluxos: criar, alterar ou excluir um registro e conferir o efeito (e o bloqueio de uma validação).
2. **Entrega** (`Pacote Docker` e `Pacote compilado`): conferir que a pasta sincronizada com BPM gera os pacotes normalmente, com as novas variáveis no `.env.example`.
3. **Tours e ajuda** da IDE e do Studio.
4. **Textos e vídeo:** a página `/features/bpm` e o vídeo hoje dizem, corretamente, que o BPM é da plataforma. Só mudar quando o recurso existir **e estiver testado**.
5. **Studio** (`src/components/studio/bpm/*`): mostrar, em cada fluxo, se ele **vai na exportação** (Node, Java, banco suportado, recursos não suportados), para o dev não prometer o que não existe.

## 7. Fases

| Fase | Entrega | Tamanho |
|---|---|---|
| **0. Núcleo compartilhado** | extrair `bpmCore` do `bpmEngine.js` com as portas, CLI como casca fina, fixtures de conformidade, sem mudar nenhum comportamento. **Exige release do CLI antes do site** | médio |
| **1. Node + PostgreSQL, validações síncronas** | fluxos no AST e no arquivo gerado, núcleo embutido, `BEFORE_INSERT/UPDATE/DELETE` e `ON_LOAD` nos pontos de integração, `mb_bpm_runs`, SMTP, matriz "vai na exportação" no Studio, testes no app exportado (a pasta `e2e/` já cobre PG+Node) | grande |
| **2. Node: o resto** | `INSERT/UPDATE/DELETE` depois de gravar, ações personalizadas, webhook de entrada, agendador (com trava), e depois Oracle | grande |
| **3. Java Spring** | porte do motor, ganchos nos serviços, agendador, conformidade com as fixtures | grande |
| **4. Acabamento** | Ambiente de Testes, tours, textos, vídeo | médio |

A ordem segue o que o dono pediu: **validações primeiro**. A fase 0 é o investimento que evita ter duas cópias do motor divergindo.

## 8. Riscos

- **Java divergir do Node:** o porte é a parte mais cara; sem as fixtures compartilhadas, os dois acabam diferentes.
- **Agendador duplicado** com mais de uma instância do app (resolvido por flag e trava no banco, mas precisa de teste).
- **Retrato dos fluxos:** o cliente edita o fluxo no Studio e espera que mude no app exportado; só muda ao sincronizar. É preciso dizer isso claramente (na tela e nos textos).
- **SMTP do cliente:** sem ele o e-mail não sai. O app deve avisar claramente no log e nas execuções (erro "e-mail não enviado: SMTP não configurado").
- **Dados pessoais nos logs** do motor (depuração com o registro completo): no exportado, registro mínimo.
- **Fluxo com laço** (limite de 100 passos): igual a hoje, registra "laço" e interrompe.
- **Release do CLI:** a fase 0 refatora o motor do CLI. A regra do projeto é publicar a release da IDE/CLI antes do site quando o protocolo muda; aqui o protocolo não muda, mas o CLI mudaria, então vale testar com o CLI real antes.
- **Não testado até hoje com CLI real:** os gatilhos novos (Ao excluir, Antes de excluir, Ao carregar formulário, Webhook de entrada) foram feitos em 04/11 sem teste com CLI real. Testar isso **antes** de portar, para portar algo que funciona.

## 9. Decisões tomadas pelo dono (23/11/2026)

1. **Primeiro corte:** Node + PostgreSQL + validações síncronas primeiro; Oracle junto (como o CLI). MySQL, SQL Server e Supabase ficam de fora.
2. **Retrato dos fluxos:** o app exportado só atualiza os fluxos ao sincronizar ou entregar de novo.
3. **E-mail:** SMTP do próprio cliente no `.env`.
4. **Execuções:** gravadas na tabela `mb_bpm_runs` do banco do cliente; **sem tela** no primeiro corte.
5. **Java Spring:** só depois que o dono testar o Node.
6. **Testar:** implementar tudo primeiro; o dono testa 100% com o roteiro (`docs/bpm-roteiro-testes.md`), inclusive os gatilhos de 04/11 com o CLI real.

## 10. Estado atual (23/11/2026)

**Implementado (Node + PostgreSQL/Oracle), sem commit até o fechamento desta etapa:**

- **Núcleo `cli/bpmCore.js`** (JavaScript puro, com portas: banco, modelos, HTTP, e-mail, destinatários, agendador, registro de execuções, log). `cli/bpmEngine.js` virou casca fina com a mesma API e os mesmos prefixos `[BPM]`.
  Correções feitas na extração: nomes de campo de update/insert saneados; tabelas consultadas por `{{tabela.campo}}` só se forem modelos do projeto; operador do filtro só entre os conhecidos; webhook de saída com tempo limite de 10 s;
  `LIMIT`/`FETCH FIRST` e placeholders certos no Oracle; agendamentos agora passam por `runFlow` (aparecem no histórico, como os demais — mudança pequena e deliberada); modo de log mínimo (sem dados pessoais) no app exportado.
- **Conformidade:** `src/lib/bpm/conformance/fixtures.json` (fluxo + dado → o que deve acontecer) e `src/lib/bpm/__tests__/bpmCore.test.ts`. O porte para Java precisa passar nas mesmas fixtures.
- **Embutido como o BI:** `scripts/gen-bpm-runtime.mjs` → `src/lib/generator/bpmRuntimeFiles.generated.ts` (`npm run gen:bpm`, também no `prebuild`; teste guarda `bpmRuntimeFiles.test.ts`).
- **Gerador:** `parser`/`ast` ganharam `bpm` (`bpmExport.ts`: retrato dos fluxos ativos + mapa modelo → tabela + tabelas com gatilho); `layers/bpm.ts` gera `lib/bpm/*`, `instrumentation.ts`, rota de webhook, ação de botão e os ganchos
  nas actions de criar/editar/excluir **só das tabelas que algum fluxo escuta**. Sem fluxos (ou em outra stack/Java), o app fica **idêntico** ao de antes (testado).
- **Ganchos:** "Antes de..." roda antes de gravar (bloqueia com a mensagem do fluxo ou muda os dados); "Ao criar/editar/excluir" roda depois, sem travar a resposta.
- **Webhook de entrada:** `/api/bpm/webhook/<id>` (segredo por fluxo, só o hash no retrato, corpo até 64 KB, liberado no proxy).
- **Botões ligados a fluxo:** o botão chama a action `runBpmAction` (só fluxos ligados a algum botão; só o id do registro vem do navegador).
- **Agendador:** `node-cron` com fuso (`BPM_TIMEZONE`) iniciado pelo `instrumentation.ts`; cada disparo pega uma trava na tabela `mb_bpm_locks`, então com várias réplicas só uma executa; `BPM_SCHEDULER=off` desliga na instância.
- **Tabelas `mb_bpm_runs` e `mb_bpm_locks`:** criadas sozinhas na primeira execução (em vez de entrarem no `db:setup`), PostgreSQL e Oracle; histórico limpo diariamente (`BPM_RUNS_RETENTION_DAYS`).
- **Pacote de produção:** variáveis de SMTP e `BPM_*` no `.env.example` e seção "Automações (BPM)" no `DEPLOY.md`, só quando o app leva fluxos.
- **Studio:** selo no cabeçalho do fluxo ("Vai / Vai parcialmente / Não vai no app exportado"), por `src/lib/bpm/exportSupport.ts`.
- **e2e:** variante `pg-node-bpm` (`npm run gen -- pg-node-bpm`) e `e2e/tests/bpm.spec.ts`.

**Fora desta etapa (de propósito):**

- **"Ao carregar formulário" (`ON_LOAD`)** não vai no app exportado (o selo avisa). Precisa de gancho no formulário gerado.
- **Destinatários "usuários e grupos do sistema"** não são resolvidos no app exportado (use e-mail fixo, campo da tabela ou `BPM_MAIL_FALLBACK`); o selo avisa.
- **Mensagem de sucesso do fluxo** ("responseMessage" com a ação permitida) não é mostrada na tela do app exportado; só o bloqueio mostra a mensagem.
- **Tela de execuções** no app exportado: não existe (só a tabela).
- **Java Spring, MySQL, SQL Server, Supabase:** fora.
- **Ambiente de Testes da IDE, tours, textos e vídeo:** só depois dos testes do dono.
- **Gatilhos de 04/11 com CLI real:** continuam sem teste real; entram na parte 1 do roteiro.
- **Release:** o CLI mudou (casca + núcleo). Publicar a release da IDE/CLI **antes** do deploy do site (o protocolo do túnel não mudou).
