# Cobertura: testes atuais × motor de testes dinâmico

Gerado em 2026-10-19 pelo inventário da pasta `e2e`. São **122 testes** escritos à mão: 64 em `real/` (Postgres + Node), 35 em `oracle/` e 23 em `tests/` (projeto de exemplo).

**Regra para apagar:** um teste antigo só sai quando o motor dinâmico cobre o mesmo comportamento *e* a regra nova já rodou verde nos projetos de referência (Vendas PG e Vendas ORA). A pasta `e2e` (travas do banco, robôs de login, impressão digital das linhas, executor) é a base do motor e não é apagada. Os testes unitários do gerador (`src/lib/generator/__tests__`) também ficam: testam o gerador, não o app.

## Resumo por categoria

| Categoria | O que o motor dinâmico fará | Quando | Testes (real / oracle / exemplo) | Total |
|---|---|---|---|---|
| **Já coberto pelo motor dinâmico** | A tela abre (todos os tipos); formulário, obrigatórios, máscaras e tipos de campo; grid (total, ordenação, filtro de texto e por opção, paginação, Visualizar); exportação (CSV, JSON, Excel, só o filtrado, só o marcado, Central de Downloads); botões e abas; um gabarito por tipo de tela (galeria, kanban, fluxo, timeline, gantt, agenda, mapa mental, mapa, BI) | Pronto (Postgres + Node) | 34 / 16 / 3 | **53** |
| **Autoteste do motor** | Login do robô: o motor confere antes de qualquer teste | Interno ao motor | 1 / 1 / 0 | **2** |
| **Cadastro, edição e exclusão** | Preencher com dados válidos gerados por tipo de campo, salvar, reabrir igual, editar, excluir, auditoria (criado_por) | Fase 2 (precisa de banco de teste) | 1 / 2 / 1 | **4** |
| **Tipos de campo e opções** | Por tipo: texto, número, data/hora, booleano, opções fixas, relação, autocomplete; o formulário mostra o que está no banco | Fase 2 | 3 / 1 / 6 | **10** |
| **Grid e filtros** | Tamanho de página do Studio, paginação, ordenação, filtros, Limpar, Visualizar só leitura, total igual ao banco | Fase 2 | 1 / 1 / 4 | **6** |
| **Exportação de dados** | Formatos liberados no Studio (CSV, JSON, Excel), só o filtrado, só as linhas marcadas, Central de Downloads | Fase 2 | 1 / 1 / 3 | **5** |
| **Botões e ações** | Botões do Studio na ordem, ações de linha e ações customizadas (abrir outra tela em modal) | Fase 3 | 3 / 2 / 0 | **5** |
| **Abas, seções e subdetalhes** | Detalhe como aba ou seção, subdetalhe, itens (lápis, +, modal), fórmulas, exclusão em cascata | Fase 3 | 9 / 0 / 6 | **15** |
| **Telas por tipo** | Um gabarito por tipo de tela: kanban, gantt, agenda, timeline, fluxo, mapa, mapa mental, galeria, BI (as contagens batem com o banco) | Fase 3 e 4 (arrastar e soltar por último) | 7 / 1 / 0 | **8** |
| **Segurança e acesso** | Gestão de usuários, grupos e permissões, regra por linha: derivável da configuração de acesso do projeto | Fase 4 | 1 / 9 / 0 | **10** |
| **Telas criadas por IA** | Têm código próprio (não são declarativas): a configuração não descreve o comportamento | Fica à mão | 2 / 0 / 0 | **2** |
| **Rede de proteção do banco** | Garante que o teste só apaga o que criou: faz parte do motor | Fica (é o motor) | 1 / 1 / 0 | **2** |

**Hoje o motor já cobre 53 dos 122 testes (43%).** As regras que faltam (cadastro, campos por tipo, paginação e demais comportamentos do grid, exportação do filtrado e do marcado, botões, abas) cobrem mais 45 testes. Telas por tipo e segurança exigem gabaritos próprios (18 testes). Ficam à mão: telas de IA (2) e a rede de proteção (2).

