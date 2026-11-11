# Checklist dos tours que faltam (portal, abas do Studio, barra lateral, IDE Local e Ejetar)

Como usar:
- **Feito** `[x]`: marcado por mim quando o tour/passo está codado e passou em `tsc` e nos testes (1373 testes).
- **Testado** `☑`: você marca depois de testar no navegador ou na IDE. Começa em `☐`.
- 🖥 = função exclusiva da IDE Desktop. No site o passo aparece com o aviso "Disponível só na IDE Desktop" (decisão confirmada: mostrar com aviso) e o ícone nunca é clicável pelo tour.
- Itens com ⏳ ficaram para depois (motivo na linha).

Legenda de cada linha: `- [ ] Feito · ☐ Testado · item`

---

## Onde abrir cada tour
| Tour | Onde abrir |
|---|---|
| Workspaces | `/workspace`, ícone **?** do cabeçalho (agora também nesta tela) |
| Projetos do workspace | `/admin/<workspace>`, ícone **?** |
| Abas do Studio (Navegação, Enums, Túnel, Bancos Sincronizados, Central de Ajuda) e Barra lateral | Studio do projeto, ícone **?** (cada tour abre a própria aba sozinho) |
| BYOC, Bancos (JSON), Terminal, SQL Studio | em cada página, ícone **?** (só abrem na IDE Desktop) |
| IDE Local (visão geral, Git) e Ejetar & Sincronizar | dentro da IDE Local, ícone **?** novo no cabeçalho da IDE (ao lado de Minimizar) |

Os ícones só aparecem ao passar o mouse sobre o cartão; durante o tour eles ficam visíveis sozinhos.

---

## 0. Base do motor de tours
- [x] Feito · ☑ Testado · Marca de passo "exclusivo da IDE" (`ideOnly`): no site mostra o aviso e não deixa clicar; na IDE também só mostra
- [x] Feito · ☑ Testado · Teste unitário da marca e do aviso
- [x] Feito · ☑ Testado · Texto padrão do aviso "Disponível só na IDE Desktop" nos 3 idiomas
- [x] Feito · ☑ Testado · Ícone **?** na tela de workspaces (`/workspace`), que antes não tinha ajuda

## A. Portal inicial (workspaces e projetos)
### A1. Workspaces (tour "Workspaces: visão geral")
- [x] Feito · ☑ Testado · Tela "Seus Workspaces": o que é, equipe, novo workspace, contadores, atualizar
- [x] Feito · ☑ Testado · Cartão do workspace: nome, slug, nº de projetos, botão de entrar (`>`)
- [x] Feito · ☑ Testado · Ícone abrir / Acessar Portal (↗)
- [x] Feito · ☑ Testado · 🖥 Ícone da tela = Gerar App Desktop Nativo
- [x] Feito · ☑ Testado · 🖥 Ícone da pasta = IDE Local (Sincronizar)
- [x] Feito · ☑ Testado · Ícone editar workspace
- [x] Feito · ☑ Testado · Ícone excluir workspace (avisa que a exclusão não volta)
- [x] Feito · ☑ Testado · Ícone Configurações de IA (só dono PRO) e cartão pontilhado de novo workspace
- [x] Feito · ☑ Testado · Personalizar Portal: logo e banner do login global (passos da janela, no tour dos projetos; só aparece com projeto no portal)

### A2. Projetos (tour "Projetos do workspace: visão geral")
- [x] Feito · ☑ Testado · Tela de projetos: banner, novo projeto, abas (Seus Projetos; Túnel e Bancos só na IDE)
- [x] Feito · ☑ Testado · Cartão do projeto: selo Ativo/Inativo e "Sincronização pendente", nº de tabelas, casos de uso, botão de entrar
- [x] Feito · ☑ Testado · Ícone "Acessar versão publicada"
- [x] Feito · ☑ Testado · 🖥 Ícone "Gerar App Desktop Nativo"
- [x] Feito · ☑ Testado · 🖥 Ícone "IDE Local (Ejetar & Sincronizar)"
- [x] Feito · ☑ Testado · 🖥 Ícone Ambiente de Testes (só aparece na IDE, com app sincronizado)
- [x] Feito · ☑ Testado · Ícone de banco de dados = Adicionar/Remover do Portal
- [x] Feito · ☑ Testado · Ícone Desativar / Ativar projeto
- [x] Feito · ☑ Testado · Ícone Editar projeto
- [x] Feito · ☑ Testado · Ícone Excluir projeto (avisa que a exclusão não volta)

