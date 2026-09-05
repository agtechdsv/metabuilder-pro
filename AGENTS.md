# Agent Execution Rules
- Strictly respect the user-selected model from the UI combo box (e.g., Gemini 3.5 Flash).
- NEVER automatically route, cascade, or upgrade any sub-task to Gemini Pro without manual user confirmation.
- Only run operations compatible with the current active chat model window.
- Não crie planos de implementação para tarefas simples, como criação de páginas estáticas ou de marketing, pequenos ajustes visuais ou adição de links de navegação. Apenas crie planos para alterações estruturais no banco de dados ou fluxos complexos de autenticação.
- PROIBIDO usar `run_command` para ler, inspecionar ou buscar em arquivos e pastas (ex: `cat`, `Get-Content`, `type`, `head`, `tail`, `grep`, `findstr`, `dir`, `ls`, `git show`).
- Para QUALQUER leitura ou inspeção de código e diretórios, use EXCLUSIVAMENTE as ferramentas nativas da IDE:
  * Leitura de arquivos: `view_file`
  * Busca de texto/padrões: `grep_search`
  * Listagem de pastas: `list_dir`
  * O `run_command` é RESTRITO a comandos que de fato alteram estado ou rodam o ecossistema (ex: `npm install`, `npm run build`, servidores, `git`).
- Ao CONCLUIR qualquer solicitação ou alteração de código:
  1. Executar imediatamente `npm run build` para verificar se não há erros de compilação ou TypeScript;
  2. Se ocorrer qualquer erro no build: diagnosticar e aplicar os ajustes necessários até a correção completa;
  3. Se o build for bem-sucedido: oferecer proativamente ao usuário os comandos para `git commit` (com mensagem semântica) e `git push`.