## Ordem sugerida para o motor ganhar regras

1. **Feito (só leitura):** tela abre, formulário, tipos de campo, obrigatórios, máscaras, grid completo (total, ordenação, filtros, paginação, Visualizar), exportação completa, botões, abas e um gabarito por tipo de tela, no Postgres + Node.
2. **Entrega do motor ao cliente e banco de teste do cliente:** copiar o motor para a pasta do usuário e tela de conexão da cópia do banco, com consentimento para o banco original.
3. **Cadastro, edição e exclusão com dados gerados:** exige o item 2 e a limpeza por prefixo.
4. **Feito:** kanban (arrastar cartão grava a coluna) e gantt (Visualizar abre o registro); regra por linha "related" só com testes unitários. **Falta:** fluxo (arrastar e conectar etapas) e as ações das linhas que abrem outra tela em janela.
5. **Feito:** segurança gerada da configuração de acesso (grupos, permissões por tela, regras por linha, gestão de usuários, grupos e permissões). A gestão de acesso ainda não rodou no Oracle.

## Lista completa (um teste por linha)

### Já coberto pelo motor dinâmico (53)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | clientes-pedidos-itens.spec.ts | edição e exclusão só do cliente criado pelo teste |
| real | clientes-pedidos-itens.spec.ts | regra por linha com exceção: Administrador (na lista de exceção) vê clientes de outras pessoas; Funcionária não |
| real | departamentos-funcs.spec.ts | criar, editar e excluir um departamento (auditoria do robô gravada) |
| real | departamentos-funcs.spec.ts | nome é obrigatório: salvar vazio não cria registro |
| real | departamentos-funcs.spec.ts | criar func com departamento, editar o cargo e excluir |
| real | departamentos-funcs.spec.ts | campos obrigatórios (nome, e-mail, cargo, data): salvar vazio não cria registro |
| real | exportar-e-grid.spec.ts | CSV e JSON trazem só o que está filtrado na tela, com as colunas da grid |
| real | exportar-e-grid.spec.ts | com linhas marcadas, exporta só elas; marcar todas e desmarcar |
| real | exportar-e-grid.spec.ts | Central de Downloads lista a exportação, baixa o arquivo e exclui |
| real | exportar-e-grid.spec.ts | paginação: 12 clientes com 10 por página (2 páginas), total e página 2 |
| real | exportar-e-grid.spec.ts | ordenação por coluna: crescente e decrescente pelo cabeçalho |
| real | exportar-e-grid.spec.ts | filtro de Status Lead e botão Limpar |
| real | exportar-e-grid.spec.ts | Visualizar abre o formulário só para leitura e Cancelar volta sem gravar |
| real | gestao-de-acesso.spec.ts | a lista mostra os usuários com o grupo que está no banco |
| real | gestao-de-acesso.spec.ts | criar usuário com grupo, entrar com ele, trocar de grupo, redefinir a senha e excluir |
| real | gestao-de-acesso.spec.ts | e-mail repetido: o erro aparece na janela e nada é criado |
| real | gestao-de-acesso.spec.ts | criar, renomear e excluir um grupo |
| real | gestao-de-acesso.spec.ts | a matriz mostra o nível de cada tela para o grupo de teste (Clientes leitura, Departamentos nenhum) |
| real | gestao-de-acesso.spec.ts | mudar a permissão do grupo de teste vale no próximo login e pode ser desfeita |
| real | gestao-de-acesso.spec.ts | as telas de gestão de acesso são só do Administrador (a Funcionária não entra) |
| real | itens-do-pedido.spec.ts | Funcionária não enxerga o cliente criado pelo robô Administrador (regra por linha) |
| real | permissoes-por-tela.spec.ts | tela bloqueada some do menu e não abre pelo endereço |
| real | permissoes-por-tela.spec.ts | tela só de leitura: abre e mostra os dados, mas não deixa criar, editar nem excluir |
| real | smoke.spec.ts | todas as telas do menu abrem sem erro |
| real | telas-especiais.spec.ts | Produtos (galeria): um cartão por produto e filtro por categoria |
| real | telas-especiais.spec.ts | Kanban de tarefas: cartões com ações e filtros por projeto e responsável |
| real | telas-especiais.spec.ts | Tarefas - Fluxo (fluxograma): mostra o diagrama e o total de etapas igual ao banco |
| real | telas-especiais.spec.ts | Pedidos - Timeline: tela com os filtros (sem nome de campo: pela ordem Cliente, Funcionário), tamanhos e atualização de dados |
| real | telas-especiais.spec.ts | Projetos (gantt): filtros, botão Hoje e ação Tarefas da linha |
| real | telas-especiais.spec.ts | Entregas (agenda): mês atual, troca entre Mês, Semana e Dia |
| real | telas-especiais.spec.ts | Empresa (mapa mental): um item por departamento |
| real | telas-especiais.spec.ts | Clientes - Geospatial (mapa): total de registros e quantos têm coordenadas, iguais ao banco |
| real | telas-especiais.spec.ts | BI /bi---pedidos: painel abre, atualiza e tem tabela de dados |
| real | telas-especiais.spec.ts | BI /bi---laboratorio: painel abre, atualiza e tem tabela de dados |
| oracle | clientes.spec.ts | nome da empresa é obrigatório: salvar vazio não cria registro |
| oracle | clientes.spec.ts | edição e exclusão só do cliente criado pelo teste |
| oracle | departamentos-funcs.spec.ts | criar, editar e excluir um departamento (auditoria do robô gravada) |
| oracle | departamentos-funcs.spec.ts | nome é obrigatório: salvar vazio não cria registro |
| oracle | departamentos-funcs.spec.ts | criar func com departamento, editar o cargo e excluir |
| oracle | departamentos-funcs.spec.ts | campos obrigatórios (nome, e-mail, cargo, data): salvar vazio não cria registro |
| oracle | exportar-e-grid.spec.ts | CSV e JSON trazem só o que está filtrado na tela, com as colunas da grid |
| oracle | exportar-e-grid.spec.ts | com linhas marcadas, exporta só elas; marcar todas e desmarcar |
| oracle | exportar-e-grid.spec.ts | Central de Downloads lista a exportação, baixa o arquivo e exclui |
| oracle | exportar-e-grid.spec.ts | paginação: 12 clientes com 10 por página (2 páginas), total e página 2 |
| oracle | exportar-e-grid.spec.ts | ordenação por coluna: crescente e decrescente pelo cabeçalho |
| oracle | exportar-e-grid.spec.ts | filtro de Status Lead e botão Limpar |
| oracle | exportar-e-grid.spec.ts | Visualizar abre o formulário só para leitura e Cancelar volta sem gravar |
| oracle | permissoes-por-tela.spec.ts | tela bloqueada some do menu e não abre pelo endereço |
| oracle | permissoes-por-tela.spec.ts | tela só de leitura: abre e mostra os dados, mas não deixa criar, editar nem excluir |
| oracle | smoke.spec.ts | todas as telas do menu abrem sem erro |
| fixture | export.spec.ts | CSV traz todos os 30 clientes (com BOM e ;) |
| fixture | export.spec.ts | Excel é um arquivo .xlsx válido |
| fixture | tipos-de-campo.spec.ts | máscara de CNPJ formata ao digitar |

