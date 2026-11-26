# Roteiro: 1 teste para cada gatilho do BPM (versão revisada, 24/11/2026)

São 9 gatilhos no painel, e cada um tem um teste abaixo, ligado a um item do seu plano de vídeos. Os nomes de campos e de nós foram tirados do código, mas **nenhum fluxo foi executado**: confira os nomes reais das colunas das suas tabelas (`titulo`, `status` etc.) e faça um ensaio antes de gravar.

Este roteiro cobre **o que cada gatilho faz na plataforma** (com o CLI). O roteiro de conferência técnica, incluindo o **app exportado**, é o `docs/bpm-roteiro-testes.md`. Os testes 1, 2, 3, 4, 5, 6, 8 e 9 abaixo também valem no app exportado (veja "Repetir no app exportado", no fim).

## O que mudou em relação à versão anterior

- **Teste 3 (Ao atualizar com "Restringir a um campo", De/Para) foi consertado no motor.** Antes, a restrição só existia na tela: o motor ignorava e disparava em toda edição. Agora o motor lê o registro **como era antes da edição** e só dispara se o campo mudou (e, se informados, se o valor anterior confere com o **De** e o novo com o **Para**). **Esta correção só existe a partir do CLI desta versão**: com a IDE/CLI da release anterior, o teste 3 ainda falha do jeito antigo.
- **Teste 8:** o agendamento "Apenas uma vez" agora roda **uma vez só** (antes repetia no mesmo dia do ano seguinte) e, sem data e hora específicas ou com data passada, **avisa no log** em vez de ignorar em silêncio. Vale a partir da release 1.0.10.
- **Teste 5:** removida a referência à correção de outra conversa.
- **Teste 9:** completo, com o comando, os casos de recusa e o resultado esperado.
- **Condição:** o operador **"contém"** e os **vários grupos** (com o E/OU entre eles) agora funcionam no motor; antes o "contém" dava sempre falso e só o 1º grupo valia.
- Acréscimos: **"Casos de borda"** (condições, ações, variáveis, vários fluxos, agendamento recorrente, De/Para e quem executa), "Repetir no app exportado" e "Limites que valem no vídeo".

## Antes de começar

- **CLI ligado, na versão desta release**, e fluxo **salvo e ativo**. Fluxo inativo não dispara nada. Fluxo publicado com o CLI já ligado entra em vigor na hora (o CLI ouve as mudanças); não precisa reiniciar.
- **Destinatário de e-mail seu.** Troque o `email_contato` do cliente de teste por um e-mail que você controle.
- **Mantenha a janela do CLI visível** durante as gravações. Ela mostra `[BPM] Disparando fluxo "..."` quando o gatilho dispara. Se não aparecer, o problema está no gatilho, e não no e-mail ou na ação.
- **Nó de Resposta:** o interruptor "permitir ação" desligado faz o fluxo bloquear e mostrar a mensagem. Ligado, só mostra um aviso.
- **Nó de Condição:** compara um campo com um valor fixo (`==`, `!=`, `>`, `<`, `>=`, `<=`). Ele não compara dois campos entre si.

## Ordem sugerida para o vídeo

Três blocos curtos, do mais simples ao mais avançado:
1. **Depois do fato:** Ao inserir, Ao atualizar, Ao excluir.
2. **Antes do fato (validação):** Antes de Salvar (novo), Antes de Salvar (edição), Antes de Excluir, Ao Carregar.
3. **Sem usuário na tela:** Agendado, Webhook.

---

## Acompanhamento

Marque `[x]` ao concluir cada teste (e anote a data). Os casos de borda têm a coluna ✔ nas próprias tabelas, mais abaixo.

