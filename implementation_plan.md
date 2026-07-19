# Implementação de Tela de Login e Portal de Aplicações

Este plano detalha as melhorias propostas para a tela de login do usuário final (com personalização de marca) e a criação de um "Portal de Aplicações" para que os clientes finais consigam visualizar os projetos aos quais têm acesso.

## User Review Required

> [!WARNING]
> A reestruturação da tela de login do usuário final (`/login` e `/[workspace]/[project]/login`) impactará o visual imediatamente para todos os projetos atuais. Por favor, valide se a direção artística proposta (layout half-screen) atende à sua visão.
> 
## Respostas e Definições (Alinhado)

1. **Rota do Portal:** Usaremos a rota dedicada `/[workspace_slug]/portal` para manter a separação clara entre a raiz (que pode ser administrativa) e a visão do usuário final.
2. **Autenticação:** O portal será 100% público. Qualquer usuário com o link poderá ver os cards dos projetos liberados, mas precisará logar individualmente no projeto escolhido.
3. **Configuração de Logo/Banner e Portal:**
   - Vamos estender a coluna `theme_config` (JSONB) já existente na tabela `projects` para armazenar: `login_logo_url`, `login_banner_url` e `show_in_portal`.
   - Na tela atual de listagem de projetos (imagem que você enviou), adicionaremos:
     - Um botão/switch global na Workspace: **"Portal de Aplicações: Ativo/Inativo"** (salvo nas configurações da Workspace).
     - No Drawer de Edição de cada Projeto: um checkbox **"Exibir no Portal de Aplicações"** (só aparece se o Portal estiver ativo na Workspace). E também os campos para URL da Logo e URL do Banner.
     - No próprio Card do Projeto (na listagem): um ícone de atalho "Adicionar/Remover do Portal", visível apenas quando o Portal estiver ativado na Workspace.

## Proposed Changes

---

### Módulo: Configurações do Portal e Branding no Studio

#### [MODIFY] [ProjectManager.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/components/workspace/ProjectManager.tsx)
- Adicionar no Drawer de Criação/Edição de Projetos a aba/seção de "Branding & Portal", contendo:
  - Checkbox: "Exibir no Portal de Aplicações" (salvo em `theme_config.show_in_portal`).
### `cli/index.js` (CLI Agent / Tunnel)
Extensão do motor de recepção de comandos do túnel local.
- Adicionar suporte ao `action === 'raw_sql'`.
- Executar a query SQL crua recebida e retornar todas as linhas de resultado e contagem afetada, sem limitação artificial imposta pelos `actions` como `select`.

### Interface Frontend do SQL Studio (IDE)

#### [NEW] [SqlStudioClient.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/app/admin/%5Bworkspace_slug%5D/%5Bproject_slug%5D/studio/sql/SqlStudioClient.tsx)
Um componente que funcionará como editor SQL:
- Incorporação do `ByocEditor` ou `textarea` robusto configurado para a linguagem SQL.
- Painel dividido para Editor no topo e Tabela de Resultados abaixo.
- Botão "Executar Query (F5)" que envia via Supabase Realtime Tunnel (`broadcast` -> `sql_query`).
- Ouve eventos de `query_result` na subscription para receber os dados do motor local.

#### [NEW] [page.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/app/admin/%5Bworkspace_slug%5D/%5Bproject_slug%5D/studio/sql/page.tsx)
- Server Component da rota `/studio/sql`.

#### [MODIFY] [StudioDashboardClient.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/app/admin/%5Bworkspace_slug%5D/%5Bproject_slug%5D/studio/StudioDashboardClient.tsx)
- Adicionar um novo "Card" no grid do dashboard direcionando para o SQL Studio.

## Verification Plan

### Manual Verification
- Iniciar o `cli` local do Metabuilder.
- Abrir o SQL Studio no browser (ou no app desktop).
- Executar comandos DDL (`CREATE TABLE teste (id int)`) e DML (`INSERT`, `SELECT`).
- Verificar se as mensagens de sucesso/erro retornam apropriadamente para a interface.
