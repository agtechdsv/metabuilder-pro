# Checklist dos tours das janelas da IDE e do portal (novo, 2026-11-11)

Continuação do `tours-checklist-ide-portal.md`: aqui ficam os tours que estavam em ⏳ (interior das janelas). Mesmo modelo de marcação.

Como usar:
- **Feito** `[x]`: marcado por mim quando o tour está codado e passou em `tsc` e nos testes (1388 testes, todos verdes).
- **Testado** `☑`: você marca depois de testar na IDE ou no navegador. Começa em `☐`.
- 🖥 = só na IDE Desktop (o site não tem a janela).
- Todos os tours abrem a janela sozinhos, só explicam e fecham a janela no fim. O tour nunca clica sozinho no botão que grava, gera, executa ou apaga; só a Entrega deixa VOCÊ clicar em "Gerar entrega" no último passo.
- Onde achar os tours: menu **?** da IDE Local (grupos Git, Ejetar & Sincronizar e Testes) e menu **?** do portal.

Legenda de cada linha: `- [ ] Feito · ☐ Testado · item`

---

## A. Entrega 🖥 (menu ? da IDE: grupo "Ejetar & Sincronizar" › "Entrega")
Precisa do projeto já sincronizado e sem merge pendente (senão o botão Entrega fica desativado e o tour só mostra o primeiro passo).
- [x] Feito · ☑ Testado · 🖥 O botão Entrega e a abertura da janela (sozinha, sem gerar nada)
- [x] Feito · ☑ Testado · 🖥 "De onde vem o código" e "O que gerar" (pode marcar e desmarcar Código-fonte, Pacote Docker e Pacote compilado: nada é gerado)
- [x] Feito · ☑ Testado · 🖥 Formato (Pasta ou ZIP) e "Segredos e limpeza da pasta" (pode clicar nas opções)
- [x] Feito · ☑ Testado · 🖥 Novo (2026-11-11): os dois últimos passos são "Cancelar" (7) e "Gerar entrega" (8), nessa ordem, e respondem ao clique. Clicar em Cancelar fecha a janela e encerra o tour; clicar em Gerar entrega começa a gerar de verdade (escolhe destino, mostra o andamento) e o tour sai da frente. Sem clicar: Concluir fecha a janela sem gerar
- ⚠ A opção "Pacote Docker" aparece desativada se a pasta não tem o pacote de produção (precisa Sincronizar de novo): o passo continua igual.

## B. Commit 🖥 (grupo "Git" › "Commit: revisar e confirmar as alterações")
A janela de Commit só abre se houver alteração local pendente. Para testar: edite qualquer arquivo no editor da IDE e salve, antes de abrir o tour.
- [x] Feito · ☑ Testado · 🖥 O botão Commit e a abertura da janela
- [x] Feito · ☑ Testado · 🖥 Mensagem do commit (pode digitar) e lista de arquivos (pode marcar e clicar no nome; o botão direito não é explicado de propósito)
- [x] Feito · ☑ Testado · 🖥 Comparador de diferenças só leitura (clicar nele não faz nada) e "Confirmar Commit" só destacado
- [x] Feito · ☑ Testado · 🖥 Cancelar fecha a janela sem commitar
- ⚠ Sem alteração pendente a IDE mostra o aviso "Nenhuma alteração local pendente" e o tour fica só no primeiro passo (esperado).

## C. Histórico do Git 🖥 (grupo "Git" › "Histórico do Git")
- [x] Feito · ☑ Testado · 🖥 O botão Histórico e a abertura da janela
- [x] Feito · ☑ Testado · 🖥 Escolher a branch (só troca a lista de commits mostrada; a branch do projeto não muda) e a lista de commits
- [x] Feito · ☑ Testado · 🖥 "Reverter para esta versão" nunca é clicado (a lista é só leitura) e a janela fecha no fim
- [x] Feito · ☑ Testado · 🖥 Textos da janela de Histórico traduzidos (título, "Branch", "Nenhum commit encontrado", "Reverter para esta versão"): trocar o idioma da IDE e conferir pt, en, es. Os avisos de reverter e de nova branch continuam em português (fora deste escopo)

## D. Ambiente de Testes 🖥 (grupo "Testes" › "Ambiente de Testes")
- [x] Feito · ☑ Testado · 🖥 O botão e a abertura da janela; durante o tour só abas, Recolher/Expandir e o X respondem
- [x] Feito · ☑ Testado · 🖥 Abas Executar e Histórico e o aviso de segurança dos dados
- [x] Feito · ☑ Testado · 🖥 Seções 1 Tipo de teste, 2 Casos de uso, 3 Onde rodar (motor, banco de teste, pasta do app), 4 Como acompanhar
- [x] Feito · ☑ Testado · 🖥 Rodapé (Executar testes só destacado, relatório) e aba Histórico (o tour troca de aba e volta; abrir, comparar e excluir ficam desativados)
- [x] Feito · ☑ Testado · 🖥 O X fecha a janela ao terminar o tour
- ⚠ Não coberto por tour: o relatório (janela interna com Imprimir/Download) e a comparação de duas execuções, porque só existem depois de executar testes de verdade.