| ✔ | # | Gatilho | Resultado | Data |
|---|---|---|---|---|
| [x] | 1 | Ao inserir · Pedidos | E-mail de confirmação chegou, com a data formatada (`25/11/2026`) | 25/11/2026 |
| [x] | 2 | Antes de Salvar (novo) · Pedidos | Pedido Cancelado barrado com a mensagem, nada gravado | 25/11/2026 |
| [x] | 3 | Ao atualizar · Pedidos (De/Para) | Dispara só na mudança para Enviado, com **De** vazio e preenchido; e-mail e mensagem na tela chegaram | 25/11/2026 |
| [x] | 4 | Antes de Salvar (edição) · Pedidos | Edição de pedido Entregue barrada com a mensagem "Pedido entregue não pode ser editado" | 26/11/2026 |
| [x] | 5 | Ao excluir · Pedidos | 100% testado e aprovado | 26/11/2026 |
| [x] | 6 | Antes de Excluir · Pedidos | 100% testado e aprovado | 26/11/2026 |
| [x] | 7 | Ao Carregar Formulário · Pedidos | 100% testado e aprovado | 26/11/2026 |
| [x] | 8 | Agendado · Clientes | "Apenas uma Vez" disparou e o e-mail chegou. Recorrente diário às 07:00 em acompanhamento | 26/11/2026 |
| [x] | 9 | Webhook de entrada · Tarefas | Resposta 200 (`{"success":true}`) e a tarefa apareceu no Kanban | 26/11/2026 |
| [ ] | 10 | Consultar dados + Agendado (relatório por e-mail) | | |

**Também conferido nesta rodada** (além dos 9 gatilhos):
- [x] **Data legível** nos e-mails: `25/11/2026` (e `26/11/2026 00:12`, quando o campo tem hora).
- [x] **Enum no De/Para** do gatilho "Ao atualizar" (*Restringir a um campo* → *Usar Enum?* → `StatusPedido`).
- [x] **Estado de cada fluxo** no combo do Studio: 🟢 publicado, 🟡 publicado com alterações não publicadas, ⚪ rascunho.
- [x] **Aba Mensagem** simplificada (campo único + tipo do aviso): o aviso aparece na tela de quem salvou, junto do e-mail.
- [x] **Publicar recarrega o CLI** sem reiniciar o túnel (`Sincronização forçada dos fluxos recebida`).
- [x] **Bloqueio "Antes de Salvar"** chega antes da gravação (nenhum `INSERT` no log do pedido barrado).

---
## 1. Ao inserir · Pedidos (item 3)
**Status:** [x] validado em 25/11/2026: o e-mail chegou (data formatada).
**Objetivo:** o cliente recebe um e-mail de confirmação ao criar um pedido.
1. Fluxo "Confirmação de Pedido". Gatilho: **Ao inserir**, tabela **Pedidos**.
2. Ação **Enviar e-mail**: destinatário **Tabela dinâmica**, tabela **Clientes**, campo `email_contato`, filtro `id` igual a `{{pedidos.cliente_id}}`.
3. Assunto `Pedido #{{pedidos.id}} recebido`. Corpo com `{{pedidos.status}}` e `{{pedidos.data_pedido}}`.
4. Salve e ative. Crie um pedido para o cliente de teste.

**Resultado:** o e-mail chega na sua caixa. Não use o valor total no e-mail: em mestre-detalhe os itens ainda não existem nesse momento.

## 2. Antes de Salvar (novo) · Pedidos (item 3)
**Status:** [x] validado em 25/11/2026: a mensagem de bloqueio aparece e nada é gravado.
**Objetivo:** barrar um pedido que já nasce cancelado.
1. Gatilho: **Antes de Salvar (Novo)**, tabela **Pedidos**.
2. **Condição:** `status` `==` `Cancelado`. No ramo **verdadeiro**, ligue um nó de **Resposta** com a ação **bloqueada** e a mensagem "Um novo pedido não pode começar como Cancelado".
3. Tente salvar um novo pedido com status Cancelado.

**Resultado:** aparece a mensagem de erro e **nada é gravado**. Em seguida salve com status Pendente e mostre que passa.

**Dicas:** na Condição dá para marcar **Usar Enum?** e escolher o valor na lista (`StatusPedido` → `Cancelado`). Ao publicar, o CLI recarrega sozinho; confira `Sincronização forçada dos fluxos recebida` no log.

## 3. Ao atualizar · Pedidos (itens 3 e 6) — **De/Para corrigido nesta versão**
**Status:** [x] validado em 25/11/2026: dispara só na mudança para Enviado; **De** vazio e preenchido; e-mail e mensagem na tela.
**Objetivo:** avisar o cliente só quando o pedido **virar** "Enviado".
1. Gatilho: **Ao atualizar**, tabela **Pedidos**. Marque **Restringir a um campo**: campo `status`, **De:** (vazio), **Para:** `Enviado`.
2. Ação **Enviar e-mail** igual à do teste 1, com assunto "Seu pedido #{{pedidos.id}} foi enviado".
3. Edite um pedido Pendente e mude o status para Enviado.
4. Edite o **mesmo** pedido de novo, mexendo só em outro campo (status continua Enviado).
5. Opcional, para mostrar o **De**: preencha **De:** `Pendente`, salve o fluxo, mude um pedido **Aberto** para Enviado (não dispara) e depois um **Pendente** para Enviado (dispara).
6. Opcional: no gatilho, marque **Usar Enum?** e escolha `StatusPedido`: **De** e **Para** viram listas com os valores do enum.
7. Opcional: na aba **Mensagem** da ação de e-mail, escreva um texto (com `+ Variável`) e o tipo do aviso (Sucesso, Informação ou Aviso). Ele aparece na tela de quem salvou, junto do e-mail.

