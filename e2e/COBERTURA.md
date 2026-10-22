# Cobertura: testes atuais × motor de testes dinâmico

Atualizado em 2026-10-22 depois da bateria nos 4 apps sincronizados pela IDE (Postgres e Oracle × Node e Java). São **122 testes** escritos à mão: 64 em `real/` (Postgres + Node), 35 em `oracle/` e 23 em `tests/` (projeto de exemplo).

**Regra para apagar:** um teste antigo só sai quando o motor dinâmico cobre o mesmo comportamento *e* a regra nova já rodou verde nos projetos de referência (Vendas PG e Vendas ORA). A pasta `e2e` (travas do banco, robôs de login, impressão digital das linhas, executor) é a base do motor e não é apagada. Os testes unitários do gerador (`src/lib/generator/__tests__`) também ficam: testam o gerador, não o app.

## Resultado da bateria de 2026-10-22 (com as regras novas)

Apps sincronizados pela IDE em `~\AGTech\MetaBuilderPRO`: `vendas-pg-node`, `vendas-pg-java`, `vendas-ora-node` e `vendas-ora-java`. Tipos rodados: funcional, integração e segurança (178 testes por app, de 16 telas do manifesto).

| App | Banco | Resultado |
|---|---|---|
| vendas-pg-node | Postgres (cópia `crm_copy`) | 178 de 178 passaram, banco intacto |
| vendas-pg-java | Postgres (cópia `crm_copy`) | 178 de 178 passaram, banco intacto |
| vendas-ora-node | Oracle `crm@192.168.0.201/FREEPDB1` (modo original, com consentimento) | 178 de 178 passaram, banco intacto (depois de sincronizar de novo com a correção do gerador) |
| vendas-ora-java | Oracle `crm@192.168.0.201/FREEPDB1` (modo original, com consentimento) | 178 de 178 passaram, banco intacto (depois de sincronizar de novo com a correção do gerador) |

Na primeira rodada do Oracle houve 6 falhas por app, todas resolvidas:

- **2 eram do motor** (fórmulas: o nome da tabela vem em maiúsculas no Oracle). Corrigido no motor.
- **4 eram um erro real do gerador, achado pelas regras novas:** na edição de Tarefas (Kanban e Fluxo) de um app Oracle, a lista da "Tarefa Antecessora" saía vazia (a relação de uma coluna com a própria tabela era descartada porque `TAREFA_ANTECESSORA_ID` está em maiúsculas), e salvar a edição apagava a tarefa antecessora. Corrigido em `detail-page.ts`, com teste (`detailSelfRelation.test.ts`, que falha sem a correção). Confirmado: depois de sincronizar de novo os dois apps Oracle, a bateria passou inteira.

## Arquivos antigos removidos (2026-10-22)

Com a bateria verde nos 4 apps, foram removidos os 18 arquivos que estavam 100% cobertos (continuam no histórico do Git):
`real/tests`: clientes-pedidos-itens, departamentos-funcs, exportar-e-grid, gestao-de-acesso, permissoes-por-tela, agenda-gantt-kanban, aba-do-cliente.
`oracle/tests`: clientes, departamentos-funcs, exportar-e-grid, permissoes-por-tela, pedidos-e-bi, gestao-de-acesso.
`tests` (exemplo): export, tipos-de-campo, cadastro, grid, relacoes.
Ficam os arquivos que ainda têm algo que o dinâmico não afirma (telas de IA, rede de proteção, login do robô, autocomplete e os testes de itens do pedido que dependem de um campo autocomplete): `itens-do-pedido`, `cadastros-gerais`, `telas-especiais`, `smoke` (real e oracle), `rede-de-protecao` (real e oracle) e `autocomplete`. Nesses arquivos os testes já cobertos pelo dinâmico continuam lá; podem ser podados depois, um a um.

Ressalvas: o manifesto de telas usado é o de 20/10 (o do site exige login), acrescido das listas de relação e das fórmulas lidas do próprio app sincronizado, porque as credenciais do Studio não estão nesta máquina; o painel da IDE gera esses campos sozinho. Nenhum projeto de referência tem campo Autocomplete, então a regra de autocomplete não foi escrita (não entrego teste sem validar).

