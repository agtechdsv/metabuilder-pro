# Roteiro de testes — ciclo de segurança (2026-10-09)

Marque `[x]` o que passou. Em qualquer falha, anote: **tela, o que esperava, o que aconteceu** e, se houver, as linhas
`[ SQL ]` / `[ ERRO ]` do console do CLI e o log da Vercel (`[tunnel/guard]`).

Cenário: projeto **Vendas PG** (Postgres) e, onde indicado, **Vendas ORA** (Oracle). Usuários finais de teste: **Maria** e **João**
(perfil Funcionária) e **Mariana** (Gerente). Navegadores: IDE (você como Quilla, desenvolvedor) e **Chrome** (usuário final).

## 0. Preparação (ordem obrigatória)
- [ ] Commit e push feitos.
- [ ] **1º** gerar a release da IDE (CLI **1.3.2**) e atualizar a IDE. **2º** deploy do app na Vercel.
- [ ] (Só se o app foi ao ar antes da IDE) `TUNNEL_COMMAND_TOPIC=public` na Vercel; remover depois.
- [ ] Console do CLI mostra: `comandos em tópico privado: ativos` e `acesso por tabela do usuário final: ativo`.
- [ ] Migrações do Supabase aplicadas (RLS + correção do gatilho) — já feito.
- [ ] Opcional: migração `models.audit_config` (só se quiser trocar os nomes das colunas de auditoria no Studio).

## 1. Conexão
- [ ] Studio → Configurações de Bancos → **Testar conexão pelo servidor**: "respondeu em N ms a um comando assinado".
- [ ] Na mesma tela aparece o aviso do **usuário do banco**: verde (privilégio mínimo) ou amarelo/vermelho com os motivos
      (esperado amarelo no seu banco de teste: dono das tabelas).
- [ ] O card **Usuário do banco com privilégio mínimo** gera o script (Postgres) e o botão Copiar funciona.

## 2. Fumaça: nada quebrou (sem nenhuma regra ligada)
- [ ] Studio: abrir o projeto, abrir um caso de uso, **salvar** um caso de uso, abrir **Configurar Login**.
- [ ] Chrome como Maria: login, abrir Clientes, Pedidos, Produtos; criar, editar e pesquisar um registro.
- [ ] Editar o **próprio perfil** (nome/avatar) e as configurações de segurança do perfil: salva sem erro.
- [ ] Exportar uma lista (Excel/CSV) e abrir na Central de Downloads; baixar o arquivo.

## 3. BI no servidor
- [ ] Painel BI como Maria: indicadores carregam. Como dev na IDE: botões Organizar/lápis/lixeira aparecem; como Maria, **não**.
- [ ] Console do F12 (Chrome, Maria): pedidos do BI **não** levam SQL (só widget/filtros).
- [ ] Editar o cookie `mb_eu_<projeto>` (apagar um caractere) e recarregar: volta para o login / 401.

## 4. Auditoria (criado/atualizado em/por)
- [ ] Chrome como Maria cria um cliente: `criado_por`, `criado_em`, `atualizado_por`, `atualizado_em` preenchidos (id da Maria).
- [ ] Maria edita: só `atualizado_*` muda; `criado_*` permanece.
- [ ] Na IDE (dev), editar: **datas** mudam (gatilho do banco) e `*_por` **não** é preenchido (esperado: o dev não é usuário do cliente).
- [ ] IDE → navegador interno **logada como Maria**: agora vale a Maria (preenche `criado_por`, aplica regra por linha).
- [ ] Repetir a criação no Oracle (Vendas ORA).
- [ ] Gestão de usuários: formulário de criar/editar usuário **não mostra** as colunas de auditoria.

## 5. Permissões por tabela
- [ ] Dados & Schemas → Clientes → desmarcar **Permitir Exclusão**: Maria tenta excluir → recusado com mensagem; marcar de volta → exclui.
- [ ] Idem para **Permitir Criação** e **Permitir Edição**.