**Resultado:** o e-mail sai na mudança para Enviado e **não sai** na segunda edição (o status não mudou). No CLI, quando não dispara, a linha `[BPM] Disparando fluxo...` não aparece.

**Regras do campo restrito (para explicar no vídeo):**
- Com a restrição ligada, o gatilho só vale quando **o campo mudou**. Sem informar De nem Para, dispara em qualquer mudança dele.
- **De** vazio = qualquer valor anterior; **Para** vazio = qualquer valor novo.
- Número do banco e texto digitado são iguais (`5.00` e `5`).
- Se o motor não conseguir ler o registro anterior, ele **não dispara** e avisa no terminal do CLI (falha segura, para não mandar e-mail errado).
- Também vale para **Antes de Salvar (edição)**: o painel mostra a restrição nos dois gatilhos de edição.

## 4. Antes de Salvar (edição) · Pedidos (item 3)
**Status:** [x] validado em 26/11/2026: a edição do pedido Entregue é barrada com a mensagem.
**Objetivo:** pedido entregue não pode mais ser alterado.
1. Gatilho: **Antes de Salvar (Edição)**, tabela **Pedidos**.
2. **Condição:** `status` `==` `Entregue`, ramo verdadeiro com **Resposta** bloqueando: "Pedido entregue não pode ser editado".
3. Abra um pedido Entregue, altere qualquer campo e salve.

**Resultado:** a edição é barrada. A condição avalia os dados do formulário, então mudar o status para outro valor passa. Isso é útil para explicar o comportamento no vídeo.

**Dica:** a mensagem do nó de **Resposta** aceita variáveis (botão **+ Variável**), como `Pedido {{pedidos.id}} entregue não pode ser editado`.

## 5. Ao excluir · Pedidos (item 3)
**Status:** [x] 100% testado e aprovado em 26/11/2026.
**Objetivo:** avisar o gestor quando um pedido for apagado.
1. Gatilho: **Ao excluir**, tabela **Pedidos**.
2. Ação **Enviar e-mail**, aba Grupos/Usuários, em **e-mails específicos** o seu endereço. Assunto "Pedido #{{pedidos.id}} excluído".
3. Exclua um pedido de teste pela grid.

**Resultado:** o e-mail chega depois da exclusão, com os dados do registro apagado.

**Atenção:** no PostgreSQL o fluxo recebe a linha inteira que foi apagada. No Oracle recebe só o `id`, então use apenas `{{pedidos.id}}` ali.

## 6. Antes de Excluir · Pedidos (item 3)
**Status:** [x] 100% testado e aprovado em 26/11/2026.
**Objetivo:** pedido enviado não pode ser excluído.
1. Gatilho: **Antes de Excluir**, tabela **Pedidos**.
2. **Condição:** `status` `==` `Enviado`, ramo verdadeiro com **Resposta** bloqueando: "Pedido enviado não pode ser excluído".
3. Tente excluir um pedido Enviado. Depois exclua um Pendente.

**Resultado:** o primeiro é barrado e continua na grid. O segundo é apagado normalmente. O CLI lê o registro antes de apagar, e o bloqueio vale em qualquer tela que exclua pedidos.

## 7. Ao Carregar Formulário · Pedidos (item 3)
**Status:** [x] 100% testado e aprovado em 26/11/2026.
**Objetivo:** todo pedido novo já abre com status "Pendente".
1. Gatilho: **Ao Carregar Formulário**, tabela **Pedidos**.
2. Ação **Atualizar Dados do Formulário**: campo `status` com valor `Pendente`.
3. Clique em **Novo** pedido.

**Resultado:** o campo status já vem preenchido, antes de o usuário digitar.