## Resumo

| Situação | Testes | O que significa |
|---|---|---|
| **Coberto** | 114 | o dinâmico afirma o mesmo comportamento e passou em Postgres e Oracle (Node e Java). Os arquivos inteiramente cobertos já foram removidos (seção acima) |
| **Parcial** | 0 | cobre a maior parte, mas falta um detalhe que o teste antigo afirmava: fica |
| **Falta** | 2 | sem regra equivalente no dinâmico: fica |
| **Fica à mão** | 6 | é o motor (login, rede de proteção) ou tela criada por IA com código próprio |

Hoje o motor cobre **114 de 122 (93%)** por completo.

### O que ainda falta

- **Autocomplete** (2 testes antigos): nenhum projeto de referência tem campo Autocomplete; a regra entra quando houver um projeto para validar.
- **Fica à mão**: tela de IA (código próprio), rede de proteção do banco e login do robô.

## Lista completa (um teste por linha)

### Já coberto pelo motor dinâmico (53)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | clientes-pedidos-itens.spec.ts | edição e exclusão só do cliente criado pelo teste | edição: alterar e salvar; exclusão: excluir pela lista |
| Coberto | real | clientes-pedidos-itens.spec.ts | regra por linha com exceção: Administrador (na lista de exceção) vê clientes de outras pessoas; Funcionária não | regra por linha: quem não é da exceção só vê as linhas que a regra permite |
| Coberto | real | departamentos-funcs.spec.ts | criar, editar e excluir um departamento (auditoria do robô gravada) | cadastro, edição e exclusão (inclui criado_por) |
| Coberto | real | departamentos-funcs.spec.ts | nome é obrigatório: salvar vazio não cria registro | obrigatórios: salvar o formulário vazio não cria registro |
| Coberto | real | departamentos-funcs.spec.ts | criar func com departamento, editar o cargo e excluir | cadastro com relação, edição e exclusão |
| Coberto | real | departamentos-funcs.spec.ts | campos obrigatórios (nome, e-mail, cargo, data): salvar vazio não cria registro | obrigatórios: salvar o formulário vazio não cria registro |
| Coberto | real | exportar-e-grid.spec.ts | CSV e JSON trazem só o que está filtrado na tela, com as colunas da grid | exportação: só o que está filtrado na tela (CSV, JSON) |
| Coberto | real | exportar-e-grid.spec.ts | com linhas marcadas, exporta só elas; marcar todas e desmarcar | exportação: só as linhas marcadas (inclui marcar todas pelo cabeçalho e desmarcar) |
| Coberto | real | exportar-e-grid.spec.ts | Central de Downloads lista a exportação, baixa o arquivo e exclui | Central de Downloads: lista, baixa e exclui o arquivo |
| Coberto | real | exportar-e-grid.spec.ts | paginação: 12 clientes com 10 por página (2 páginas), total e página 2 | grid: a paginação respeita o tamanho de página |
| Coberto | real | exportar-e-grid.spec.ts | ordenação por coluna: crescente e decrescente pelo cabeçalho | grid: ordenar nos dois sentidos |
| Coberto | real | exportar-e-grid.spec.ts | filtro de Status Lead e botão Limpar | filtro por texto e por opção, com Limpar |
| Coberto | real | exportar-e-grid.spec.ts | Visualizar abre o formulário só para leitura e Cancelar volta sem gravar | Visualizar: só leitura, sem botão de gravar |
| Coberto | real | gestao-de-acesso.spec.ts | a lista mostra os usuários com o grupo que está no banco | Gestão de acesso (8 testes por app) |
| Coberto | real | gestao-de-acesso.spec.ts | criar usuário com grupo, entrar com ele, trocar de grupo, redefinir a senha e excluir | Gestão de acesso (8 testes por app) |
| Coberto | real | gestao-de-acesso.spec.ts | e-mail repetido: o erro aparece na janela e nada é criado | Gestão de acesso (8 testes por app) |
| Coberto | real | gestao-de-acesso.spec.ts | criar, renomear e excluir um grupo | Gestão de acesso (8 testes por app) |
| Coberto | real | gestao-de-acesso.spec.ts | a matriz mostra o nível de cada tela para o grupo de teste (Clientes leitura, Departamentos nenhum) | Gestão de acesso (8 testes por app) |
| Coberto | real | gestao-de-acesso.spec.ts | mudar a permissão do grupo de teste vale no próximo login e pode ser desfeita | Gestão de acesso (8 testes por app) |
| Coberto | real | gestao-de-acesso.spec.ts | as telas de gestão de acesso são só do Administrador (a Funcionária não entra) | Gestão de acesso (8 testes por app) |
| Coberto | real | itens-do-pedido.spec.ts | Funcionária não enxerga o cliente criado pelo robô Administrador (regra por linha) | regra por linha: quem não é da exceção só vê as linhas que a regra permite |
| Coberto | real | permissoes-por-tela.spec.ts | tela bloqueada some do menu e não abre pelo endereço | acesso "nenhum" e "leitura" ao grupo, com login do grupo de teste |
| Coberto | real | permissoes-por-tela.spec.ts | tela só de leitura: abre e mostra os dados, mas não deixa criar, editar nem excluir | acesso "nenhum" e "leitura" ao grupo, com login do grupo de teste |
| Coberto | real | smoke.spec.ts | todas as telas do menu abrem sem erro | a tela abre sem erro (um teste por tela) |
| Coberto | real | telas-especiais.spec.ts | Produtos (galeria): um cartão por produto e filtro por categoria | galeria: um cartão por registro e filtro de lista (categoria) confere com o banco |
| Coberto | real | telas-especiais.spec.ts | Kanban de tarefas: cartões com ações e filtros por projeto e responsável | kanban: soma dos cartões, ação Editar nos cartões e filtro de lista (projeto) confere com o banco |
| Coberto | real | telas-especiais.spec.ts | Tarefas - Fluxo (fluxograma): mostra o diagrama e o total de etapas igual ao banco | fluxo: diagrama e total de etapas |
| Coberto | real | telas-especiais.spec.ts | Pedidos - Timeline: tela com os filtros (sem nome de campo: pela ordem Cliente, Funcionário), tamanhos e atualização de dados | timeline: abre, atualiza e filtrar por uma lista não dá erro (o antigo "tamanhos" nunca foi afirmado) |
| Coberto | real | telas-especiais.spec.ts | Projetos (gantt): filtros, botão Hoje e ação Tarefas da linha | gantt: botão Hoje, tamanhos e ações das linhas |
| Coberto | real | telas-especiais.spec.ts | Entregas (agenda): mês atual, troca entre Mês, Semana e Dia | agenda: mês, semana e dia |
| Coberto | real | telas-especiais.spec.ts | Empresa (mapa mental): um item por departamento | mapa mental: total igual ao banco |
| Coberto | real | telas-especiais.spec.ts | Clientes - Geospatial (mapa): total de registros e quantos têm coordenadas, iguais ao banco | mapa: total com coordenadas igual ao banco |
| Coberto | real | telas-especiais.spec.ts | BI /bi---pedidos: painel abre, atualiza e tem tabela de dados | BI: o painel abre, atualiza e mostra dados |
| Coberto | real | telas-especiais.spec.ts | BI /bi---laboratorio: painel abre, atualiza e tem tabela de dados | BI: o painel abre, atualiza e mostra dados |
| Coberto | oracle | clientes.spec.ts | nome da empresa é obrigatório: salvar vazio não cria registro | obrigatórios: salvar o formulário vazio não cria registro |
| Coberto | oracle | clientes.spec.ts | edição e exclusão só do cliente criado pelo teste | edição: alterar e salvar; exclusão: excluir pela lista |
| Coberto | oracle | departamentos-funcs.spec.ts | criar, editar e excluir um departamento (auditoria do robô gravada) | cadastro, edição e exclusão (inclui criado_por) |
| Coberto | oracle | departamentos-funcs.spec.ts | nome é obrigatório: salvar vazio não cria registro | obrigatórios: salvar o formulário vazio não cria registro |
| Coberto | oracle | departamentos-funcs.spec.ts | criar func com departamento, editar o cargo e excluir | cadastro com relação, edição e exclusão |
| Coberto | oracle | departamentos-funcs.spec.ts | campos obrigatórios (nome, e-mail, cargo, data): salvar vazio não cria registro | obrigatórios: salvar o formulário vazio não cria registro |
| Coberto | oracle | exportar-e-grid.spec.ts | CSV e JSON trazem só o que está filtrado na tela, com as colunas da grid | exportação: só o que está filtrado na tela (CSV, JSON) |
| Coberto | oracle | exportar-e-grid.spec.ts | com linhas marcadas, exporta só elas; marcar todas e desmarcar | exportação: só as linhas marcadas (inclui marcar todas pelo cabeçalho e desmarcar) |
| Coberto | oracle | exportar-e-grid.spec.ts | Central de Downloads lista a exportação, baixa o arquivo e exclui | Central de Downloads: lista, baixa e exclui o arquivo |
| Coberto | oracle | exportar-e-grid.spec.ts | paginação: 12 clientes com 10 por página (2 páginas), total e página 2 | grid: a paginação respeita o tamanho de página |
| Coberto | oracle | exportar-e-grid.spec.ts | ordenação por coluna: crescente e decrescente pelo cabeçalho | grid: ordenar nos dois sentidos |
| Coberto | oracle | exportar-e-grid.spec.ts | filtro de Status Lead e botão Limpar | filtro por texto e por opção, com Limpar |
| Coberto | oracle | exportar-e-grid.spec.ts | Visualizar abre o formulário só para leitura e Cancelar volta sem gravar | Visualizar: só leitura, sem botão de gravar |
| Coberto | oracle | permissoes-por-tela.spec.ts | tela bloqueada some do menu e não abre pelo endereço | acesso "nenhum" e "leitura" ao grupo, com login do grupo de teste |
| Coberto | oracle | permissoes-por-tela.spec.ts | tela só de leitura: abre e mostra os dados, mas não deixa criar, editar nem excluir | acesso "nenhum" e "leitura" ao grupo, com login do grupo de teste |
| Coberto | oracle | smoke.spec.ts | todas as telas do menu abrem sem erro | a tela abre sem erro (um teste por tela) |
| Coberto | fixture | export.spec.ts | CSV traz todos os 30 clientes (com BOM e ;) | exportação CSV: uma linha por registro |
| Coberto | fixture | export.spec.ts | Excel é um arquivo .xlsx válido | exportação Excel: arquivo .xlsx válido |
| Coberto | fixture | tipos-de-campo.spec.ts | máscara de CNPJ formata ao digitar | máscara formata o que se digita |

