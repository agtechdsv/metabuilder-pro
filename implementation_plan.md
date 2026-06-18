# Implementação de Tela de Login e Portal de Aplicações

Este plano detalha as melhorias propostas para a tela de login do usuário final (com personalização de marca) e a criação de um "Portal de Aplicações" para que os clientes finais consigam visualizar os projetos aos quais têm acesso.

## User Review Required

> [!WARNING]
> A reestruturação da tela de login do usuário final (`/login` e `/[workspace]/[project]/login`) impactará o visual imediatamente para todos os projetos atuais. Por favor, valide se a direção artística proposta (layout half-screen) atende à sua visão.
> 
> Além disso, o **Portal de Aplicações** requer uma nova rota pública ou autenticada, como `/[workspace]/portal`. A URL principal da Workspace (`/[workspace]`) pode ser redirecionada para cá, mas precisaremos garantir que o usuário saiba que ali ele apenas visualiza os "cards" das aplicações e não tem funções de administração (Studio).

## Open Questions

> [!IMPORTANT]
> **1. Rota do Portal:** Onde você prefere que o portal fique? Em `/[workspace_slug]` diretamente (para que o root do domínio do cliente mostre os cards dos projetos) ou em uma rota específica como `/[workspace_slug]/portal`?
> 
> **2. Autenticação no Portal:** O portal deve ser público (mostra os projetos, o usuário clica e vai para o login do projeto) ou o usuário precisa fazer um "Login Global da Workspace" antes de ver os projetos? (Recomendo público, para que a barreira de entrada seja no nível do projeto).
> 
> **3. Configuração de Banner/Logo:** As imagens do logo e do banner devem ser salvas no próprio registro de banco de dados do projeto (tabela `projects` via supabase) ou preferimos apenas colocar URLs (links externos) no `schema.json` via Studio?

## Proposed Changes

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