### A3. Ícones desativados por papel e cliques livres no portal (novo, 2026-11-11)
Teste com **dois usuários**: o dono e um dev do dono. Os dois devem ver **os mesmos ícones**; para o dev, o que ele não pode fazer aparece apagado, com o motivo no tooltip. Nenhum passo é pulado por falta de permissão.
- [x] Feito · ☑ Testado · Cartão do workspace, dev: ícones IDE Local, Editar, Excluir e IA aparecem desativados (tooltip diz o motivo)
- [x] Feito · ☑ Testado · Cartão do workspace: "Acessar Portal" aparece desativado enquanto nenhum projeto do workspace está no portal
- [x] Feito · ☑ Testado · Cartão do projeto, dev: IDE Local, Ambiente de Testes (só na IDE), Ativar/Desativar, Editar e Excluir desativados
- [x] Feito · ☑ Testado · Tour dos workspaces com o dev: percorre os 14 passos sem pular o da IA (destaca o ícone desativado)
- [x] Feito · ☑ Testado · Cliques livres nos dois tours: dá para clicar no ícone destacado (Novo, Editar, Excluir, Acessar, IA, Personalizar portal...) e a janela abre; o balão vai para o canto
- [x] Feito · ☑ Testado · "Sim, excluir" do workspace e do projeto nunca respondem durante o tour, e a janela de exclusão é fechada ao terminar
- [x] Feito · ☑ Testado · Passos só de leitura (não deixam clicar): entrar no cartão/Studio, Ativar/Desativar, Adicionar/Remover do Portal, 🖥 ícones da IDE
- [x] Feito · ☑ Testado · Painéis laterais (Novo/Editar workspace e projeto) contam como janela do tour: dá para preencher e fechar sem o tour atrapalhar
- ⚠ Ainda fora do tour livre: o botão "Salvar" do portal é bloqueado de propósito; o "Salvar" dos painéis Novo/Editar não é (se você salvar, grava de verdade).

### A4. Ajustes pedidos após o teste do A3 (novo, 2026-11-11)
- [x] Feito · ☑ Testado · Tour dos projetos: ao clicar em "Personalizar portal" (passo 4), os passos da janela (Configurações, Logo, Banner, Salvar/Cancelar) vêm na sequência; ao avançar a janela fecha sozinha e, ao voltar, reabre. Sem clique seu, o tour abre a janela por você
- [x] Feito · ☑ Testado · 🖥 Na IDE, o ícone "Gerar App Desktop Nativo" (workspace e projeto) abre a janela ao clicar; "Gerar Instalador" nunca responde e a janela fecha ao terminar o tour. No site continua só mostrando
- [x] Feito · ☑ Testado · 🖥 Workspaces: tours "Gerenciador do Túnel" e "Bancos Sincronizados" (abrem a aba sozinhos; só no menu da IDE)
- [x] Feito · ☑ Testado · 🖥 Projetos do workspace: tours "Gerenciador do Túnel" e "Bancos Sincronizados" (idem)
- [x] Feito · ☑ Testado · 🖥 Ambiente de Testes (projetos): na IDE o ícone abre a janela; dentro dela só funcionam as abas, Recolher/Expandir e fechar (executar, criar cópia, apagar etc. são ignorados durante o tour); a janela fecha ao terminar o tour
- ⚠ A IDE Local (🖥) continua só mostrando: abre uma tela inteira que o tour não controla.

## B. Abas do Studio
- [x] Feito · ☑ Testado · Navegação: gerador de menu (arrastar, ícone, nome, o que abre, dashboard, remover, adicionar link/pasta, salvar)
- [x] Feito · ☑ Testado · Enums: Importar, Novo Enum, cartão, editar, excluir
- [x] Feito · ☑ Testado · 🖥 Gerenciador do Túnel (no site: aviso e botão de baixar; na IDE: configurar, estado, iniciar, parar, logs, sincronizar)
- [x] Feito · ☑ Testado · Bancos Sincronizados: schemas, renomear, excluir (destrutivo)
- [x] Feito · ☑ Testado · Central de Ajuda: escolher o caso de uso, ver a Central do app
- [x] Feito · ☑ Testado · Central de Ajuda, Ajuda textual
- [x] Feito · ☑ Testado · Central de Ajuda, Ajuda interativa (gravar, regenerar, excluir, ordem)
- [x] Feito · ☑ Testado · Central de Ajuda, Feedback
- [x] Feito · ☑ Testado · Central de Ajuda, salvar

## C. Barra lateral (ferramentas)
- [x] Feito · ☑ Testado · Tour "Barra lateral: cada área do Studio" (os 9 ícones, com os 🖥 marcados)
- [x] Feito · ☑ Testado · 🖥 BYOC (página: novo componente, lista, editar código, excluir) — ⚠ editar e excluir só aparecem com 1 componente criado; o excluir ficou sem teste
- [x] Feito · ☑ Testado · 🖥 Configurações de Bancos (JSON) (página: arquivo, autenticação do projeto, conexões, LDAP, diretórios, salvar)
- [x] Feito · ☑ Testado · 🖥 Terminal (PTY)
- [x] Feito · ☑ Testado · 🖥 SQL Studio (cabeçalho, editor, executar, resultados)
- (Dados & Schemas, Autenticação, Configurações e Logs já tinham tours)

