# Automação de processos por tabela: roteiro de testes (28/11/2026)

Testa a reorganização: card no dashboard, painel **Geral / tabelas**, editor por escopo, evento **Botão** e a saída do botão "Automações" dos casos de uso.
Marque cada item e me mande o que falhar, com a tela. **Não muda protocolo do CLI nem o motor**: dá para testar só com o deploy novo (sem release de IDE).

## O que já foi verificado por mim (sem navegador seu)

- `tsc`, `npm test` (2125 testes) e `npm run build` limpos.
- Classificação dos fluxos: pela regra "tem tabela alvo e algum evento de tabela ou botão = é da tabela; senão = Geral" (agendado e webhook nunca usam a tabela), os seus 10 fluxos reais ficam assim: **7 em `pedidos`** (Aviso Pedido Enviado, Confirmação de Pedido, Edição de Entregue, Exclusão de enviado, Exclusão de Pedido, Negar - Novo - Cancelado, Novo - Status Pendente) e **3 em Geral** (Agendaddo, Pedidos Aprovados, webhook).
- Item de menu injetado (primeiro, só com permissão, nunca duplicado), leitura do escopo da URL (só aceita id de tabela bem formado) e montagem dos endereços, com testes.

## O que **não** foi testado

As telas no navegador (card, painel, editor, cadastro do botão), o clique real nos botões ligados a fluxos e o app exportado (não muda nada nele).

## Preparação

1. Rode o script **`scripts/bpm-workflows-use-case-set-null.sql`** no SQL Editor do Supabase da plataforma (muda a regra de exclusão: apagar um caso de uso deixa de apagar os fluxos). Opcional para os testes, mas recomendado.
2. Entre no app publicado como **Administrador** (permissão de "Automação de processos" ligada) e, em outra janela, como **Gerente** (desligada).

## Parte 1: card e menu

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 1.1 | Como Administrador, abrir o dashboard do app | O **primeiro card** é "Automação de processos"; a Central de Downloads vem depois | ☐ |
| 1.2 | Olhar o menu lateral | "Automação de processos" é o **primeiro item** | ☐ |
| 1.3 | Clicar no card | Abre o **painel de escolha** (não o editor) | ☐ |
| 1.4 | Como Gerente (sem a permissão), abrir dashboard e menu | **Não** aparece o card nem o item | ☐ |
| 1.5 | Como Gerente, digitar a URL `/{workspace}/{projeto}/automations` | "Acesso negado", sem dados do projeto | ☐ |
| 1.6 | Trocar o idioma (PT/EN/ES) | O nome do card muda: Automação de processos / Process Automation / Automatización de procesos | ☐ |
| 1.7 | Desligar o módulo de Automações no Studio | O card e o item **somem** para todos | ☐ |
| 1.8 | Como **dono do projeto** (login do MetaBuilder), abrir "Automações" pelo **Studio** (o card de Automação de processos do Studio, que abre a visualização) | Abre o **painel de escolha** normalmente, mesmo sem ser um usuário do app com a permissão ligada | ☐ |

## Parte 2: painel de escolha

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 2.1 | Abrir o painel | Mostra **Geral (sem tabela)** com 3 fluxos e as tabelas, **pedidos com 7**; as demais com 0 | ☐ |
| 2.2 | Em **Por tabela**, digitar "ped" no campo de busca da seção | Filtra só as tabelas, na hora (sem acento e sem diferenciar maiúsculas) | ☐ |
| 2.3 | Em **Por tabela**, clicar nos 4 ícones de ordem (A-Z, Z-A, mais fluxos primeiro, menos fluxos primeiro) | A ordem muda a cada clique; em quantidade, o empate fica em A-Z; o ícone ativo fica destacado | ☐ |
| 2.3a | Em **Todos os fluxos**, conferir os dois grupos | **Geral (sem tabela) (3)** e **Por tabela (7)**, cada um com a seta de expandir/recolher; cada linha mostra o nome, a tabela (só em Por tabela) e a situação (Publicado / Alterações não publicadas / Rascunho) | ☐ |
| 2.3b | Recolher e expandir cada grupo | A lista some e volta; os ícones de ordem do grupo só aparecem com ele aberto | ☐ |
| 2.3c | Em **Geral**, trocar A-Z e Z-A | Ordena os 3 fluxos pelo nome | ☐ |
| 2.3d | Em **Por tabela**, alternar "Tabela e nome" e "Só nome", e A-Z / Z-A | "Tabela e nome" ordena pela tabela e depois pelo nome; "Só nome" ignora a tabela | ☐ |
| 2.3e | No campo de busca de **Todos os fluxos**, digitar parte do nome de um fluxo e depois o nome de uma tabela | Filtra na hora pelos dois; um grupo sem resultado some e os que têm resultado ficam abertos mesmo se estavam recolhidos | ☐ |
| 2.4 | Clicar em um fluxo da lista | Abre o editor **já nesse fluxo**, no escopo certo | ☐ |
| 2.5 | Clicar em "Voltar ao início" | Volta ao dashboard | ☐ |

