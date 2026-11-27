# Automação de processos: reorganização por tabela (plano para 2026-11-28)

Status: combinado com o dono em 2026-11-27. **Implementado em 2026-11-28 (as três fases), verificado (tsc, 2116 testes, build), ainda sem teste do dono no navegador.** Roteiro: `docs/automacao-reorganizacao-roteiro-teste.md`.

## O que foi feito (2026-11-28)

- **Fase 1:** item "Automação de processos" injetado na hora no menu e no dashboard (`src/lib/automationsMenu.ts`, usado em `[project_slug]/layout.tsx` e `dashboard/[[...folder_id]]/page.tsx`), primeiro item, só com o módulo ativo e a permissão (`automationsAccess`). Nada é gravado no menu do projeto, então vale para todos os projetos já.
- **Fase 2:** `/automations` agora tem painel de escolha (`AutomationsHub`: Geral, tabelas com contagem, todos os fluxos com busca) e editor por escopo (`?table=<id>` ou `?scope=general`, `&flow=<id>` abre um fluxo). Classificação em `src/lib/bpm/flowScope.ts` (tem tabela alvo = da tabela; sem = Geral; vale para publicado e rascunho). Em tabela o gatilho nasce com a tabela travada; em Geral só agendado e webhook. O editor **não exige mais caso de uso** para salvar (`use_case_id` fica nulo nos fluxos novos). Evento **"Botão (ação customizada)"** marcável; a lista de botões mostra só os casos de uso da tabela do fluxo (mais os que já ligam o fluxo, com aviso "de outra tabela"); fluxo já ligado a botão aparece marcado.
- **Fase 3:** botão "Automações" removido do cabeçalho dos casos de uso (prop `isAutomationsEnabled` mantida opcional e sem efeito, por causa do app exportado). O cadastro do botão de ação mostra primeiro os fluxos da tabela do caso de uso e tem o atalho "Abrir os fluxos desta tabela" (abre o editor na tabela certa). Endereço antigo `/automations?use_case=<id>` redireciona para a tabela do caso de uso.
- **SQL a rodar pelo dono:** `scripts/bpm-workflows-use-case-set-null.sql` (a chave `fk_bpm_workflows_use_case` era `ON DELETE CASCADE`: apagar um caso de uso apagava os fluxos da tabela; passa a `SET NULL`).
- **Sem mudança de motor, protocolo ou CLI:** não precisa de release da IDE.
- **Ainda pendente (decisões do dono):** o nome "Geral"; se um fluxo pode misturar botão e evento de tabela (hoje pode); e o "só o primeiro gatilho" dos fluxos de botão (não mexido).

## Decisões já tomadas

- **Fluxo é da tabela, não do caso de uso.** O motor dispara pelo par (tabela, evento) e o servidor entrega ao CLI todos os fluxos ativos do projeto, sem olhar o caso de uso. Dois casos de uso sobre a mesma tabela disparam os mesmos fluxos. O que existe de caso de uso em `bpm_workflows.use_case_id` só organiza a lista no editor.
- **NÃO vamos implementar agora** a opção "só neste caso de uso" (escopo por caso de uso). O dono pode voltar a ela. Se voltar: padrão continua "para a tabela"; não é trava de segurança (o caso de uso viria do navegador); regras que protegem dados ficam na tabela; app ejetado manteria "para a tabela"; IDE primeiro, servidor depois. Antes, verificar o ponto central onde o app publicado monta os comandos de gravar e excluir.
- **Nome:** "Automação de processos" (menu do site, Studio e matriz de permissões já usam). O dono escreveu "Automações de Processo"; ficou o nome do menu para manter um só.

## O que o dono quer (a fazer)

1. **Card no dashboard do app publicado** para "Automação de processos", **em primeiro lugar**, como a Central de Downloads, só para quem tem a permissão (regra única em `src/lib/automationsAccess.ts`, negado por padrão).
   - Hoje o card do Downloads existe porque ele é um **item do menu** do projeto (`MenuBuilder.tsx` acrescenta `target: 'downloads'` em `project.navigation`; o dashboard monta os cards do menu). Automações não é item de menu, só tem a linha de permissão (`ui_views` slug `automations`, `view_type: 'system'`).
   - Precisa: entrada no menu (como o Downloads), filtro no layout que tire o item de quem não tem permissão (hoje `filterNavigation` libera por padrão; Automações é negado por padrão) e ordem "primeiro".
