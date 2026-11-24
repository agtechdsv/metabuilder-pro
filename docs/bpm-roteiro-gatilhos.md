# Roteiro: 1 teste para cada gatilho do BPM (versão revisada, 24/11/2026)

São 9 gatilhos no painel, e cada um tem um teste abaixo, ligado a um item do seu plano de vídeos. Os nomes de campos e de nós foram tirados do código, mas **nenhum fluxo foi executado**: confira os nomes reais das colunas das suas tabelas (`titulo`, `status` etc.) e faça um ensaio antes de gravar.

Este roteiro cobre **o que cada gatilho faz na plataforma** (com o CLI). O roteiro de conferência técnica, incluindo o **app exportado**, é o `docs/bpm-roteiro-testes.md`. Os testes 1, 2, 3, 4, 5, 6, 8 e 9 abaixo também valem no app exportado (veja "Repetir no app exportado", no fim).

## O que mudou em relação à versão anterior

- **Teste 3 (Ao atualizar com "Restringir a um campo", De/Para) foi consertado no motor.** Antes, a restrição só existia na tela: o motor ignorava e disparava em toda edição. Agora o motor lê o registro **como era antes da edição** e só dispara se o campo mudou (e, se informados, se o valor anterior confere com o **De** e o novo com o **Para**). **Esta correção só existe a partir do CLI desta versão**: com a IDE/CLI da release anterior, o teste 3 ainda falha do jeito antigo.
- **Teste 8:** o agendamento "uma vez" repete no mesmo dia do ano seguinte (limitação do motor, dentro do roteiro).
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

## 1. Ao inserir · Pedidos (item 3)
**Objetivo:** o cliente recebe um e-mail de confirmação ao criar um pedido.
1. Fluxo "Confirmação de Pedido". Gatilho: **Ao inserir**, tabela **Pedidos**.
2. Ação **Enviar e-mail**: destinatário **Tabela dinâmica**, tabela **Clientes**, campo `email_contato`, filtro `id` igual a `{{pedidos.cliente_id}}`.
3. Assunto `Pedido #{{pedidos.id}} recebido`. Corpo com `{{pedidos.status}}` e `{{pedidos.data_pedido}}`.
4. Salve e ative. Crie um pedido para o cliente de teste.

**Resultado:** o e-mail chega na sua caixa. Não use o valor total no e-mail: em mestre-detalhe os itens ainda não existem nesse momento.

## 2. Antes de Salvar (novo) · Pedidos (item 3)
**Objetivo:** barrar um pedido que já nasce cancelado.
1. Gatilho: **Antes de Salvar (Novo)**, tabela **Pedidos**.
2. **Condição:** `status` `==` `Cancelado`. No ramo **verdadeiro**, ligue um nó de **Resposta** com a ação **bloqueada** e a mensagem "Um novo pedido não pode começar como Cancelado".
3. Tente salvar um novo pedido com status Cancelado.

**Resultado:** aparece a mensagem de erro e **nada é gravado**. Em seguida salve com status Pendente e mostre que passa.

## 3. Ao atualizar · Pedidos (itens 3 e 6) — **De/Para corrigido nesta versão**
**Objetivo:** avisar o cliente só quando o pedido **virar** "Enviado".
1. Gatilho: **Ao atualizar**, tabela **Pedidos**. Marque **Restringir a um campo**: campo `status`, **De:** (vazio), **Para:** `Enviado`.
2. Ação **Enviar e-mail** igual à do teste 1, com assunto "Seu pedido #{{pedidos.id}} foi enviado".
3. Edite um pedido Pendente e mude o status para Enviado.
4. Edite o **mesmo** pedido de novo, mexendo só em outro campo (status continua Enviado).
5. Opcional, para mostrar o **De**: preencha **De:** `Pendente`, salve o fluxo, mude um pedido **Aberto** para Enviado (não dispara) e depois um **Pendente** para Enviado (dispara).

**Resultado:** o e-mail sai na mudança para Enviado e **não sai** na segunda edição (o status não mudou). No CLI, quando não dispara, a linha `[BPM] Disparando fluxo...` não aparece.