**Atenção:** o fluxo roda também ao **abrir um pedido para editar** e sobrescreveria o status. Grave só a criação, ou use uma Resposta com mensagem de aviso no lugar da alteração. Este gatilho **não vai para o app exportado** (o selo do Studio avisa).

## 8. Agendado · Clientes (item 4)
**Status:** [x] validado em 26/11/2026: "Apenas uma Vez" disparou e o e-mail chegou. O mesmo fluxo foi trocado para **Recorrente, todos os dias às 07:00** e está em acompanhamento (confirmar a chegada nos próximos dias).
**Objetivo:** receber um resumo por e-mail num horário marcado.
1. Gatilho: **Agendado**. Para o vídeo use o tipo **Apenas uma Vez** e preencha **Data e hora da execução** **2 minutos à frente**. Nesse tipo só a data e a hora específicas valem: **dia da semana e horário aparecem só no Recorrente** (se preencher os dois em "uma vez" sem a data, nada é agendado). O horário vale pelo relógio da máquina onde o CLI roda.
2. Ação **Enviar e-mail**, em **e-mails específicos** o seu endereço, assunto "Resumo diário do MetaBuilder".
3. Salve e ative. Espere o horário com a janela do CLI aberta.

**Resultado:** aparece `⏰ Agendamento disparado` no CLI e o e-mail chega. A execução também fica registrada no histórico de automações (origem "agendamento").

**Atenção:**
- O fluxo agendado roda **sem dados de registro**. Não use `{{pedidos.campo}}` nem destinatário por tabela dinâmica.
- O tipo **Apenas uma Vez** roda uma vez só e se encerra ao disparar. Se a data já passou ou está vazia, o CLI avisa (`agendamento "Apenas uma vez" ... ignorado`). Para repetir, use **Recorrente** (dias da semana e horário).

## 9. Webhook de entrada · Tarefas (item 7)
**Status:** [x] validado em 26/11/2026: o `curl` devolveu 200 e a tarefa "Tarefa vinda do webhook" apareceu no Kanban. Os casos de recusa (sem segredo, método errado, fluxo desativado) não foram anotados aqui.
**Objetivo:** um sistema externo cria uma tarefa que aparece no Kanban.
1. Gatilho: **Webhook de entrada**, método **POST**. Clique em **Gerar segredo**, copie na hora (ele só aparece uma vez) e salve o fluxo.
2. Ação **Inserir registro** na tabela **Tarefas**: `titulo` = `{{webhook.titulo}}` (use os nomes reais das suas colunas).
3. Copie a URL do painel (formato `https://SEU-SITE/api/v1/webhook/<ID>`) e rode no PowerShell, trocando a URL e o segredo:

```powershell
curl.exe -i -X POST "https://SEU-SITE/api/v1/webhook/<ID>" -H "X-Webhook-Secret: <segredo>" -H "Content-Type: application/json" -d "{\"titulo\":\"Tarefa vinda do webhook\"}"
```

**Resultado:** resposta 200 e a tarefa aparece no Kanban (atualize a tela). No CLI aparece `Webhook recebido: disparando fluxo...`.

Casos de recusa (mostre pelo menos o primeiro no vídeo):
- **Sem o cabeçalho do segredo, ou com segredo errado:** `401`, nada é criado.
- **Método errado** (GET num fluxo POST): `405`.
- **Fluxo desativado ou ID inexistente:** erro, nada é criado.
- O segredo também vale como `Authorization: Bearer <segredo>`.

## 10. Consultar dados + Agendado · relatório por e-mail (novo, release 1.0.10, fases 1 e 2)
**Status:** [ ] a fazer

**Objetivo:** mandar por e-mail, em horário marcado, dados da aplicação (lista, contagem ou soma), em tabela no corpo e/ou planilha anexa.

**Montagem comum:** gatilho **Agendado** (para o ensaio, "Apenas uma Vez" com a data e hora 2 minutos à frente) → ação **Consultar dados** → ação **Enviar e-mail** (e-mails específicos, o seu endereço). Na ação de e-mail, use no corpo `{{consulta.tabela}}` e no assunto `{{consulta.total}}`; para a planilha, marque **Anexar o resultado de uma consulta** (Excel ou CSV).