### Autoteste do motor (2)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | smoke.spec.ts | login do robô funciona e a senha errada é recusada |
| oracle | smoke.spec.ts | login do robô funciona e a senha errada é recusada |

### Cadastro, edição e exclusão (4)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | cadastros-gerais.spec.ts | Pedidos (lista): criar para um cliente, editar o status e excluir |
| oracle | clientes.spec.ts | cadastrar um cliente: grava os dados e a auditoria do robô (criado_por) |
| oracle | pedidos-e-bi.spec.ts | Pedidos (lista): criar para um cliente, editar o status e excluir |
| fixture | cadastro.spec.ts | cria um cliente, ele aparece na lista e pode ser excluído |

### Tipos de campo e opções (10)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | departamentos-funcs.spec.ts | a lista de departamentos do formulário traz os departamentos existentes |
| real | itens-do-pedido.spec.ts | textos da busca de produto iguais aos da plataforma (linha da aba e janela) |
| real | itens-do-pedido.spec.ts | Data Pedido (tipo "date" no Studio) mostra só a data, como na plataforma |
| oracle | departamentos-funcs.spec.ts | a lista de departamentos do formulário traz os departamentos existentes |
| fixture | autocomplete.spec.ts | autocomplete do produto busca no servidor, escolhe e grava |
| fixture | tipos-de-campo.spec.ts | edição mostra o que está no banco em cada tipo (Cliente 02) |
| fixture | tipos-de-campo.spec.ts | cliente sem marca de ativo abre desmarcado (Cliente 01) |
| fixture | tipos-de-campo.spec.ts | opções fixas e relação oferecem as opções certas |
| fixture | tipos-de-campo.spec.ts | cria com todos os tipos, grava no banco e reabre igual |
| fixture | tipos-de-campo.spec.ts | desmarcar o booleano e salvar a edição grava falso |

