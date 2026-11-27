# Aprovação humana na Automação de processos — plano (rascunho para aprovar)

Status: **só plano, nada codado** (2026-11-27). Decisões já combinadas com o dono:
- Aprovador: **pessoa ou perfil**; para perfil, **qualquer um do perfil** aprova.
- Onde age: **somente na tela "Minhas tarefas"** (link assinado no e-mail fica para depois).
- Bancos: **PostgreSQL e Oracle** desde a primeira versão.

## 1. Escopo (cinco itens, três etapas)

| Etapa | Itens | Entrega |
|---|---|---|
| A | Gatilho manual | **JÁ EXISTE (achado em 2026-11-27, nada a construir).** São as "ações customizadas" (botões) dos casos de uso, ligadas a um fluxo no painel do gatilho ("Botões de ação customizada"); o runtime envia `trigger_bpm` (`useViewCustomActions.ts`, `useCustomActionsRuntime.ts`) e o motor roda `processCustomAction`. Já coberto nos roteiros 1.10 e 2.13 de `bpm-roteiro-testes.md`. |
| B | Aguardar aprovação + Minhas tarefas + histórico | Núcleo; sai tudo junto. |
| C | Prazo (lembrete) | Reenvia o aviso depois de N horas. |

Fora de escopo: BPMN, raias, delegação, aprovação em paralelo/"todos devem aprovar", link no e-mail, painel de gargalos, ejeção do recurso (ver §8).

## 2. Como o motor funciona hoje (fatos lidos no código)

- O motor é `cli/bpmCore.js` (compartilhado), rodando **no Agente CLI contra o banco do cliente**. A configuração dos fluxos fica no Supabase (`bpm_workflows.flow_data`).
- `traverseGraph` percorre uma **fila em memória** (condição, ação, gatilho; no máximo `MAX_STEPS`). Não existe estado persistido: a execução vai do início ao fim.
- Nós existentes: `trigger`, `condition`, `action` (insert, update, mutate, delete, query, email, webhook) e `response`.
- Variáveis: `{{tabela.campo}}`, `{{usuario.*}}` (do `actor`, vindo da sessão assinada), `{{consulta.tabela}}`.
- Precedentes de tabela própria no banco do cliente: `mb_logs` (`cliDbLogger.js`) e `mb_help_feedback` (`helpFeedback.js`, **somente PostgreSQL**, com `CREATE TABLE IF NOT EXISTS` e aviso quando o usuário do banco não pode criar).

## 3. Dados (banco do cliente, criados pelo CLI)

Nomes com prefixo `mb_`, DDL idempotente, versão PG e versão Oracle.

**`mb_approval_tasks`**
- `id` (uuid/RAW16), `workflow_id`, `workflow_name`, `node_id` (nó "Aguardar aprovação")
- `table_name`, `record_pk` (texto) e `record_snapshot` (JSON: linha no momento do pedido)
- `ctx` (JSON: variáveis e datasets necessários para retomar)
- `assignee_kind` (`user` | `role`), `assignee_id`
- `status`: `pending` | `approved` | `rejected` | `expired` | `cancelled`
- `title`, `requested_by` (id/nome do ator), `created_at`
- `decided_by`, `decided_at`, `decision_comment`
- `due_at` (Etapa C), `reminded_at`, `reminder_count`

**`mb_approval_history`** (histórico por registro, só inclusão)
- `id`, `task_id`, `table_name`, `record_pk`, `event` (`requested` | `approved` | `rejected` | `reminded` | `cancelled`), `actor_id`, `actor_name`, `comment`, `created_at`
- Índice por (`table_name`, `record_pk`) para a linha do tempo.

Regras: nunca apagar histórico; `record_snapshot` é lido apenas por quem pode ver a tarefa; senhas e tokens são removidos do snapshot (mesma lista de colunas sensíveis já usada no seletor de colunas).

## 4. Motor (`cli/bpmCore.js`)