**Regras do campo restrito (para explicar no vídeo):**
- Com a restrição ligada, o gatilho só vale quando **o campo mudou**. Sem informar De nem Para, dispara em qualquer mudança dele.
- **De** vazio = qualquer valor anterior; **Para** vazio = qualquer valor novo.
- Número do banco e texto digitado são iguais (`5.00` e `5`).
- Se o motor não conseguir ler o registro anterior, ele **não dispara** e avisa no terminal do CLI (falha segura, para não mandar e-mail errado).
- Também vale para **Antes de Salvar (edição)**: o painel mostra a restrição nos dois gatilhos de edição.

## 4. Antes de Salvar (edição) · Pedidos (item 3)
**Objetivo:** pedido entregue não pode mais ser alterado.
1. Gatilho: **Antes de Salvar (Edição)**, tabela **Pedidos**.
2. **Condição:** `status` `==` `Entregue`, ramo verdadeiro com **Resposta** bloqueando: "Pedido entregue não pode ser editado".
3. Abra um pedido Entregue, altere qualquer campo e salve.

**Resultado:** a edição é barrada. A condição avalia os dados do formulário, então mudar o status para outro valor passa. Isso é útil para explicar o comportamento no vídeo.

## 5. Ao excluir · Pedidos (item 3)
**Objetivo:** avisar o gestor quando um pedido for apagado.
1. Gatilho: **Ao excluir**, tabela **Pedidos**.
2. Ação **Enviar e-mail**, aba Grupos/Usuários, em **e-mails específicos** o seu endereço. Assunto "Pedido #{{pedidos.id}} excluído".
3. Exclua um pedido de teste pela grid.

**Resultado:** o e-mail chega depois da exclusão, com os dados do registro apagado.

**Atenção:** no PostgreSQL o fluxo recebe a linha inteira que foi apagada. No Oracle recebe só o `id`, então use apenas `{{pedidos.id}}` ali.

## 6. Antes de Excluir · Pedidos (item 3)
**Objetivo:** pedido enviado não pode ser excluído.
1. Gatilho: **Antes de Excluir**, tabela **Pedidos**.
2. **Condição:** `status` `==` `Enviado`, ramo verdadeiro com **Resposta** bloqueando: "Pedido enviado não pode ser excluído".
3. Tente excluir um pedido Enviado. Depois exclua um Pendente.

**Resultado:** o primeiro é barrado e continua na grid. O segundo é apagado normalmente. O CLI lê o registro antes de apagar, e o bloqueio vale em qualquer tela que exclua pedidos.

## 7. Ao Carregar Formulário · Pedidos (item 3)
**Objetivo:** todo pedido novo já abre com status "Pendente".
1. Gatilho: **Ao Carregar Formulário**, tabela **Pedidos**.
2. Ação **Atualizar Dados do Formulário**: campo `status` com valor `Pendente`.
3. Clique em **Novo** pedido.

**Resultado:** o campo status já vem preenchido, antes de o usuário digitar.

**Atenção:** o fluxo roda também ao **abrir um pedido para editar** e sobrescreveria o status. Grave só a criação, ou use uma Resposta com mensagem de aviso no lugar da alteração. Este gatilho **não vai para o app exportado** (o selo do Studio avisa).

## 8. Agendado · Clientes (item 4)
**Objetivo:** receber um resumo por e-mail num horário marcado.
1. Gatilho: **Agendado**. Para o vídeo use o tipo **uma vez** e uma data e hora **2 minutos à frente**. O horário vale pelo relógio da máquina onde o CLI roda.
2. Ação **Enviar e-mail**, em **e-mails específicos** o seu endereço, assunto "Resumo diário do MetaBuilder".
3. Salve e ative. Espere o horário com a janela do CLI aberta.

**Resultado:** aparece `⏰ Agendamento disparado` no CLI e o e-mail chega. A execução também fica registrada no histórico de automações (origem "agendamento").

**Atenção:**
- O fluxo agendado roda **sem dados de registro**. Não use `{{pedidos.campo}}` nem destinatário por tabela dinâmica.
- O tipo **uma vez** não é uma vez só: o motor agenda "dia e hora de todo ano", então repete no **mesmo dia do ano seguinte**. Depois de gravar, desative o fluxo ou apague-o. Para o uso real, troque por **recorrente** (dias da semana e horário).

## 9. Webhook de entrada · Tarefas (item 7)
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
