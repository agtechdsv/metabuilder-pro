# Varredura de acesso nas páginas e rotas com chave de serviço (2026-11-27)

Motivo: a tela de Automações montava dados com a chave de serviço sem conferir quem pedia. Varredura das demais: 11 páginas (`page.tsx`/`layout.tsx`) e 32 rotas (`route.ts`) que usam `SUPABASE_SERVICE_ROLE_KEY`/`serviceClient()`. Método: ler o código de cada uma e **testar em produção sem sessão** (contagem de marcadores como `db_table_name`, `layout_config`, `hash_senha` no HTML).

## Achados e correções

| # | Onde | O que vazava | Correção |
|---|---|---|---|
| 1 | `/{ws}/{projeto}/login` (pública) | Para qualquer visitante: tabela de usuários, coluna de senha (`hash_senha`) e algoritmo (`bcrypt`), URL e base do LDAP, tabelas de grupos, o menu inteiro do app, `owner_id` e `custom_domain` do workspace | `src/lib/auth/loginPublic.ts`: só vão ao navegador identidade e tema do projeto, o tema do workspace, as chaves visuais e (com relay) o tipo de login e a coluna do nome. O token só vai no modo antigo (sem relay). 6 testes |
| 2 | Layout do app e tela do caso de uso | O `project` ia inteiro ao navegador, com o **menu bruto** (`navigation`): nome de todas as telas, mesmo para quem não entrou ou não tem permissão nelas | `browserProject()` (`runtimeServer.ts`) tira `navigation`; o menu usado pelo app já vai à parte, filtrado pelas permissões |
| 3 | Tela do caso de uso e dashboard, `?preview=draft` | Qualquer login do MetaBuilder (inclusive de outro cliente) via o rascunho não publicado de qualquer app sem login; no dashboard, bastava digitar o parâmetro para ver as telas não publicadas | Só vale para **membro do projeto** (`authorizeProjectMember`) |
| 4 | `POST /api/build-desktop` | Usuário logado podia pedir a geração do app desktop de **qualquer** projeto/workspace: o código lia o projeto pela regra de acesso, não achava, e seguia | Sem acesso ao contexto, responde 403 |

## O que está certo (conferido)

- **Telas com sessão obrigatória** (`downloads`, `help`, `approvals`, tela do caso de uso, dashboard): sem sessão não montam dado nenhum; em produção o HTML não traz tabela, coluna nem configuração de tela.
- **Áreas de administração** (`/admin/...`): 307 para o login (proxy).
- **Rotas do Agente** (`/api/automations/*`, `/api/metadata/*`, webhook): autenticadas por `secret_token`, por assinatura ou pelo segredo do fluxo.
- **Crons** (`/api/cron/*`): `isCronAuthorized`. **Segurança do usuário final** (`/api/auth/end-user/*`): `guardEndUser` / sessão pendente. **IA e exportação**: `getUser()` + acesso ao projeto, `authorizeProjectActor`, dono do arquivo.
- **Portal do workspace** (`/{ws}`): público **por desenho**: lista só projetos com `show_in_portal` ligado e mostra nome, descrição e logo.
- `/api/releases/context`: público por desenho (histórico de versões do app: nome, ícone e builds).

## Não coberto

Não testei em produção os cenários **com** sessão (usuário comum tentando ler/gravar algo de outro projeto). A varredura foi de leitura de código, mais o teste anônimo. As regras de gravação do banco (`bpm_workflows`) dependem de `has_project_access` na tabela `projects`; li as políticas, mas não tentei gravar como usuário comum.

## Como conferir depois do deploy

Sem sessão, o HTML de `/{ws}/{projeto}/login` não deve conter `hash_senha`, `ldap_server_url`, `owner_id` nem o nome de telas do menu; e `/{ws}/{projeto}/dashboard` não deve conter o nome das telas.