1. **Novo nó `approval`** no editor e no grafo. Configuração: aprovador (pessoa ou perfil), título (aceita variáveis), prazo opcional, e **duas saídas**: `approved` e `rejected` (mesmo padrão de `sourceHandle` do nó de condição).
2. **Pausar:** ao chegar no nó, o motor grava a tarefa (`status=pending`) com `ctx` e histórico `requested`, **encerra essa execução** (não segue pelas saídas) e registra a run como `success` com `details.waiting=true`. Avisa o aprovador por e-mail (reaproveita `buildEmail`/templates).
3. **Retomar:** nova entrada `resumeApproval(taskId, decision, comment, actor)` valida (§5), atualiza a tarefa, grava histórico, restaura `ctx`/variáveis e continua `traverseGraph` a partir da saída `approved` ou `rejected`. Nova variável `{{aprovacao.decisao}}`, `{{aprovacao.comentario}}`, `{{aprovacao.por}}`.
4. **Concorrência:** a decisão usa `UPDATE ... WHERE status='pending'` e confere as linhas afetadas, para duas pessoas do mesmo perfil não decidirem a mesma tarefa.
5. **Fluxos "antes de salvar":** o nó de aprovação **não é permitido** em fluxos síncronos (a tela esperaria dias). O editor avisa e o motor ignora com erro anotado.
6. **Mudança do fluxo com tarefas abertas:** a tarefa guarda `node_id` e um resumo do nó; se o nó não existir mais ao retomar, a decisão é gravada e a run registra erro (sem apagar a tarefa).
7. `cli/bpmCore.js` mudou, então rodar `npm run gen:bpm`.

## 5. Segurança (inegociável, `relayPolicy.ts`)

Ações novas do CLI e sua classe:

| Ação | Classe | Observação |
|---|---|---|
| `approval_list` (minhas tarefas) | livre p/ usuário final, filtrada | O CLI filtra pelo `actor` + perfis assinados; nunca devolve tarefa de outro. |
| `approval_decide` | livre p/ usuário final | Quem decide vem de `actor`, nunca do corpo. O CLI confere que o ator é o aprovador (pessoa) ou tem o perfil. |
| `approval_history` (por registro) | livre p/ usuário final | Só se o ator pode ver o registro (regras por linha já existentes em `access`). |
| `approval_admin_list` (todas as tarefas) | só desenvolvedor | Para o Studio. |
| `approval_cancel` | só desenvolvedor | Cancelar tarefa travada. |

- **Perfis do ator:** o servidor resolve os perfis da sessão (`loadAccessContext`) e os envia **assinados** no comando, junto de `actor` (campo novo `actor.roles`, descartado se vier do navegador, como `access` hoje). O CLI nunca confia em perfil enviado pelo navegador.
- Testes obrigatórios: classificação em `relayPolicy` (cada ação nova), tentativa de decidir tarefa alheia, de forjar `actor`/`roles`, dupla decisão, tarefa já decidida, usuário sem perfil.
- Ordem de release: **IDE (CLI) primeiro, servidor depois** (o protocolo do túnel muda).

## 6. Interface

- **Studio (editor):** nó "Aguardar aprovação" na barra lateral, painel de propriedades (aprovador: lista de usuários/perfis do app; título; prazo), duas saídas coloridas (verde Aprovado, vermelho Rejeitado). Aviso se estiver em fluxo síncrono.
- **Runtime:** item "Minhas tarefas" (com contador de pendentes) e tela com lista, filtros (pendentes/decididas), detalhe do registro (snapshot), campo de comentário e botões Aprovar/Rejeitar. Reaproveitar componentes de `src/components/runtime`.
- **Histórico no registro:** aba ou drawer "Aprovações" no formulário do registro com a linha do tempo (quem, quando, comentário).
- **Studio, visão do dono:** lista de todas as tarefas (para destravar/cancelar), em Logs ou na própria Automação.
- **i18n:** chaves novas nos três idiomas (paridade); um nome de chave = um texto. Textos: "Automação de processos" (não "BPM").
- **Etapa A:** nada a fazer; o botão ligado a fluxo já existe (ações customizadas). Pontos de atenção do que existe, sem mudar agora: `processCustomAction` usa só o **primeiro** nó de gatilho do fluxo, e o aviso "Ação executada com sucesso!" no runtime aparece após 1,5 s sem esperar o resultado.