### Autoteste do motor (2)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Fica à mão | real | smoke.spec.ts | login do robô funciona e a senha errada é recusada | Autoteste do motor: o motor confere o login antes de qualquer teste (senha errada recusada não é repetida pelo dinâmico) |
| Fica à mão | oracle | smoke.spec.ts | login do robô funciona e a senha errada é recusada | Autoteste do motor: o motor confere o login antes de qualquer teste (senha errada recusada não é repetida pelo dinâmico) |

### Cadastro, edição e exclusão (4)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | cadastros-gerais.spec.ts | Pedidos (lista): criar para um cliente, editar o status e excluir | cadastro, edição e exclusão com dados gerados |
| Coberto | oracle | clientes.spec.ts | cadastrar um cliente: grava os dados e a auditoria do robô (criado_por) | cadastro: preencher e salvar grava tudo (inclui criado_por) |
| Coberto | oracle | pedidos-e-bi.spec.ts | Pedidos (lista): criar para um cliente, editar o status e excluir | cadastro, edição e exclusão com dados gerados |
| Coberto | fixture | cadastro.spec.ts | cria um cliente, ele aparece na lista e pode ser excluído | cadastro, edição e exclusão com dados gerados |

### Tipos de campo e opções (10)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | departamentos-funcs.spec.ts | a lista de departamentos do formulário traz os departamentos existentes | formulário: as listas de relação trazem as linhas da tabela relacionada (conferido contra o banco) |
| Falta | real | itens-do-pedido.spec.ts | textos da busca de produto iguais aos da plataforma (linha da aba e janela) | sem projeto de referência com campo Autocomplete (o produto virou lista): regra não escrita para não entregar teste sem validar |
| Coberto | real | itens-do-pedido.spec.ts | Data Pedido (tipo "date" no Studio) mostra só a data, como na plataforma | formulário: cada campo usa o componente configurado (data) |
| Coberto | oracle | departamentos-funcs.spec.ts | a lista de departamentos do formulário traz os departamentos existentes | formulário: as listas de relação trazem as linhas da tabela relacionada (conferido contra o banco) |
| Falta | fixture | autocomplete.spec.ts | autocomplete do produto busca no servidor, escolhe e grava | sem projeto de referência com campo Autocomplete: regra não escrita para não entregar teste sem validar |
| Coberto | fixture | tipos-de-campo.spec.ts | edição mostra o que está no banco em cada tipo (Cliente 02) | cadastro: reabrir mostra o que foi gravado |
| Coberto | fixture | tipos-de-campo.spec.ts | cliente sem marca de ativo abre desmarcado (Cliente 01) | booleano: desmarcar e salvar grava falso e o registro reabre desmarcado |
| Coberto | fixture | tipos-de-campo.spec.ts | opções fixas e relação oferecem as opções certas | formulário: as listas de relação trazem as linhas da tabela relacionada (conferido contra o banco) |
| Coberto | fixture | tipos-de-campo.spec.ts | cria com todos os tipos, grava no banco e reabre igual | cadastro: reabrir mostra o que foi gravado |
| Coberto | fixture | tipos-de-campo.spec.ts | desmarcar o booleano e salvar a edição grava falso | booleano: desmarcar e salvar grava falso e o registro reabre desmarcado |