## D. IDE Local
- [x] Feito · ☑ Testado · 🖥 Visão geral e cabeçalho (título, pasta, branch, entrega, sincronizar, testes, tema, console, arquivos, minimizar, fechar)
- [x] Feito · ☑ Testado · 🖥 Explorador de arquivos (árvore, lixeira da IDE)
- [x] Feito · ☑ Testado · 🖥 Área do editor
- [x] Feito · ☑ Testado · 🖥 Console (Resumido x Detalhado)
- [x] Feito · ☑ Testado · 🖥 Git: branch, commit, push, pull, histórico, configurações (os botões do cabeçalho)
- [ ] ⏳ Git: o que há DENTRO das janelas de commit, histórico e configurações Git (precisa de marcas nessas janelas)
- [x] Feito · ☑ Testado · 🖥 Trocar de pasta e barra minimizada (o botão da pasta e o Minimizar; o interior do seletor de pasta não)
- [x] Feito · ☑ Testado · 🖥 Tema e idioma
- [ ] ⏳ Testes: só o botão do cabeçalho está coberto; o interior do Ambiente de Testes (`IdeTest*`: banco, histórico, comparar, status) ainda não
- [ ] ⏳ Entrega: só o botão do cabeçalho está coberto; o interior da janela `IdeDeliveryModal` ainda não

## E. Ejetar
- [x] Feito · ☐ Testado · 🖥 Tour "Ejetar & Sincronizar": botão, janela, idioma do código, stacks (Node.js, Java, "em breve"), configuração da stack, confirmar
- [ ] ⏳ Ação "Ejetar para uma pasta": não achei esta ação como tela separada na IDE; me mostre onde ela fica para eu cobrir
- [ ] ⏳ Sincronizar e conflitos (resolução pendente do túnel)
- [ ] ⏳ Console de sincronização e de logs do túnel
- [ ] ⏳ Exportar projeto e exportar workspace (portal + apps)
- [ ] ⏳ Gerar App Desktop Nativo (janela `DesktopAppGeneratorModal`; no portal só o ícone está coberto)

### E2. Ejetar na prática (novo, 2026-11-11)
Tour que GERA o código de verdade (menu **?** da IDE Local, "Ejetar na prática (gera o código)"). O código vai para um sandbox; nada entra na pasta até o "Efetivar Merge". Só aparece habilitado sem sincronização pendente.
- [x] Feito · ☐ Testado · 🖥 Abrir a janela: clicar em Sincronizar, escolher idioma, stack (Node.js ou Java) e configuração com cliques livres
- [x] Feito · ☐ Testado · 🖥 Gerar: "Sincronizar Repositório" gera no sandbox (o balão espera; se a IDE pedir nome de pasta, responder na tela)
- [x] Feito · ☐ Testado · 🖥 Sandbox: botões Descartar (só destacado) e Confirmar Merge; revisão dos arquivos gerados
- [x] Feito · ☐ Testado · 🖥 Efetivar o merge: o fonte aparece no explorador; passos finais (Sincronizar de novo, explorador, Commit)
- ⚠ Não testado por mim: a geração real e o merge dependem da IDE e da nuvem. Caminhos a observar: pasta vazia (a IDE renomeia a pasta para projeto-pilha e continua), pilha trocada, e "Nenhuma alteração para o merge" (o tour fica no passo de gerar: feche com o X).

---

## Pontos que merecem atenção no seu teste
1. Os ícones de ação dos cartões só aparecem ao passar o mouse; durante o tour eles ficam visíveis. Confirme que o destaque cai em cada ícone.
2. No tour dos projetos, os passos da janela "Personalizar Portal" só aparecem se houver projeto no portal; a janela abre e fecha sozinha, sem gravar.
3. Os passos 🖥 no site devem mostrar o aviso no fim do texto.
4. O tour do Túnel no site cai no aviso "só na IDE"; os passos de botões do túnel só aparecem na IDE.
5. Dentro da IDE, o menu **?** lista 3 tours (visão geral, Git, Ejetar). A visão geral foi escrita sem rodar a IDE: se algum destaque ficar fora do lugar, me diga qual passo.
6. A IDE carrega o site (`frontendDist` = www.metabuilderpro.com): estes tours chegam à IDE com o deploy do site, sem precisar de nova release da IDE.