## 6.1 Como o dono desenha o fluxo de aprovação

Tudo no editor que já existe: Studio > card **Automação de processos** ("Editor de automações"). O bloco **"Aguardar aprovação"** entra na barra lateral, ao lado de Gatilho, Lógica, Ação e Resposta. Quem desenha é o dono/desenvolvedor do app; o usuário final só vê a tarefa em "Minhas tarefas".

Papéis: **dono** (desenha, uma vez), **solicitante** (grava o registro ou aperta o botão), **aprovador** (decide na tela "Minhas tarefas").

O bloco tem duas saídas, como o Se/Senão: **Aprovado** (verde) e **Rejeitado** (vermelho). O que estiver ligado a cada saída é o que acontece depois.
- **Para:** o fluxo para sozinho no bloco e espera.
- **Avança:** o que estiver ligado à saída Aprovado.
- **Volta:** o que estiver ligado à saída Rejeitado. Na primeira versão, "voltar para correção" = **mudar o status do registro e avisar o solicitante**; quando ele corrigir e gravar de novo, o gatilho abre outra rodada. Não há seta que volta ao passo anterior (laços esbarram em `MAX_STEPS` e não combinam com tarefa pendente).
- Propriedades do bloco: aprovador (pessoa ou perfil), título da tarefa (aceita variáveis), prazo do lembrete (Etapa C), opção "solicitante pode aprovar o próprio pedido" (padrão: não).

Exemplo ("desconto acima de 20% precisa de aprovação"):

```
[Gatilho: ao inserir Pedido]
        ↓
[Se desconto > 20%]
   ├─ Não → (fim)
   └─ Sim → [Aguardar aprovação: perfil "Gerente"]
                 ├─ Aprovado  → [Atualizar Pedido: status = "Liberado"] → [E-mail ao solicitante]
                 └─ Rejeitado → [Atualizar Pedido: status = "Negado"]
                                   → [E-mail ao solicitante com {{aprovacao.comentario}}]
```

## 6.2 Não regressão do que existe hoje

Princípio: tudo é **aditivo**; fluxos sem o nó de aprovação seguem o mesmo caminho de código de hoje.
- `traverseGraph`: acrescenta um ramo para `approval`. **Cuidado conhecido:** hoje um nó de tipo desconhecido cai no ramo do gatilho e segue todas as saídas; por isso a **IDE (CLI) é publicada antes** do servidor/editor liberar o nó.
- `runReported`/`reportRun`: só acrescenta `details.waiting`; status e e-mail de erro não mudam.
- Varredor de prazo (Etapa C): entra como tarefa própria; **não toca** nos agendamentos dos fluxos.
- `actor.roles` (novo): `cleanActor` continua aceitando atores sem `roles`.
- Motor embutido nos apps ejetados (`gen:bpm`): o nó `approval` deve ser **ignorado com aviso claro** (não há tabelas de tarefa lá), nunca quebrar o fluxo.
- Testes a manter verdes: `bpmCore.test.ts`, `relayPolicy.test.ts`, `redTeam.test.ts`, `bpmExport.test.ts`, `e2eGenerate.test.ts`, suíte de i18n; e o roteiro `bpm-roteiro-testes.md` (itens de gatilhos, consulta, e-mail, agendamento) segue valendo sem mudança.

## 7. Prazo (Etapa C)