### Grid e filtros (6)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | telas-especiais.spec.ts | Pedidos (lista): o Administrador vê todos os pedidos (total igual ao banco) e a ação Produtos da linha |
| oracle | pedidos-e-bi.spec.ts | Pedidos (lista): o total mostrado é igual ao do banco |
| fixture | grid.spec.ts | mostra a primeira página com o tamanho configurado no Studio e o total |
| fixture | grid.spec.ts | paginação leva às 5 linhas restantes |
| fixture | grid.spec.ts | filtro por nome encontra só o cliente |
| fixture | grid.spec.ts | botões do topo na ordem da plataforma: Exportar antes de Novo Registro |

### Exportação de dados (5)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | exportar-e-grid.spec.ts | Excel (.xlsx) é um arquivo válido |
| oracle | exportar-e-grid.spec.ts | Excel (.xlsx) é um arquivo válido |
| fixture | export.spec.ts | com linhas marcadas exporta só elas |
| fixture | export.spec.ts | marcar todas pelo cabeçalho e desmarcar |
| fixture | export.spec.ts | Central de Downloads lista as exportações, baixa e exclui |

### Botões e ações (5)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | agenda-gantt-kanban.spec.ts | Projetos (gantt): a ação Tarefas da linha abre as tarefas do projeto |
| real | departamentos-funcs.spec.ts | a ação Funcionários da linha abre a lista de funcionários do departamento |
| real | itens-do-pedido.spec.ts | ícones da linha na ordem da plataforma e as ações Produtos e Pedidos abrem janela |
| oracle | clientes.spec.ts | ícones da linha: Visualizar, Editar e Excluir, nessa ordem |
| oracle | departamentos-funcs.spec.ts | a ação Funcionários da linha abre a lista de funcionários do departamento |

### Abas, seções e subdetalhes (15)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | aba-do-cliente.spec.ts | editar o pedido (status e funcionário) e o Salvar da tela grava |
| real | aba-do-cliente.spec.ts | excluir um item pela lixeira do item e o Salvar da tela grava (o outro item continua) |
| real | aba-do-cliente.spec.ts | excluir o pedido pela aba e o Salvar da tela grava (o cliente continua) |
| real | aba-do-cliente.spec.ts | excluir um cliente que já tem pedido e itens: remove tudo junto, sem erro |
| real | clientes-pedidos-itens.spec.ts | cadastro completo: cliente, pedido com 2 itens, tudo salvo junto |
| real | itens-do-pedido.spec.ts | lápis do item: janela "Editar Registro", altera a quantidade e o Salvar da tela grava |
| real | itens-do-pedido.spec.ts | "+" do item: linha nova na própria aba (produto por busca, mínimo 3 letras) e o Salvar da tela grava |
| real | itens-do-pedido.spec.ts | "Abrir Modal" do item: cadastra na janela "Novo Registro" e o Salvar da tela grava |
| real | itens-do-pedido.spec.ts | totais do Studio: Total Item = quantidade × preço e Total Pedido = soma dos itens |
| fixture | cadastro.spec.ts | edição abre com os dados do cliente e mostra a aba de pedidos com o título do Studio |
| fixture | relacoes.spec.ts | aba Contatos lista os contatos do cliente (Cliente 01 tem 2; Cliente 03 nenhum) |
| fixture | relacoes.spec.ts | subdetalhe: os itens aparecem sob cada pedido |
| fixture | relacoes.spec.ts | pedido com data e hora abre com a hora (14:30 do pedido 1) |
| fixture | relacoes.spec.ts | editar um pedido e salvar mantém a hora e grava a alteração |
| fixture | relacoes.spec.ts | cria o cliente já com contato e pedido preenchidos antes de o mestre existir |