| # | Consulta | Como montar | Esperado | ✔ |
|---|---|---|---|---|
| 10a | Clientes cadastrados nas últimas 48 horas | Tabela **Clientes**, modo **Listar registros**, colunas à escolha; filtro `criado_em` `>=` **Data relativa** → **Agora menos… 48 horas** | Tabela no corpo só com clientes novos; assunto com a quantidade | ☐ |
| 10b | Pedidos da semana anterior | Tabela **Pedidos**, listar; dois filtros: `data_pedido` `>=` **Início da semana passada** e `data_pedido` `<` **Início desta semana (segunda)** | Só os pedidos de segunda a domingo da semana passada | ☐ |
| 10c | Quantidade de pedidos por funcionário nos últimos 15 dias | Tabela **Pedidos**, **Agrupar e calcular**: agrupar por `funcionario_id` (o nome vem de **Funcionários**, campo `nome`), **Contar registros**; filtro `data_pedido` `>=` **Agora menos… 15 dias** | Uma linha por funcionário com o nome e a quantidade, da maior para a menor | ☐ |
| 10d | Não enviar e-mail vazio | Repita 10a numa data sem clientes novos e marque **Não continuar o fluxo se não houver nenhum registro** | Nenhum e-mail sai; o log mostra `Consulta "consulta" sem resultado: o fluxo não continua` | ☐ |
| 10e | Planilha anexa | Em 10b, marque o anexo (Excel) na ação de e-mail | O e-mail traz `consulta-AAAA-MM-DD.xlsx`; números como número, datas como data | ☐ |
| 10f | Muitos registros | Consulta com mais de 200 linhas e o anexo marcado | A tabela do corpo mostra 200 linhas e avisa `Mostrando 200 de N linhas`; a planilha tem todas (até o limite da consulta) | ☐ |
| 10g | Pedidos com valor ≥ 100.000 (campo calculado) | Tabela **Pedidos**, **Listar registros**; marque a coluna **ƒ Total Pedido** (campo calculado do caso de uso); filtro `ƒ Total Pedido` `>=` `100000`; ordene por `ƒ Total Pedido` decrescente | Só os pedidos cujo total (soma de quantidade × preço dos itens) chega a 100.000, com o total em pt-BR | ☐ |
| 10h | Faturamento por status | **Agrupar e calcular**: agrupar por `status`, **Somar** o campo `ƒ Total Pedido` | Uma linha por status com a soma dos totais dos pedidos | ☐ |
| 10i | Anexo em PDF | Em 10b ou 10g, escolha o formato **PDF (.pdf)** no anexo do e-mail | O e-mail traz `consulta-AAAA-MM-DD.pdf`: título, data de geração, tabela com cabeçalho repetido nas páginas e "Página x de y" | ☐ |
| 10j | Condição sobre o resultado | Depois da consulta, um nó de **Condição**: tabela **Resultado da consulta**, nome `consulta`, operador `>` e valor `0`; o e-mail no ramo **verdadeiro** | Com linhas, o e-mail sai; sem linhas, não sai (execução sucesso). Serve para alertas, como "avisar se houver pedido ≥ 100.000" | ☐ |

**Limites desta primeira fase (para explicar no vídeo):**
- **Campos calculados (ƒ)** vêm dos **casos de uso** da tabela (ex.: **Total Pedido** = soma de quantidade × preço dos itens). Funcionam fórmulas com **+ − × ÷**, parênteses, números e **uma** agregação (SOMA, MÉDIA, MÁXIMO, MÍNIMO, CONTAR) sobre a tabela filha ligada por uma relação do caso de uso. **SE, ARREDONDAR, ABS** e fórmulas com duas tabelas filhas **não** aparecem na lista. Não dá para **agrupar por** um campo calculado (use-o como valor a somar).
- A fórmula é **copiada para o nó** ao abrir o nó no Studio. Se alterar a fórmula no caso de uso, abra o nó da consulta, confira e salve/publique de novo.
- **Só leitura**, sem SQL livre; teto de **5.000 linhas** por consulta e **60 segundos**. No e-mail, as 200 primeiras linhas aparecem na tabela e o resto só na planilha.
- O anexo (Excel, CSV ou **PDF**) vai pelo servidor com limite de **2,5 MB** no total (poucas colunas e linhas, no máximo 2 anexos). No PDF, texto fora do alfabeto Latin-1 (como emojis) vira `?`.
- O fluxo roda **como sistema**: quem recebe o e-mail vê tudo o que a consulta devolve, sem as regras de acesso por linha de um usuário. Escolha com cuidado os destinatários e as colunas (dados pessoais).
- Datas relativas e a semana (começa na **segunda-feira**) seguem o relógio da máquina onde o CLI roda.
- O **app exportado** executa a consulta, mas **não envia anexo** (só o corpo do e-mail).
---