2. **Tirar o botão "Automações" de dentro de cada caso de uso** (`ViewPageHeader.tsx`, `isAutomationsEnabled` em `[view_slug]/page.tsx`), depois que a nova entrada existir. Manter `/automations?use_case=...` funcionando por um tempo (links, tutoriais, ajuda).
3. **Painel de escolha ao abrir a Automação de processos:** "Geral" (agendado e webhook, sem tabela; o motor já roda esses com a tabela `global`) ou uma **tabela** (com a quantidade de fluxos), mais "Ver todos" com busca por nome. Escolhido o escopo, abre o editor atual mostrando só os fluxos dele. Em tabela, o fluxo novo nasce com a **tabela alvo preenchida e travada**; em Geral, o painel do gatilho oferece só agendado e webhook.
   - Regra de classificação: tem tabela alvo = é da tabela; não tem = Geral. Fluxo com gatilhos de duas tabelas aparece nas duas listas.
   - "Geral" é o nome proposto; alternativa: "Sem tabela (agenda e webhook)". **Pendente: o dono confirmar.**
4. Fluxos antigos: **nenhuma mudança de comportamento**; só muda como se encontram (a nova lista não filtra por `use_case_id`).

## Fases (cada uma independente)

1. Card no dashboard + entrada no menu + filtro de permissão (pequena).
2. Painel de escolha (Geral e tabelas) + editor por escopo (a maior).
3. Remover o botão dos casos de uso e atualizar ajuda e tutoriais que o citam (`data-help-id`, catálogo da ajuda da plataforma, e2e).

## Fluxos de botão (ações customizadas): como ficam

O que existe hoje (lido no código):
- O botão mora em **um caso de uso** (`ui_views.layout_config.custom_actions[]`, com `linked_bpm_workflows: [ids]`) e o clique manda `trigger_bpm` com a **tabela da tela do botão**.
- O motor (`processCustomAction`) roda o fluxo **com a tabela do botão**, não com a tabela alvo do gatilho do fluxo, e usa só o **primeiro nó de gatilho**. O contrato é implícito: o fluxo deve ter como tabela alvo a mesma tabela da tela do botão, senão `{{tabela.campo}}` não resolve.
- No painel do gatilho, "Ações customizadas acionadoras" aparece sempre e lista **os botões de todos os casos de uso**, agrupados por caso de uso. O tipo `manual` existe no desenho do nó ("Por botão"), mas **não** é uma opção marcável na lista de eventos.

Proposta:
- O **botão continua sendo por caso de uso** (é onde ele realmente mora: dois casos de uso da mesma tabela têm botões diferentes). O **fluxo** é listado na **tabela** do caso de uso dono do botão.
- No painel do gatilho, a lista de botões passa a mostrar **só os casos de uso da tabela alvo** do fluxo (hoje mostra todos), o que elimina o vínculo com tabela errada. Em "Geral" a seção some (botão sempre tem tabela).
- Tornar **"Botão (ação customizada)" um evento marcável** na lista de eventos (hoje só existe como ícone). A lista de botões aparece só com ele marcado. Fluxos já ligados a botões aparecem marcados sem mudar o comportamento (o vínculo é lido de `linked_bpm_workflows`).
- Opcional: avisar no editor quando o fluxo está ligado a um botão de uma tabela diferente da tabela alvo.
- **Pendente:** decidir se um fluxo pode misturar botão e evento de tabela (hoje pode; manter) e se corrigimos o "só o primeiro gatilho" no mesmo passo.

## Decisão (2026-11-27, noite): opção A para os fluxos de botão

- **A nova tela tem só Geral e Tabelas.** Não há nível "Casos de uso" (a opção de acrescentá-lo foi descartada: reintroduz a ideia de que o fluxo pertence a um caso de uso).
- **O botão do cabeçalho "Automações" dos casos de uso sai** (fase 3). Motivo concreto: "Pedidos - Timeline" abria o editor com a lista de fluxos vazia, embora os fluxos da tabela `pedidos` rodem nessa tela do mesmo jeito.
- **Fluxo de botão:** ao marcar o evento "Botão (ação customizada)", o painel lista os botões **das telas da tabela do fluxo**, agrupados pelo nome do caso de uso (Pedidos, Pedidos - Timeline...). O caso de uso é um detalhe da escolha, não o lugar onde o fluxo mora.
- **Atalho no cadastro do botão** ("Criar ou editar fluxo deste botão"): abre a tela nova já na tabela certa, com o botão marcado. **Antes de prometer, verificar no código do cadastro de botões** (`ActionModalTriggerTab.tsx` e passos de ações do construtor de casos de uso) onde ele encaixa.
- **Condição para a fase 3:** só remover o botão do cabeçalho depois que esse atalho existir, para o analista que acaba de criar um botão não ficar sem caminho até o fluxo.
- Rejeitada a opção B (manter o botão como "Automações da tabela X"); pode voltar se o atalho do cadastro do botão não bastar.
