# Roteiro: 1 teste para cada gatilho do BPM (versão revisada, 24/11/2026)

São 9 gatilhos no painel, e cada um tem um teste abaixo, ligado a um item do seu plano de vídeos. Os nomes de campos e de nós foram tirados do código, mas **nenhum fluxo foi executado**: confira os nomes reais das colunas das suas tabelas (`titulo`, `status` etc.) e faça um ensaio antes de gravar.

Este roteiro cobre **o que cada gatilho faz na plataforma** (com o CLI). O roteiro de conferência técnica, incluindo o **app exportado**, é o `docs/bpm-roteiro-testes.md`. Os testes 1, 2, 3, 4, 5, 6, 8 e 9 abaixo também valem no app exportado (veja "Repetir no app exportado", no fim).

## O que mudou em relação à versão anterior

- **Teste 3 (Ao atualizar com "Restringir a um campo", De/Para) foi consertado no motor.** Antes, a restrição só existia na tela: o motor ignorava e disparava em toda edição. Agora o motor lê o registro **como era antes da edição** e só dispara se o campo mudou (e, se informados, se o valor anterior confere com o **De** e o novo com o **Para**). **Esta correção só existe a partir do CLI desta versão**: com a IDE/CLI da release anterior, o teste 3 ainda falha do jeito antigo.
- **Teste 8:** o agendamento "uma vez" repete no mesmo dia do ano seguinte (limitação do motor, dentro do roteiro).
- **Teste 5:** removida a referência à correção de outra conversa.
- **Teste 9:** completo, com o comando, os casos de recusa e o resultado esperado.
- Acréscimos: "Repetir no app exportado" e "Limites que valem no vídeo".

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
