# Teste de estresse de esquema

Objetivo: provar que os casos de uso funcionam com tabelas, campos e relações que **não seguem nenhuma convenção**.

## Como usar
1. Rode `postgres.sql` (ou `oracle.sql`) num banco de **teste**.
2. Cadastre o banco como projeto no MetaBuilder e importe as tabelas (Santo Graal lê as FKs).
3. Monte os casos de uso abaixo e confira os resultados esperados.
4. Abra o console do navegador: **não** deve aparecer `[MetaBuilder] ... INFERIDA pelo nome`
   (se aparecer, a relação não está declarada/lida dos metadados).

Teste automatizado do resolvedor (sem banco): `npx tsx scripts/schema-resolver.test.ts`

## O que o esquema tem de "estranho"
| Item | Por quê |
|---|---|
| PK `CODIGO`, `NUM_PED`, `SEQ` | nenhuma é `id` |
| FK `COD_PED`, `CLI_COBRANCA`, `CLI_ENTREGA` | não seguem `tabela_id` |
| **duas FKs** `TB_PED → TB_CLI` | ambiguidade: o caso de uso deve escolher |
| `TB_SEM_REL` | sem PK e sem relação: nada deve ser inventado |
| nomes em CAIXA ALTA | Oracle devolve colunas em maiúsculas |

## Casos de uso para montar e o esperado
1. **Mestre-detalhe-subdetalhe** `TB_CLI → TB_PED → TB_PED_ITM`: abrir cliente 10 mostra pedidos 1001 e 1002; "Expandir Tudo" mostra os itens (1001: 2 itens, 1002: 1 item).
2. **Criar pedido novo + item novo no mesmo formulário e salvar**: o item deve ficar com `COD_PED` do pedido gerado (nenhum erro de chave estrangeira).
3. **"Abrir Modal" de item em pedido ainda não salvo**: abre a modal local; o item entra na lista do pedido; nada é gravado até salvar.
4. **Excluir** um pedido/item: a confirmação mostra o texto da `RAZAO_SOCIAL`/`DESCR_ITEM` (primeiro campo textual), não "undefined" nem JSON.
5. **Personalizado**: abas e subabas (grupo) com `TB_PED` filtrado pelo cliente mestre.
6. **Kanban** por `STATUS_PED`, **Timeline** por `DT_PED`, **Dashboard** somando `QTD * VLR_UNIT`.
7. **Duas FKs**: um caso de uso `TB_CLI → TB_PED` por `CLI_ENTREGA` e outro por `CLI_COBRANCA` devem listar pedidos diferentes (cliente 10: entrega = 1002; cobrança = 1001 e 1002).
8. **`TB_SEM_REL`** como cadastro simples: listar/criar/editar sem erro; tentar usá-la como filha de `TB_PED` deve mostrar a mensagem *"Relação ... não configurada"*.
