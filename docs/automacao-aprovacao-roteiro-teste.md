# Aguardar aprovação: roteiro de testes (27/11/2026)

Testa o bloco **"Aguardar aprovação"** da Automação de processos (Etapas B e C): pedido de aprovação, tela **Minhas tarefas**, histórico no registro e lembretes.
Marque cada item e me mande o que falhar, com a tela e o terminal do CLI.

## O que já foi verificado por mim (sem navegador seu, sem CLI real)

- `tsc`, `npm test` (2096 testes) e `npm run build` limpos.
- Motor com banco de mentira: pausa do fluxo, decisão e retomada pelas duas saídas, só a primeira decisão vale, perfil só vale se assinado pelo servidor, quem pediu não aprova o próprio pedido (salvo opção), fluxo apagado depois do pedido, listas e histórico, cancelamento, prazo e lembretes (até 3, dois agentes ao mesmo tempo mandam um só), agendamento do varredor.
- Servidor: validação do pedido, ator e perfis vindos só da sessão (o corpo é ignorado), anônimo recusado, operações de administração só do membro, histórico só de tabela cadastrada e aberta.
- Os testes antigos do motor (75 de conformidade) continuam passando sem mudança.

## O que **não** foi testado (é o objetivo deste roteiro)

CLI real contra um banco, as telas no navegador, e-mail pelo SMTP, **Oracle** (o motor do CLI só liga em PostgreSQL), app ejetado (não leva aprovação) e projeto com várias conexões de banco.

---

## Preparação

1. Use um projeto de teste **PostgreSQL** com login de usuários do app e pelo menos **dois perfis** (ex.: *Vendas* e *Gerente*), com um usuário em cada, **mais um terceiro usuário de *Vendas***.
2. Rode o CLI do código novo: `cd cli; node index.js` (o `.exe` só pega a mudança depois de `npm run build` dentro de `cli/`). Acompanhe as linhas `[BPM] ...` e `[ OK ] approval_...`.
3. No Studio (Automação de processos), monte e **publique** este fluxo de teste na tabela *Pedidos*:

```
[Gatilho: Ao criar Pedidos]
   → [Aguardar aprovação: perfil Gerente | título "Pedido {{pedidos.id}} aguarda aprovação"]
        ├─ Aprovado  → [E-mail ao solicitante: "Aprovado por {{aprovacao.por}}: {{aprovacao.comentario}}"]
        └─ Rejeitado → [E-mail ao solicitante: "Rejeitado: {{aprovacao.comentario}}"]
```

4. Entre no app publicado como o usuário de **Vendas** (o solicitante).

## Parte 1: pedido e decisão

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 1.1 | Criar um pedido como Vendas | O pedido é salvo normalmente; o terminal mostra a aprovação pedida; **nenhum** dos dois e-mails (Aprovado/Rejeitado) sai | ☐ |
| 1.2 | Conferir o e-mail do Gerente | Chegou "Aprovação pendente: Pedido N aguarda aprovação" | ☐ |
| 1.3 | Ainda como Vendas: o cabeçalho do app | Aparece o atalho **Minhas tarefas** | ☐ |
| 1.4 | Abrir **Minhas tarefas** como Vendas | Aba "A decidir" vazia; em "Meus pedidos" o pedido aparece como **Pendente** | ☐ |
| 1.5 | Como o **terceiro usuário de Vendas**, abrir "A decidir" | Vazio (não é aprovador) | ☐ |
| 1.6 | Sair e entrar como **Gerente**; abrir Minhas tarefas | A tarefa aparece em "A decidir"; ao clicar mostra o registro e o histórico (*Aprovação pedida*) | ☐ |
| 1.7 | Tentar **Rejeitar** sem comentário | Pede o motivo e não rejeita | ☐ |
| 1.8 | **Aprovar** com comentário "Tudo certo" | Mensagem "Aprovado."; a tarefa sai de "A decidir" e vai para "Que decidi"; o e-mail ao solicitante chega com "Aprovado por [nome do Gerente]: Tudo certo" | ☐ |
| 1.9 | Criar outro pedido como Vendas e **rejeitar** como Gerente, com motivo | Só o e-mail de **Rejeitado** sai, com o motivo | ☐ |
| 1.10 | Abrir o pedido (formulário) e clicar em **Histórico de aprovações** | Mostra *Aprovação pedida* e *Aprovado* (ou *Rejeitado*) com nome, data e comentário | ☐ |
| 1.11 | Em um app **sem** o bloco de aprovação (ou despublicando o fluxo de teste) | O atalho "Minhas tarefas" e o botão de histórico **não** aparecem | ☐ |