## Casos de borda (além do caminho feliz)

Os testes acima mostram cada gatilho funcionando. Aqui estão os cantos onde o comportamento surpreende. **O resultado esperado vem da leitura do código do motor (`cli/bpmCore.js`), não de execução**: se o que você vir for diferente, é um achado, me avise com a linha do terminal.
Use sempre banco de testes: vários casos apagam ou alteram mais de um registro de propósito. Marque ☐ ao executar.

**Dois defeitos achados na leitura do código, já corrigidos no motor desta versão** (valem só com o CLI desta release; com o anterior, A7 e A8 ainda mostram o defeito):
- **Operador "contém"** existia na Condição do Studio, mas o motor não o conhecia e a regra dava sempre falso (A8).
- **Vários grupos de condição:** o Studio deixa criar mais de um, mas o motor avaliava só o primeiro (A7).

### A. Condição

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| A1 | **Antes de Salvar (novo)** em Pedidos; Condição `total > 100`; ramo **verdadeiro** → Resposta **bloqueando** ("Total alto"); ramo **falso** → Resposta **permitindo** com mensagem ("Total aceito") | Salvar um pedido com total 50 e outro com 500 | 500: bloqueado com a mensagem. 50: grava e mostra "Total aceito" (na plataforma; no app exportado só a mensagem de bloqueio aparece) | ☐ |
| A2 | **Ao inserir** com Condição só com o ramo verdadeiro ligado a uma ação | Criar um registro que dá falso | Nada acontece, sem erro; a execução fica como sucesso e o CLI mostra `Condição final resultou em: false` | ☐ |
| A3 | Condições com `>=`, `<=` e `!=` sobre um campo **inteiro** | Testar o valor exatamente igual ao limite | `>=` e `<=` são verdadeiros no limite; `!=` é falso se igual | ☐ |
| A4 | Condição em campo **decimal** (`numeric`, ex.: 100.00) usando `==` com valor `100` | Salvar total 100 | **Falso**: o PostgreSQL devolve decimais como texto (`"100.00"`) e `==` compara texto. Para decimais use `>=`/`<=` (comparam como número) | ☐ |
| A5 | Grupo com 2 regras **E**: `total > 100` e `status == Pendente` | 4 combinações (total alto/baixo × Pendente/outro) | Só verdadeiro quando as duas valem | ☐ |
| A6 | Mesmo grupo com lógica **OU** | Mesmas 4 combinações | Verdadeiro quando **qualquer** uma vale | ☐ |
| A7 | **Dois ou três grupos** na mesma Condição. O E/OU entre grupos é o seletor que aparece **entre** eles no Studio | Montar G1 `total > 100` e G2 `status == Pendente`; testar com E e depois com OU entre eles; criar um 3º grupo | Os grupos se juntam **da esquerda para a direita, sem precedência**: `(G1 ou G2) e G3`. Com E: só verdadeiro se os dois valem; com OU: basta um. Um grupo **sem nenhuma regra** é ignorado | ☐ |
| A8 | Regra com operador **"contém"** | Campo texto `nome` com "Maria da Silva", valor `silva`; depois valor `joao`; depois um registro com `nome` nulo | Verdadeiro para `silva` (**não diferencia maiúsculas de minúsculas**); falso para `joao`; falso para nulo | ☐ |
| A9 | Regra `observacoes == ` (valor vazio) | Registro com `observacoes` **nulo** | **Falso**: nulo vira o texto "null" na comparação, e nunca é igual a vazio. Com `!=` de qualquer valor, é verdadeiro | ☐ |