## Parte 3: editor por escopo

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 3.1 | Escolher a tabela **pedidos** | O título é "AUTOMAÇÕES: Pedidos"; a lista de fluxos tem só os **7** | ☐ |
| 3.2 | Escolher **Geral** | Título "AUTOMAÇÕES: Geral"; lista com os 3 fluxos | ☐ |
| 3.3 | Em pedidos, criar um fluxo novo e abrir o gatilho | A **tabela alvo já vem preenchida e travada** (cinza, com a dica) | ☐ |
| 3.4 | Salvar o rascunho e publicar | Funciona **sem** caso de uso; o fluxo aparece na lista de pedidos e o CLI recarrega | ☐ |
| 3.5 | Em Geral, criar um fluxo novo e abrir o gatilho | Só **Agendado** e **Webhook** na lista de eventos; sem campo de tabela | ☐ |
| 3.5a | Em uma tabela (ex.: pedidos), criar um fluxo novo e abrir o gatilho | **Não** aparecem Agendado nem Webhook (eles não usam a tabela): só os eventos de tabela e o Botão; a tabela alvo vem travada | ☐ |
| 3.6 | Em Geral, publicar um fluxo agendado | Funciona; ele aparece em "Geral" no painel | ☐ |
| 3.7 | Abrir "Exclusão de enviado" (pedidos) | Continua igual (gatilho "Antes de Excluir", tabela pedidos), e **continua bloqueando** a exclusão no app como antes | ☐ |
| 3.8 | Botão de voltar do editor | Volta ao **painel de escolha** | ☐ |

## Parte 4: evento Botão

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 4.1 | Em pedidos, abrir um gatilho e olhar a lista de eventos | Há o evento **"Botão (ação customizada)"** | ☐ |
| 4.2 | Marcar "Botão" | Aparece a lista de botões, **só dos casos de uso da tabela pedidos** (Pedidos, Pedidos - Timeline...), agrupados por caso de uso | ☐ |
| 4.3 | Ligar o fluxo a um botão e salvar | Clicar no botão no app dispara o fluxo (como antes) | ☐ |
| 4.4 | Reabrir um fluxo **que já estava ligado a um botão antes** desta mudança | O evento "Botão" aparece **marcado** e não dá para desmarcar enquanto houver botão ligado | ☐ |
| 4.5 | Desvincular os botões do fluxo | O "Botão" pode ser desmarcado | ☐ |
| 4.6 | Um fluxo ligado a botão de **outra tabela** | O caso de uso aparece com o aviso "de outra tabela" (nada some em silêncio) | ☐ |
| 4.7 | Em **Geral** | A seção de botões **não** aparece | ☐ |

## Parte 5: casos de uso

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 5.1 | Abrir um caso de uso (Pedidos, Pedidos - Timeline) como Administrador | O botão **"Automações" não existe mais** no cabeçalho | ☐ |
| 5.2 | No Studio, editar um botão de ação e abrir a aba de automação | Mostra primeiro os fluxos **da tabela do caso de uso**; os de outras tabelas/gerais ficam em um segundo grupo | ☐ |
| 5.3 | Clicar em "Abrir os fluxos desta tabela" | Abre o editor **na tabela certa**, em outra aba | ☐ |
| 5.4 | Criar o fluxo lá, voltar ao cadastro do botão, reabrir a aba | O fluxo novo aparece na lista para marcar | ☐ |
| 5.5 | Abrir o endereço antigo `/automations?use_case=<id de um caso de uso de pedidos>` (link salvo, favorito) | Redireciona para o editor da **tabela pedidos** | ☐ |
| 5.6 | Excluir um caso de uso de teste (depois do script SQL) | Os fluxos da tabela **continuam** no painel | ☐ |

## Parte 6: nada mudou no comportamento

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 6.1 | Criar, editar e excluir pedidos nas **duas** telas (Pedidos e Pedidos - Timeline) | Os mesmos fluxos disparam nas duas (o fluxo é da tabela) | ☐ |
| 6.2 | Rodar os itens de gatilhos, consulta, e-mail e agendamento de `bpm-roteiro-testes.md` | Continuam como estavam | ☐ |
| 6.3 | Rodar o roteiro `automacao-aprovacao-roteiro-teste.md` | Continua valendo (o bloco de aprovação está nos fluxos de tabela) | ☐ |