### Telas por tipo (8)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | agenda-gantt-kanban.spec.ts | Entregas (agenda): criar para um pedido, aparecer na agenda, editar o status |
| real | agenda-gantt-kanban.spec.ts | Projetos (gantt): criar, editar o percentual e excluir |
| real | agenda-gantt-kanban.spec.ts | Tarefas: cria no kanban com projeto, responsável e prioridade; muda o status; a etapa-filha liga à antecessora no fluxo |
| real | agenda-gantt-kanban.spec.ts | Pedidos - Timeline: criar um pedido pelo formulário da timeline e editar o status |
| real | cadastros-gerais.spec.ts | Produtos (galeria): criar com categoria e preço, editar e excluir pela galeria |
| real | cadastros-gerais.spec.ts | Empresa (mapa mental): novo departamento aparece no mapa e o nome pode ser editado |
| real | cadastros-gerais.spec.ts | Clientes - Geospatial (mapa): cliente novo com coordenadas entra na contagem do mapa |
| oracle | pedidos-e-bi.spec.ts | BI /bi---pedidos: painel abre, atualiza e tem tabela de dados |

### Segurança e acesso (10)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | permissoes-por-tela.spec.ts | telas sem restrição no grupo seguem liberadas (Produtos abre e lista) |
| oracle | clientes.spec.ts | Funcionário (sem regra por linha neste projeto) também enxerga os clientes existentes |
| oracle | gestao-de-acesso.spec.ts | a lista mostra os usuários com o grupo que está no banco |
| oracle | gestao-de-acesso.spec.ts | criar usuário com grupo, entrar com ele, trocar de grupo, redefinir a senha e excluir |
| oracle | gestao-de-acesso.spec.ts | e-mail repetido: o erro aparece na janela e nada é criado |
| oracle | gestao-de-acesso.spec.ts | criar, renomear e excluir um grupo |
| oracle | gestao-de-acesso.spec.ts | a matriz mostra o nível de cada tela para o grupo de teste (Clientes leitura, Departamentos nenhum) |
| oracle | gestao-de-acesso.spec.ts | mudar a permissão do grupo de teste vale no próximo login e pode ser desfeita |
| oracle | gestao-de-acesso.spec.ts | as telas de gestão de acesso são só do Administrador (a Funcionária não entra) |
| oracle | permissoes-por-tela.spec.ts | telas sem restrição no grupo seguem liberadas (Pedidos abre e lista) |

### Telas criadas por IA (2)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | cadastros-gerais.spec.ts | Gerenciamento de Produtos (tela da IA): cadastrar, editar o preço e excluir |
| real | telas-especiais.spec.ts | Gerenciamento de Produtos (tela criada por IA): lista os produtos e as categorias do banco |

### Rede de proteção do banco (2)

| Suíte | Arquivo | Teste |
|---|---|---|
| real | rede-de-protecao.spec.ts | limpeza apaga só as linhas do teste (prefixo E2E-) e a contagem das originais não muda |
| oracle | rede-de-protecao.spec.ts | limpeza apaga só as linhas do teste (prefixo E2E-) e a contagem das originais não muda |