### Grid e filtros (6)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | telas-especiais.spec.ts | Pedidos (lista): o Administrador vê todos os pedidos (total igual ao banco) e a ação Produtos da linha | grid: total igual ao banco; ações da linha |
| Coberto | oracle | pedidos-e-bi.spec.ts | Pedidos (lista): o total mostrado é igual ao do banco | grid: total igual ao do banco |
| Coberto | fixture | grid.spec.ts | mostra a primeira página com o tamanho configurado no Studio e o total | grid: a paginação respeita o tamanho de página |
| Coberto | fixture | grid.spec.ts | paginação leva às 5 linhas restantes | grid: a paginação respeita o tamanho de página |
| Coberto | fixture | grid.spec.ts | filtro por nome encontra só o cliente | filtro por texto e por opção, com Limpar |
| Coberto | fixture | grid.spec.ts | botões do topo na ordem da plataforma: Exportar antes de Novo Registro | botões: Exportar antes de Novo Registro; Visualizar, Editar e Excluir nessa ordem |

### Exportação de dados (5)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | exportar-e-grid.spec.ts | Excel (.xlsx) é um arquivo válido | exportação Excel: arquivo .xlsx válido |
| Coberto | oracle | exportar-e-grid.spec.ts | Excel (.xlsx) é um arquivo válido | exportação Excel: arquivo .xlsx válido |
| Coberto | fixture | export.spec.ts | com linhas marcadas exporta só elas | exportação: só as linhas marcadas |
| Coberto | fixture | export.spec.ts | marcar todas pelo cabeçalho e desmarcar | exportação: só as linhas marcadas (inclui marcar todas pelo cabeçalho e desmarcar) |
| Coberto | fixture | export.spec.ts | Central de Downloads lista as exportações, baixa e exclui | Central de Downloads: lista, baixa e exclui o arquivo |