## E. Instalador Desktop 🖥 (portal: "Instalador Desktop do projeto" em /admin/:workspace e "Instalador Desktop do workspace" em /workspace)
- [x] Feito · ☑ Testado · 🖥 Projeto: ícone "Gerar App Desktop Nativo" do cartão, abertura da janela e campos (nome, descrição, versão, ícone, connection string, URL da aplicação web, notas da versão)
- [x] Feito · ☑ Testado · 🖥 Workspace: o mesmo tour, aberto pelo cartão do workspace (texto diz "Portal de Aplicações")
- [x] Feito · ☑ Testado · 🖥 "Gerar Instalador (.msi)" só destacado, ícone só leitura (não abre o seletor de arquivos) e a janela fecha no fim
- [x] Feito · ☑ Testado · 🖥 Textos "Versão do App", "O que há de novo nesta versão?", "Opcional", exemplo e dica das notas agora traduzidos: trocar o idioma e conferir pt, en, es
- ⚠ No site o ícone existe mas a janela é da IDE: o tour mostra o passo do botão e pula o resto (esperado).

## F. Sincronização pendente (tela de revisão) (menu ? da própria tela: "Sincronização pendente: resolver as diferenças")
A tela só existe quando o projeto está com "Sincronização pendente" (tabela ou coluna sumiu do banco). Para provocar: renomeie uma tabela no banco do cliente e sincronize pelo Gerenciador do Túnel; clique no selo âmbar "Sincronização pendente" do cartão do projeto.
- [x] Feito · ☐ Testado · Por que a tela apareceu (explicação)
- [x] Feito · ☐ Testado · Tabelas ausentes e Colunas ausentes (pode escolher nas listas: nada vale antes de aplicar)
- [x] Feito · ☐ Testado · "Aplicar Resoluções e Sincronizar" só destacado (o tour nunca clica)
- ⚠ Não consegui abrir essa tela no navegador (depende de um projeto nesse estado): testada só por tipos e testes de catálogo.

## G. Console de sincronização e logs do túnel 🖥 (passo novo no fim do tour "Gerenciador do Túnel", no Studio e nos dois do portal)
- [x] Feito · ☐ Testado · 🖥 Passo "O que aparece ao sincronizar e nos logs": explica o console ao vivo, o Fechar desativado enquanto roda, o resultado e a janela separada de Logs
- ⚠ É só texto, de propósito: o console de sincronização só abre depois de sincronizar de verdade (lê o banco do cliente) e os Logs abrem em outra janela do sistema, que o tour não alcança.

## H. Menu ? da IDE com os grupos novos
- [x] Feito · ☑ Testado · 🖥 Git agora tem 4 tours (comandos, Configurações, Commit, Histórico); Ejetar & Sincronizar tem 3 (teoria, prática, Entrega); grupo novo "Testes"; recolher/expandir e os ícones de expandir/recolher tudo continuam funcionando

## I. Limpeza (sem tela para testar)
- [x] Feito · Textos do e2e (`e2e/README.md`, `guard.ts`, configs e scripts) não mandam mais usar "IDE > Ejetar para uma pasta": agora dizem "Sincronizar (ou Entrega > Código-fonte limpo, em pasta)"
- [x] Feito · Chave de tradução `eject_to_folder` (sem uso) removida de pt, en e es; teste guarda impede o texto antigo de voltar ao e2e

## J. O que NÃO vira tour (decisão)
- "Ejetar para uma pasta": a ação foi substituída por **Sincronizar** + **Entrega** em 2026-10-20 (ver `tours-checklist-ide-portal.md`, E).
- "Exportar projeto" e "Exportar workspace": o ícone saiu dos cartões em 2026-10-14 (exportar é só na IDE Desktop) e `ProjectExportModal` e `WorkspaceExportModal` não são abertos por nenhuma tela. São código órfão: não há o que explicar. Posso remover esses arquivos se você quiser.

---

## Pontos que merecem atenção no seu teste
1. Em todos os tours de janela, saia do tour no meio (X do balão) e confirme que a janela aberta fecha sozinha.
2. No Commit, confira que o lado direito do comparador não aceita clique durante o tour (editar ali salvaria o arquivo).
3. No Histórico, passe o mouse nos cartões: o botão vermelho "Reverter para esta versão" aparece, mas o tour não deixa clicar.
4. Nos tours que abrem janelas pelo botão do cabeçalho, o botão desativado (Entrega sem sincronizar, Commit sem alteração) faz o tour mostrar só o primeiro passo.
