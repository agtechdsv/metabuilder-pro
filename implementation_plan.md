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
  - Input: URL da Logo (`theme_config.login_logo_url`).
  - Input: URL do Banner (`theme_config.login_banner_url`).
- (Opcional) Switch global de "Habilitar Portal" na área superior (header da workspace), atualizando a tabela `workspaces` no banco.

---

### Módulo: Tela de Login Personalizável

Vamos redesenhar o `LoginForm.tsx` ou o layout de `/[workspace]/[project]/login` para um visual moderno em tela dividida (Split-Screen / Half-Screen). O lado esquerdo conterá o formulário e a logo (branding), e o lado direito um banner visual dinâmico.

#### [MODIFY] [LoginForm.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/components/auth/LoginForm.tsx)
- Alterar o componente para aceitar novos parâmetros: `logoUrl` e `bannerUrl` (ou extrai-los das configurações do projeto).
- Ocultar a logo e branding globais do "MetaBuilder" na tela do usuário final, injetando os dados do projeto atual.

#### [MODIFY] [login/page.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/app/[workspace_slug]/[project_slug]/login/page.tsx)
- Ajustar o container principal para não ser apenas centralizado, mas sim usar um grid de duas colunas em telas médias/grandes (`md:grid-cols-2`).
- Buscar as configurações do Projeto (via metadados/banco) para repassar as variáveis de logo/banner para o `LoginForm`.

#### [MODIFY] [Configurações do Projeto - Studio]
- Adicionar no Builder (ou no `admin/[workspace_slug]/settings`) campos de input para "URL da Logo" e "URL do Banner de Login" para o projeto. Se estiver vazio, usaremos um padrão bonito.

---

### Módulo: Portal de Aplicações (Workspace Hub)

Criar a funcionalidade para listar os projetos publicados/ativos da Workspace.

#### [NEW] [portal/page.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/app/[workspace_slug]/portal/page.tsx)
- Uma página estilo vitrine, com cards atraentes e micro-animações (Glassmorphism e Glow).
- Cada card representa um projeto publicado sob essa Workspace, listando:
  - Título do Projeto
  - Descrição
  - Botão de "Acessar Aplicação" (redireciona para o `login` do respectivo projeto).

#### [MODIFY] [page.tsx da Workspace Root](file:///c:/AgTech/Apps/metabuilder-pro/src/app/[workspace_slug]/page.tsx)
- Se a raiz da workspace for acessada, redirecionar o usuário não-logado para o `/portal` ao invés de enviar para um login administrativo, caso esse seja o comportamento desejado.

## Verification Plan

### Manual Verification
1. Acessar `/[workspace_slug]/[project_slug]/login` e confirmar que o novo design "Half-Screen" é ativado.
2. Alterar o Logo e Banner via propriedades/settings do projeto e garantir que o login carrega essas novas imagens.
3. Acessar `/[workspace_slug]/portal` (ou o root da workspace) para ver o grid de projetos listados e clicar em um deles, garantindo que o roteamento de login do projeto funciona corretamente.