- Campo "lembrar após N horas" (e, opcional, "repetir a cada N horas", até um máximo).
- Um varredor no agendador do motor (já existe `scheduled`) procura `pending` com `due_at` vencido, reenvia o e-mail ao aprovador, atualiza `reminded_at`/`reminder_count` e grava histórico `reminded`.
- Sem escalonamento automático nesta versão.

## 8. Fora do plano / riscos

- **Ejeção (Node/Java):** a ejeção não leva a automação hoje (ver `docs/bpm-exportacao-desenho.md`); o recurso de aprovação também **não** será ejetado agora. Registrar isso na documentação do cliente.
- **Permissão de DDL:** como em `mb_help_feedback`, o usuário do banco do cliente pode não poder criar tabelas. Prever mensagem clara e script SQL para o DBA rodar (em `scripts/`), e modo "tabelas ausentes" tratado sem derrubar fluxos.
- **Oracle:** sintaxe própria (RAW/NUMBER/CLOB, `:n`, sem `IF NOT EXISTS`); cada consulta nova precisa de teste nos dois dialetos. Sem Oracle disponível aqui, a validação final é do dono.
- **E-mail de aviso:** depende do SMTP do projeto; sem ele, a tarefa existe mas o aviso falha (anotar `noteIssue`, sem perder a tarefa).
- **Volume:** limitar o tamanho do snapshot/`ctx` (mesma lógica de bytes do corpo do e-mail).

## 9. Ordem de trabalho e verificação

1. **A:** já existe (ver §1); nada a codar.
2. **B:** DDL PG/Oracle + testes de SQL → nó `approval` e pausa/retomada no `bpmCore` (testes unitários com o fake de banco já usado em `bpmCore.test.ts`) → ações do CLI e `relayPolicy` → rotas do servidor → Minhas tarefas → histórico no registro → editor → i18n.
3. **C:** campos de prazo → varredor → testes com relógio simulado.
4. A cada etapa: `npx tsc --noEmit`, `npm test`, `npm run gen:bpm`; ao final `npm run build`.
5. **Não testável por mim:** CLI real contra PostgreSQL/Oracle, e-mail real, navegador do aprovador, app ejetado. O roteiro de teste do dono vai em `docs/automacao-aprovacao-roteiro-teste.md` (a escrever junto da Etapa B).
6. Release: commit/push (sob pedido) → release da **IDE** primeiro → deploy do servidor.

## 10. Perguntas que ainda podem mudar o desenho (a decidir na implementação, com a sugestão)

- O solicitante pode **cancelar** o próprio pedido? Sugestão: sim, enquanto `pending`.
- A tarefa **bloqueia** o registro (impede edição) enquanto pendente? Sugestão: não nesta versão; só registra.
- Aprovador = quem solicitou: permitir? Sugestão: bloquear por padrão (aprovação de si mesmo), com opção no nó.

## 11. Estado da implementação (atualizado em 2026-11-27)

**Etapa A:** já existia (ver §1). **Etapa B: codada e commitada (ea04251c).** **Etapa C (prazo e lembrete): codada e verificada, sem commit.** Roteiro de testes: `docs/automacao-aprovacao-roteiro-teste.md`.