### B. Ações

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| B1 | Ação **Atualizar** em outra tabela **sem filtro** | Disparar | Ignorada: o CLI avisa `UPDATE ignorado por falta de filtros de segurança`; nada é alterado; execução sucesso | ☐ |
| B2 | Ação **Excluir** sem filtro, e outra com filtro `id == {{pedidos.id}}` | Disparar cada uma | Sem filtro: ignorada com aviso. Com filtro: apaga só aquele registro | ☐ |
| B3 | Ação **Atualizar** com filtro que pega vários (`status == Pendente`) | Disparar com 3 Pendentes no banco | Os **3** são atualizados (não há limite de linhas) | ☐ |
| B4 | Ação **Inserir** sem nenhum campo mapeado | Disparar | Ignorada com aviso `INSERT ignorado pois não há campos mapeados` | ☐ |
| B5 | Ação **Atualizar Dados do Formulário** (mutate) num gatilho **"Ao ..."** (depois da gravação) | Disparar | **Não faz nada** (silencioso): mutate só vale em "Antes de ..." e "Ao Carregar" | ☐ |
| B6 | **Ao inserir** com 2 ações em sequência; a 1ª falha (insere em tabela com coluna obrigatória sem valor) | Criar o registro | O registro **já está gravado**; a 2ª ação **não roda**; execução marcada **erro** com a mensagem do banco | ☐ |
| B7 | **Antes de Salvar (novo)** com uma ação que falha do mesmo jeito | Salvar | A gravação é **bloqueada** com "Erro interno na execução da automação." (falha fechada: na dúvida, não grava). Nada gravado | ☐ |
| B8 | E-mail para **tabela dinâmica** com filtro que acha **2** registros | Disparar | **2 e-mails**, um por registro | ☐ |
| B9 | E-mail para tabela dinâmica com filtro que não acha nenhum | Disparar | Nenhum e-mail; aviso `Nenhum registro encontrado`; execução **sucesso** (não é erro) | ☐ |
| B10 | E-mail para tabela dinâmica, mas o campo de e-mail do registro está **vazio** | Disparar | `E-mail não enviado: Destinatário não encontrado`; execução marcada **erro** | ☐ |
| B11 | E-mail "usuários e grupos" **sem** destinatário nenhum | Disparar | Vai para o e-mail padrão do agente (`SMTP_USER`, ou `contato@metabuilderpro.com` se não houver). **Cuidado ao testar:** pode cair numa caixa que não é sua | ☐ |
| B12 | Webhook de saída com **cabeçalhos** que não são JSON válido, e outro com **corpo** que não é JSON | Disparar | Cabeçalho inválido: aviso e segue sem cabeçalhos. Corpo texto: enviado como texto puro | ☐ |

### C. Variáveis `{{tabela.campo}}`

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| C1 | E-mail com `{{pedidos.campo_que_nao_existe}}` | Disparar | O texto `{{pedidos.campo_que_nao_existe}}` sai **literal** no e-mail | ☐ |
| C2 | E-mail (ou Inserir) com `{{pedidos.observacoes}}` num registro com `observacoes` **nulo** | Disparar | Sai o texto **"null"**. No Inserir, grava a palavra `null` em coluna de texto e dá **erro** em coluna numérica ou de data. Evite variável de campo que pode ser nulo | ☐ |
| C3 | Fluxo de Pedidos usando `{{clientes.nome}}` | Disparar | O motor procura o cliente por `cliente_id` (nome da tabela sem o "s" + `_id`), depois `clientes_id`, depois `id_clientes`. Se a sua coluna tem outro nome (ex.: `id_cliente`), a variável fica **literal** | ☐ |
| C4 | Variável de uma tabela que **não é modelo do projeto** (ex.: `{{usuarios_sistema.email}}`) | Disparar | Ignorada por segurança: fica literal | ☐ |

### D. Vários fluxos e gatilhos

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| D1 | **Dois** fluxos "Ao inserir" na mesma tabela (um e-mail e um inserir em log) | Criar um registro | Os dois rodam, cada um com a **sua** execução; se um falha, o outro roda. A ordem entre eles **não é garantida** | ☐ |
| D2 | **Dois** "Antes de Salvar (novo)" na mesma tabela: um muda um campo (mutate), o outro bloqueia por condição nesse campo | Salvar | Depende da ordem (não garantida): se o que muda rodar primeiro, o outro vê o valor novo. **Se um bloquear, o outro nem roda.** Evite depender da ordem | ☐ |
| D3 | **Um** gatilho com **dois eventos** marcados (Ao inserir + Ao atualizar) | Criar e depois editar | Dispara nos dois, uma execução por evento | ☐ |
| D4 | **Dois nós de gatilho** no mesmo fluxo, ambos na mesma tabela e evento (raro) | Disparar o evento | O fluxo roda **duas vezes**, uma por nó de gatilho | ☐ |
| D5 | Um nó de ação com **duas saídas** ligadas a duas ações | Disparar | As duas rodam, na ordem das ligações | ☐ |
| D6 | Fluxo do teste 1 **desativado** | Criar um pedido; depois reativar e criar outro | Desativado: nada dispara. Reativado: volta a disparar **sem reiniciar** o CLI. Um fluxo **agendado** desativado deixa de disparar | ☐ |
| D7 | Webhook de entrada com o fluxo **desativado** | Chamar o endereço com o segredo certo | Erro, nada criado | ☐ |