## 6. Regra por linha (usuário final)
- [ ] Regra em Clientes: `criado_por` = id do usuário (atalho "Só os registros que eu criei").
- [ ] Maria vê **só** os que ela criou; João vê os dele; Mariana (com **exceção** por perfil/e-mail) vê tudo.
- [ ] Exportação como Maria traz só as linhas dela.
- [ ] O BI como Maria respeita a mesma regra.
- [ ] Maria tenta gravar um registro com `criado_por` de outro (F12): o servidor ignora e grava o dela.
- [ ] (Esperado) registros antigos sem `criado_por` ficam invisíveis para quem só vê "os que criou".

## 7. Bloquear tabelas por padrão (novo)
- [ ] Configurar Login → Controle de acesso: ligar **Bloquear tabelas por padrão**, liberar só Clientes e Produtos, **Salvar alterações**.
- [ ] Aguardar até 15 s. Maria: Clientes e Produtos funcionam; Pedidos aparece **vazio** e não grava.
- [ ] Liberar Pedidos, salvar: volta a funcionar. Desligar o modo: tudo aberto de novo.

## 8. Sessão revogada (novo)
- [ ] Maria logada no Chrome. No banco/Studio, **excluir** (ou marcar `ativo = false`) a Maria.
- [ ] Em até ~2 minutos qualquer ação dela dá 401/volta ao login. Reativar a Maria no banco: volta a entrar após ~1 min.
- [ ] Tentar logar como usuário com `ativo = false`: recusado.

## 9. Exclusão e cascata
- [ ] Excluir um usuário que tem perfil atribuído: exclui (perfis removidos antes) e o aviso só aparece **depois** do banco confirmar.
- [ ] Excluir cliente com pedidos **sem** cascata: mensagem "está sendo usado em: Pedidos" (nome da tabela).
- [ ] Caso de uso com **Em cascata**: o modal lista os filhos e as quantidades ("Pedidos 3, Itens 7") antes de confirmar; confirma e apaga.

## 10. Segurança do túnel (F12 no Chrome, como Maria)
- [ ] Script dos 4 testes (`/api/tunnel/send`): controle = **202**; tabela fora do projeto, coluna de senha e DELETE num select = **403**.
- [ ] Mesmo script com o **`SELECT query_to_xml('select * from pedidos', true, true, '')`** (Postgres): **403** (ou erro do CLI), nunca dados.
- [ ] Console do CLI, ao receber comando forjado: `[ BLOQUEADO ]`.
- [ ] Escutar `tunnel:<id>` com a chave pública: **nenhum comando** passa por lá.

## 11. App exportado (Postgres e Oracle)
- [ ] Exportar o Vendas PG, rodar, logar: regra por linha e permissões valem; auditoria preenche.
- [ ] Com "bloquear por padrão" ligado, a tabela não liberada responde vazia no exportado.
- [ ] `/api/ai-db` sem permissão / de tabela fechada: **403**.
- [ ] Repetir no Oracle (Vendas ORA).
- [ ] Exportar com backend Java: sai o aviso/erro correto (sem regras por linha) e a chave JWT é única.

## 12. Supabase (SQL Editor)
- [ ] Visitante anônimo vê **0 linhas** nas tabelas de configuração (já passou).
- [ ] Conta comum **não** vira super admin nem muda o status do plano; edição do próprio perfil funciona (já passou).
- [ ] Studio com a conta de desenvolvedor segue salvando casos de uso, papéis e configurações (RLS por projeto).
- [ ] Central de Downloads do admin (super admin) lista e envia instaladores.

## 13. Outros
- [ ] `/api/automations/email` com token errado 11 vezes seguidas: passa a responder **429**.
- [ ] Painel de Downloads: o andamento da exportação continua atualizando (agora só pelo banco).
- [ ] `npm audit --omit=dev`: só `xlsx` (sem correção; não lê arquivos) e itens baixos.

## Pendências conhecidas (não testar agora)
Separar colunas sensíveis de `profiles`; leaked password protection no Auth; teste de invasão com alguém de fora; SQL montado
no servidor; Oracle com usuário restrito (sincronização de metadados).