O que foi feito e onde:
- **Motor** (`cli/bpmCore.js`, embutido por `npm run gen:bpm`): nó `approval` (pausa em `requestApproval`, retomada em `decideApproval` pela saída `approved`/`rejected`), tabelas `mb_approval_tasks` e `mb_approval_history` (`approvalDdl`, PG e Oracle), listas, histórico, cancelamento, variáveis `{{aprovacao.decisao|comentario|por}}`. Ligado só no Agente (`ports.features.approvals`); no app exportado o nó para o fluxo com aviso. Fluxo "antes de salvar" recusa o nó.
- **Aprovadores:** reaproveita a escolha do e-mail (`emailGroupsUsers`): perfil inteiro (por **nome do grupo**) ou usuários (por id). Os perfis do ator vão assinados em `actor.roles` (`groupNamesForSession`).
- **Segurança:** as 5 ações `approval_*` são **só do servidor** (`SERVER_ONLY_ACTIONS` em `relayPolicy.ts`; mais estrito que o plano, que deixava duas para o desenvolvedor pelo relay). Rota `POST /api/v1/approvals` (`src/lib/approvals.ts`): sessão confere quem age; anônimo recusado; `admin_list`/`cancel` só membro; histórico só de tabela cadastrada e não fechada.
- **Telas:** `/{workspace}/{projeto}/approvals` ("Minhas tarefas", `ApprovalsClientView`), atalho no cabeçalho e botão "Histórico de aprovações" no registro, ambos só em app com bloco de aprovação em fluxo ativo (`projectHasApprovals`). Editor: bloco violeta com saídas Aprovado/Rejeitado e painel próprio.
- **Script do DBA:** `scripts/mb-approvals.sql` (gerado de `approvalDdl`); o erro de permissão também imprime o script no console do Agente.

Achados que mudam o que foi dito antes:
- **O motor do CLI só liga em PostgreSQL** (`cli/index.js`: `if (dbType === 'postgres')`). Em Oracle o DDL e o SQL existem e foram testados só como texto; na prática as aprovações só funcionam em PostgreSQL hoje.
- Como `help_feedback`, as ações não estão em `META_ACTIONS`: em projeto com **várias conexões**, o filtro de schema pode ignorar o comando e a tela dá tempo esgotado.
- **Sem testar:** CLI real contra banco, e-mail real, navegador (telas), Oracle, app ejetado.

### Etapa C (prazo e lembrete)

- O bloco ganhou **Lembrar após (horas)** e **Repetir a cada (horas)** (`approvalDueHours`, `approvalRepeatHours`). A tarefa guarda `due_at` (primeiro lembrete) e a repetição no `ctx`.
- Um varredor (`sweepApprovalReminders`) roda a cada 15 minutos, **só quando algum fluxo ativo tem o bloco** e o recurso está ligado (Agente). Tarefa pendente com `due_at` vencido recebe o e-mail "Lembrete: aprovação pendente" e o histórico ganha `reminded`; depois, `due_at` passa a agora + repetição, até **3 lembretes**; sem repetição, só 1.
- Dois agentes no mesmo banco mandam um lembrete só (gravação condicionada ao `due_at` e marca única; um teste pegou uma falha da primeira versão dessa conferência).
- Só avisa: **não escala** nem decide. Se todos os fluxos com o bloco forem removidos, tarefas pendentes antigas deixam de receber lembrete (o varredor não é agendado).
- `reminded_at` ficou mais largo no DDL (Oracle: 60) por causa da marca; `scripts/mb-approvals.sql` foi regenerado.

### Atualização: cancelamento pelo solicitante e contador (2026-11-27)

- **Cancelar:** quem pediu a aprovação cancela o próprio pedido enquanto estiver pendente (aba "Meus pedidos" de "Minhas tarefas"); o dono do projeto continua cancelando qualquer tarefa (aba "Todas"). O Agente confere: dono (id `member:...`, que só o servidor monta) ou `requested_by` igual ao ator. O fluxo não continua e o histórico registra `cancelled` com o nome de quem cancelou. Isto responde a pergunta aberta da seção 10 ("o solicitante pode cancelar?": sim).
- **Contador:** o atalho "Minhas tarefas" do cabeçalho mostra a quantidade a decidir (`list` com `countOnly`, tempo limite de 8 s). Só roda em app com o bloco de aprovação em fluxo ativo; atualiza ao abrir, ao voltar para a aba e a cada 2 minutos; falha (CLI desligado) só some com o número. Isto fecha o item "com contador de pendentes" da seção 6.
- Continuam fora: a lista de todas as tarefas **no Studio** (hoje é a aba "Todas" no app) e o registro de erro de execução quando o fluxo foi alterado depois do pedido (a decisão fica gravada e a tela avisa).