### E. Agendado recorrente

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| E1 | **Recorrente**, só o **dia de hoje** marcado, horário daqui a 2 minutos | Esperar | Dispara. Com **outro** dia marcado, não dispara. Dias: 0 = domingo ... 6 = sábado | ☐ |
| E2 | Recorrente **sem nenhum dia** marcado | Esperar o horário | Dispara **todo dia** | ☐ |
| E3 | **Dois horários** no mesmo gatilho (daqui a 2 e a 3 minutos) | Esperar | Dois disparos, um por horário | ☐ |
| E4 | Mudar o horário de um fluxo agendado e salvar de novo | Esperar o horário antigo e o novo | Dispara **só** no novo: os agendamentos são refeitos ao salvar, sem duplicar | ☐ |

### F. De/Para (campo restrito) além do teste 3

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| F1 | **Ao atualizar** restrito a `status` **sem De nem Para** | Mudar o status para qualquer valor; depois editar outro campo | Dispara na mudança do status; não dispara na outra edição | ☐ |
| F2 | Restrito a `status` com **Para: Enviado** | Mudar o status de Enviado para **vazio** (ou nulo) | Não dispara (o novo valor não é Enviado) | ☐ |
| F3 | **Antes de Salvar (edição)** restrito a `status`, Para `Cancelado`, com Resposta bloqueando | Mudar um pedido para Cancelado; depois editar **outro campo** de um pedido que já está Cancelado | O primeiro é **bloqueado**; o segundo **passa** (o status não mudou) | ☐ |

### G. Quem executa

| # | Montagem | O que fazer | Esperado | ✔ |
|---|---|---|---|---|
| G1 | Repetir os testes **2 e 6** logado como **usuário comum** do app (não o desenvolvedor) | Salvar/Excluir | Mesmo bloqueio e mesma mensagem. A política do túnel só reserva ao servidor a ação de webhook de entrada; os gatilhos "Antes de..." valem para qualquer usuário que grave pela tela. **Não conferi as permissões de tabela do perfil**: se o perfil não puder gravar na tabela, o erro vem antes do fluxo | ☐ |

**Ainda fora de qualquer roteiro:** gatilhos em tabelas de **detalhe** (itens do pedido), bancos MySQL/SQL Server e Java Spring (ainda sem BPM), e o "Ao atualizar" no CLI com **Oracle** (hoje não dispara; veja "Limites que valem no vídeo").

## Repetir no app exportado

Exporte o projeto (Node + PostgreSQL ou Oracle) como descrito na Parte 2 de `docs/bpm-roteiro-testes.md` e repita no app: 1, 2, 4, 5 e 6 (mesmos efeitos; "Antes de..." mostra a mensagem no aviso vermelho), **3** (o De/Para também vale no exportado), **8** (fuso `BPM_TIMEZONE`, padrão São Paulo) e **9** (endereço `http://localhost:3000/api/bpm/webhook/<ID>`).
O histórico fica na tabela `mb_bpm_runs`.

## Limites que valem no vídeo

- **Ao Carregar Formulário (teste 7)** não existe no app exportado.
- No app exportado, e-mail para "usuários e grupos do sistema" não é resolvido (use e-mails específicos ou campo da tabela).
- **Oracle:** o gatilho "Ao atualizar" **não dispara** no CLI com tabela Oracle, hoje. O CLI só dispara depois do UPDATE quando o banco devolve a linha (`RETURNING`), o que o PostgreSQL faz e o Oracle não. No app exportado Oracle funciona. Se for gravar com Oracle, deixe o teste 3 de fora. O De/Para em si já trata colunas em maiúsculas.
- Variáveis `{{tabela.campo}}` em tabelas Oracle dependem da caixa dos nomes das colunas (o Oracle devolve em maiúsculas): confira antes de gravar.
- O app exportado é um retrato dos fluxos: muda só ao exportar ou sincronizar de novo.

## Como me passar o resultado

Para cada teste que falhar: o número, o que você fez, o que esperava, o que aconteceu e a linha do terminal do CLI (sem senhas).