### Botões e ações (5)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | agenda-gantt-kanban.spec.ts | Projetos (gantt): a ação Tarefas da linha abre as tarefas do projeto | ações da linha: abrem a outra tela em janela, filtrada pelo registro |
| Coberto | real | departamentos-funcs.spec.ts | a ação Funcionários da linha abre a lista de funcionários do departamento | ações da linha: abrem a outra tela em janela, filtrada pelo registro |
| Coberto | real | itens-do-pedido.spec.ts | ícones da linha na ordem da plataforma e as ações Produtos e Pedidos abrem janela | ações da linha: abrem a outra tela em janela, filtrada pelo registro |
| Coberto | oracle | clientes.spec.ts | ícones da linha: Visualizar, Editar e Excluir, nessa ordem | botões: Exportar antes de Novo Registro; Visualizar, Editar e Excluir nessa ordem |
| Coberto | oracle | departamentos-funcs.spec.ts | a ação Funcionários da linha abre a lista de funcionários do departamento | ações da linha: abrem a outra tela em janela, filtrada pelo registro |

### Abas, seções e subdetalhes (15)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | aba-do-cliente.spec.ts | editar o pedido (status e funcionário) e o Salvar da tela grava | abas: editar um campo da linha da aba e excluir uma linha da aba, com o Salvar da tela |
| Coberto | real | aba-do-cliente.spec.ts | excluir um item pela lixeira do item e o Salvar da tela grava (o outro item continua) | lixeira do item + Salvar da tela |
| Coberto | real | aba-do-cliente.spec.ts | excluir o pedido pela aba e o Salvar da tela grava (o cliente continua) | abas: editar um campo da linha da aba e excluir uma linha da aba, com o Salvar da tela |
| Coberto | real | aba-do-cliente.spec.ts | excluir um cliente que já tem pedido e itens: remove tudo junto, sem erro | abas: excluir o pai leva as linhas junto |
| Coberto | real | clientes-pedidos-itens.spec.ts | cadastro completo: cliente, pedido com 2 itens, tudo salvo junto | abas + sub-abas: cadastro com detalhes e itens |
| Coberto | real | itens-do-pedido.spec.ts | lápis do item: janela "Editar Registro", altera a quantidade e o Salvar da tela grava | lápis do item + Salvar da tela |
| Coberto | real | itens-do-pedido.spec.ts | "+" do item: linha nova na própria aba (produto por busca, mínimo 3 letras) e o Salvar da tela grava | sub-aba: o + adiciona o item (o campo de produto é uma lista, não mais busca), com o Salvar da tela |
| Coberto | real | itens-do-pedido.spec.ts | "Abrir Modal" do item: cadastra na janela "Novo Registro" e o Salvar da tela grava | Abrir Modal do item + Salvar da tela |
| Coberto | real | itens-do-pedido.spec.ts | totais do Studio: Total Item = quantidade × preço e Total Pedido = soma dos itens | fórmulas: Total Item e Total Pedido calculados na tela = calculados pelo banco |
| Coberto | fixture | cadastro.spec.ts | edição abre com os dados do cliente e mostra a aba de pedidos com o título do Studio | abas configuradas no formulário; edição reabre com os dados |
| Coberto | fixture | relacoes.spec.ts | aba Contatos lista os contatos do cliente (Cliente 01 tem 2; Cliente 03 nenhum) | abas e sub-abas configuradas no formulário |
| Coberto | fixture | relacoes.spec.ts | subdetalhe: os itens aparecem sob cada pedido | abas e sub-abas configuradas no formulário |
| Coberto | fixture | relacoes.spec.ts | pedido com data e hora abre com a hora (14:30 do pedido 1) | data e hora: a hora é gravada, reaparece e é preservada ao editar outro campo |
| Coberto | fixture | relacoes.spec.ts | editar um pedido e salvar mantém a hora e grava a alteração | data e hora: a hora é gravada, reaparece e é preservada ao editar outro campo |
| Coberto | fixture | relacoes.spec.ts | cria o cliente já com contato e pedido preenchidos antes de o mestre existir | cadastro com abas preenchidas antes de o mestre existir |

