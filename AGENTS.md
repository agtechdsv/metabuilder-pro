# AGENTS.md — regras para agentes de código

Lido por mais de uma ferramenta (`CLAUDE.md` importa este arquivo). Responda ao usuário em português do Brasil.
Fatos marcados com *(out/2026)* foram registrados nessa data: se algo parecer diferente do código, confie no código e atualize este arquivo.

## O projeto
MetaBuilder PRO: Studio low-code que monta telas (cadastros, Kanban, Gantt, BI, mapas...) a partir de **configuração**, e as executa como app (runtime) ou as **ejeta** como app Node ou Java.
Next.js (App Router) + Supabase (plataforma) + **Agente CLI** que acessa o banco do cliente por um túnel assinado.

## Mapa do código
- `src/app/admin/[workspace_slug]/[project_slug]/studio` — Studio. `src/components/studio` — construtor de casos de uso.
- `src/app/[workspace_slug]/[project_slug]/` — app publicado (runtime). `src/components/runtime` — telas, formulário, grid, filtros.
- `src/lib/generator` — ejeção: `parser.ts` → `ast.ts` → `layers/` e `emitter/` (Node e Java Spring). Testes em `__tests__/`.
- `src/lib/tunnel` — túnel, assinatura de comandos e política de segurança (`relayPolicy.ts`).
- `cli/` — Agente CLI (CommonJS, empacotado em `.exe` com `pkg`). `src-tauri/` — IDE desktop.
- `supabase/migrations`, `scripts/` (apoio e SQL de seed), `e2e/` (Playwright: ver `README.md` e `COBERTURA.md`), `docs/`.

## Dois bancos de dados — não confundir
- **Supabase da plataforma** (projeto `main` = PRODUÇÃO): `ui_views`, `ui_components`, `projects`... A configuração das telas (inclusive a ajuda) mora em JSON aqui.
- **Banco do cliente** (ex.: `crm`, PostgreSQL/Oracle): só é alcançado pelo Agente CLI. Tabelas como `mb_help_feedback` e `mb_logs` ficam aqui.
- O MCP do Supabase é **somente leitura**. SQL que grava vira **arquivo em `scripts/`** para o usuário rodar no SQL Editor (ele corta resultados em 100 linhas); nunca tente aplicar em produção.

## Verificação antes de entregar
1. `npx tsc --noEmit` (rápido) · 2. `npm test` (vitest) · 3. `npm run build` (o `prebuild` gera o runtime de BI e o bundle do engine).
Se algo falhar, corrija até ficar limpo. Mexeu em `src/lib/bi/*` ou nos arquivos listados em `scripts/gen-bi-runtime.mjs`? Rode `npm run gen:bi` (o teste `biRuntimeFiles` falha se esquecer).
Diga com franqueza o que **não** foi testado (ex.: no navegador, no CLI real, em app ejetado rodando).

## Commits
- Mensagens no padrão `feat(escopo): ...`, `fix(...)`, `chore(...)`, em português, com corpo curto em lista quando ajudar.
- **Não acrescente `Co-Authored-By` nem qualquer linha de coautoria/atribuição** nos commits (decisão do dono, 2026-11-05).
- Só commite ou faça push quando o usuário pedir. Ao terminar, ofereça o comando em **uma linha PowerShell** com `;`: `git add ...; git commit -m "..."; git push`.

## Segurança (não negociável)
- Toda ação nova do CLI precisa ser classificada em `src/lib/tunnel/relayPolicy.ts` (só servidor, só desenvolvedor ou livre), com teste. O navegador nunca assina comandos; quem agiu vem da **sessão**, nunca do corpo do pedido.
- Nunca leia, cole em resposta ou commite segredos (`.env*`, tokens, chaves de serviço, credenciais de banco).
- Quando o protocolo do túnel mudar: publique primeiro a release da IDE (CLI) e só depois faça o deploy do servidor *(out/2026)*.

## CLI (`cli/`)
- Roda no **Node 18 embutido pelo `pkg`**. Chamada de rede nova usa `axios`, não `fetch` (o `fetch` do Node 18 falha em redirecionamento 307 com corpo) *(out/2026)*. Teste no Node do pkg: `PKG_EXECPATH=PKG_INVOKE_NODEJS cli/dist/cli-win.exe script.js`.
- Testar código novo em localhost: `cd cli; node index.js`. O `.exe` é congelado: só pega mudança depois de `npm run build` dentro de `cli/`.
- O CLI usa a chave **anon** do Supabase: gravar no Supabase depende de RLS aberto. O certo é pedir ao servidor, assinado com o token *(out/2026)*.

## Convenções de código
- **i18n:** textos de interface em `src/i18n/translations/{pt,en,es}.json`, com as mesmas chaves nos três (o teste `src/i18n/__tests__/translations.test.ts` exige paridade). Texto novo: crie a chave nos três idiomas; fallback em português no `t('chave', 'texto')` só em último caso (dívida conhecida: várias telas de ajuda ainda usam só o fallback).
- **Hooks do React** nunca depois de `return` condicional (já causou o erro #310 no `IDEModal`; há teste guarda).
- **Gerador/ejeção:** mudou algo em `src/lib/generator`? Acrescente teste em `__tests__/`. Código gerado dentro de template string evita crases e `${}` para não precisar de escapes. O app ejetado é português apenas.
- Arquivos do repositório têm **CRLF** (`autocrlf`): o aviso "LF will be replaced by CRLF" é inofensivo, mas `Edit` de várias linhas pode falhar; releia o arquivo e tente de novo.

## Ambiente Windows
- Shells: Git Bash e PowerShell. **Não há Python.** Heredoc com muitas aspas ou `\n` quebra: para arquivos grandes use a ferramenta de escrita. `ln -s` COPIA a pasta; `du` em `node_modules` estoura o tempo.
- Não crie scripts soltos na raiz do repositório (a raiz já tem vários: `script.js`, `temp.json`...). Rascunhos vão para a pasta de rascunho da sessão; o que for útil e durável vai para `scripts/`.

## Como trabalhar
- Ler e buscar: ferramentas nativas (`Read`/`Grep`/`Glob` no Claude Code). O terminal é para **executar** (`npm`, `git`, servidores), não para `cat`/`grep`/`ls`/`sed` em arquivos.
- Tarefas simples (página estática, ajuste visual, link de navegação): sem plano. Plano só para mudança estrutural de banco ou fluxo de autenticação complexo.
- A memória pessoal de um agente não é compartilhada: fato durável sobre o projeto entra **aqui** ou em `docs/`.

## Antigravity / Gemini (regras originais, mantidas)
- Strictly respect the user-selected model from the UI combo box (e.g., Gemini 3.5 Flash). NEVER automatically route, cascade, or upgrade any sub-task to Gemini Pro without manual user confirmation. Only run operations compatible with the current active chat model window.
- STRICTLY FORBIDDEN to use `run_command` for reading, inspecting, or searching files and directories. Use `view_file`, `grep_search` and `list_dir`; `run_command` is only for commands that change state or run the ecosystem (`npm install`, `npm run build`, servers, `git`).