## Parte 2: regras e segurança

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 2.1 | Criar um pedido com um usuário que é **Gerente e solicitante ao mesmo tempo** (ou marque o gerente como criador) | A tarefa **não** aparece em "A decidir" dele; nenhum outro Gerente fica sem ver | ☐ |
| 2.2 | Marcar "Quem pediu também pode aprovar o próprio pedido" no bloco, republicar e repetir 2.1 | Agora ele pode aprovar | ☐ |
| 2.3 | Com duas abas de Gerentes diferentes abertas na mesma tarefa, aprovar numa e tentar rejeitar na outra | A segunda recebe "Esta tarefa já foi decidida" | ☐ |
| 2.4 | Como dono do projeto (login do MetaBuilder) entrando em `/approvals` | Aparece a aba **Todas (administrador)**; abrir uma tarefa pendente mostra **Cancelar tarefa** | ☐ |
| 2.5 | Cancelar uma tarefa pendente; depois tentar aprovar como Gerente | A tarefa vira Cancelada; aprovar dá "já foi decidida"; o fluxo **não** continua | ☐ |
| 2.6 | Despublicar o fluxo (ou remover o bloco) com uma tarefa pendente e aprovar | A decisão é registrada e aparece o aviso de que o fluxo foi alterado e não continuou | ☐ |
| 2.7 | Sem login (janela anônima) abrir `/approvals` | Não mostra tarefa alguma (pede entrada no app) | ☐ |
| 2.8 | Fluxo com **Antes de criar** + bloco de aprovação | O pedido é salvo; o terminal/histórico de execuções registra o erro "não funciona em Antes de salvar"; nenhuma tarefa criada | ☐ |
| 2.9 | Bloco sem aprovador escolhido | Execução com erro "sem aprovador definido"; nenhuma tarefa criada | ☐ |

## Parte 3: prazo e lembretes (Etapa C)

No bloco, coloque **Lembrar após = 1 hora** e **Repetir a cada = 1 hora**, republique e crie um pedido. (Para não esperar horas, ajuste `due_at` da tarefa no banco do cliente: `UPDATE mb_approval_tasks SET due_at = '2020-01-01T00:00:00.000Z' WHERE status = 'pending';` e espere até 15 minutos, ou reinicie o CLI e aguarde o próximo ciclo.)

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 3.1 | Esperar o ciclo do varredor depois de vencer o prazo | Chega ao Gerente "Lembrete: aprovação pendente: ..."; no histórico do registro aparece **Lembrete enviado** | ☐ |
| 3.2 | Repetir o `UPDATE` do `due_at` mais duas vezes (um por vez) | Chegam o 2º e o 3º lembretes | ☐ |
| 3.3 | Repetir uma 4ª vez | **Não** chega mais lembrete (máximo de 3) | ☐ |
| 3.4 | Bloco com **Lembrar após** e **sem** "Repetir" | Só 1 lembrete | ☐ |
| 3.5 | Aprovar uma tarefa que já tinha prazo vencido, antes do varredor rodar | Nenhum lembrete é enviado depois da decisão | ☐ |
| 3.6 | Bloco **sem** "Lembrar após" | Nenhum lembrete, nunca | ☐ |

## Parte 4: banco e compatibilidade

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 4.1 | No banco do cliente, conferir as tabelas `mb_approval_tasks` e `mb_approval_history` | Criadas na 1ª aprovação; sem senha ou token no `record_snapshot` | ☐ |
| 4.2 | Usuário do banco **sem permissão de criar tabela** (se tiver como simular) | A execução registra erro com a instrução de rodar o script; o **script aparece no console do Agente**; `scripts/mb-approvals.sql` é o mesmo | ☐ |
| 4.3 | Rodar os itens de gatilhos, consulta, e-mail e agendamento de `bpm-roteiro-testes.md` (1.1 a 1.13) | Continuam como estavam (nada mudou fora do bloco novo) | ☐ |
| 4.4 | Exportar um app que tenha fluxo com o bloco de aprovação | O app ejetado gera e roda; o bloco **não** funciona lá (para com aviso). Isso é esperado | ☐ |

## Sobre a ordem de publicação

O protocolo do túnel mudou: publique a **release da IDE (CLI) primeiro** e só depois o deploy do servidor. Sem o CLI novo, o editor deixa montar o bloco, mas o CLI antigo trataria um fluxo com ele como um nó qualquer e seguiria as duas saídas.