### Telas por tipo (8)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | agenda-gantt-kanban.spec.ts | Entregas (agenda): criar para um pedido, aparecer na agenda, editar o status | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | real | agenda-gantt-kanban.spec.ts | Projetos (gantt): criar, editar o percentual e excluir | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | real | agenda-gantt-kanban.spec.ts | Tarefas: cria no kanban com projeto, responsável e prioridade; muda o status; a etapa-filha liga à antecessora no fluxo | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | real | agenda-gantt-kanban.spec.ts | Pedidos - Timeline: criar um pedido pelo formulário da timeline e editar o status | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | real | cadastros-gerais.spec.ts | Produtos (galeria): criar com categoria e preço, editar e excluir pela galeria | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | real | cadastros-gerais.spec.ts | Empresa (mapa mental): novo departamento aparece no mapa e o nome pode ser editado | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | real | cadastros-gerais.spec.ts | Clientes - Geospatial (mapa): cliente novo com coordenadas entra na contagem do mapa | telas por tipo: cadastro, reabrir, edição e exclusão (/<tela>/new e /<tela>/<id>), com o registro visível na tela quando ela mostra texto |
| Coberto | oracle | pedidos-e-bi.spec.ts | BI /bi---pedidos: painel abre, atualiza e tem tabela de dados | BI: o painel abre, atualiza e mostra dados |

### Segurança e acesso (10)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Coberto | real | permissoes-por-tela.spec.ts | telas sem restrição no grupo seguem liberadas (Produtos abre e lista) | acesso "nenhum": as outras telas seguem no menu e abrem |
| Coberto | oracle | clientes.spec.ts | Funcionário (sem regra por linha neste projeto) também enxerga os clientes existentes | acesso "leitura" sem regra por linha: o total é o da tabela |
| Coberto | oracle | gestao-de-acesso.spec.ts | a lista mostra os usuários com o grupo que está no banco | Gestão de acesso (8 testes por app) |
| Coberto | oracle | gestao-de-acesso.spec.ts | criar usuário com grupo, entrar com ele, trocar de grupo, redefinir a senha e excluir | Gestão de acesso (8 testes por app) |
| Coberto | oracle | gestao-de-acesso.spec.ts | e-mail repetido: o erro aparece na janela e nada é criado | Gestão de acesso (8 testes por app) |
| Coberto | oracle | gestao-de-acesso.spec.ts | criar, renomear e excluir um grupo | Gestão de acesso (8 testes por app) |
| Coberto | oracle | gestao-de-acesso.spec.ts | a matriz mostra o nível de cada tela para o grupo de teste (Clientes leitura, Departamentos nenhum) | Gestão de acesso (8 testes por app) |
| Coberto | oracle | gestao-de-acesso.spec.ts | mudar a permissão do grupo de teste vale no próximo login e pode ser desfeita | Gestão de acesso (8 testes por app) |
| Coberto | oracle | gestao-de-acesso.spec.ts | as telas de gestão de acesso são só do Administrador (a Funcionária não entra) | Gestão de acesso (8 testes por app) |
| Coberto | oracle | permissoes-por-tela.spec.ts | telas sem restrição no grupo seguem liberadas (Pedidos abre e lista) | acesso "nenhum": as outras telas seguem no menu e abrem |

### Telas criadas por IA (2)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Fica à mão | real | cadastros-gerais.spec.ts | Gerenciamento de Produtos (tela da IA): cadastrar, editar o preço e excluir | Tela criada por IA tem código próprio: o dinâmico só confere que abre |
| Fica à mão | real | telas-especiais.spec.ts | Gerenciamento de Produtos (tela criada por IA): lista os produtos e as categorias do banco | Tela criada por IA tem código próprio: o dinâmico só confere que abre |

### Rede de proteção do banco (2)

| Situação | Suíte | Arquivo | Teste | Coberto por / o que falta |
|---|---|---|---|---|
| Fica à mão | real | rede-de-protecao.spec.ts | limpeza apaga só as linhas do teste (prefixo E2E-) e a contagem das originais não muda | Rede de proteção do motor (guard): conferida no fim de cada rodada ("Banco intacto") |
| Fica à mão | oracle | rede-de-protecao.spec.ts | limpeza apaga só as linhas do teste (prefixo E2E-) e a contagem das originais não muda | Rede de proteção do motor (guard): conferida no fim de cada rodada ("Banco intacto") |
