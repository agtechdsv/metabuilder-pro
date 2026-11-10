/**
 * Tours do portal: a tela de workspaces (/workspace) e a de projetos de um workspace (/admin/:workspace).
 * Só explicam: nada é clicado nem gravado. Funções exclusivas da IDE Desktop levam `ideOnly` (no site o balão avisa que o ícone fica desativado).
 * Cada alvo é um `data-help-id` de WorkspaceManager, ProjectManager, ProjectCard e WorkspacePortalModal.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const WS = '/workspace'
const PJ = '/admin/:workspace'
const OPT = { skipIfMissing: true }

export const PORTAL_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── workspaces ─────────────────────────
  {
    id: 'portal-workspaces',
    route: WS,
    title: h(['Workspaces: visão geral', 'Workspaces: overview', 'Workspaces: visión general']),
    summary: h(['Para que serve um workspace, os contadores, o cartão e cada ícone que aparece ao passar o mouse.', 'What a workspace is for, the counters, the card and each icon that shows on hover.', 'Para qué sirve un workspace, los contadores, la tarjeta y cada ícono que aparece al pasar el mouse.']),
    steps: [
      st('banner', 'portal.ws_banner', ['Seus workspaces', 'Your workspaces', 'Sus workspaces'], [
        'Um workspace é o ambiente de uma empresa ou de um cliente: reúne os projetos, a equipe e o portal de acesso. Esta é a tela inicial depois do login.',
        'A workspace is the environment of a company or a customer: it groups the projects, the team and the access portal. This is the home screen after login.',
        'Un workspace es el entorno de una empresa o de un cliente: reúne los proyectos, el equipo y el portal de acceso. Esta es la pantalla inicial después del login.',
      ]),
      st('team', 'portal.ws_team', ['Gerenciar equipe', 'Manage team', 'Gestionar equipo'], [
        'Convide pessoas e defina o que cada uma pode fazer. Aparece só para o dono ou para quem tem acesso global.',
        'Invite people and define what each can do. It only shows for the owner or for people with global access.',
        'Invite personas y defina qué puede hacer cada una. Aparece solo para el dueño o para quien tiene acceso global.',
      ], OPT),
      st('new', 'portal.ws_new', ['Novo workspace', 'New workspace', 'Nuevo workspace'], [
        'Abre um painel lateral para preencher os dados do novo workspace. Nada é criado até você salvar.',
        'Opens a side panel to fill in the data of the new workspace. Nothing is created until you save.',
        'Abre un panel lateral para completar los datos del nuevo workspace. No se crea nada hasta guardar.',
      ], OPT),
      st('stats', 'portal.ws_stats', ['Contadores', 'Counters', 'Contadores'], [
        'Workspaces ativos, total de projetos e membros ativos da equipe. Convites ainda não aceitos aparecem ao lado como pendentes.',
        'Active workspaces, total projects and active team members. Invitations not yet accepted show next to it as pending.',
        'Workspaces activos, total de proyectos y miembros activos del equipo. Las invitaciones aún no aceptadas aparecen al lado como pendientes.',
      ]),
      st('refresh', 'portal.refresh', ['Atualizar a lista', 'Refresh the list', 'Actualizar la lista'], [
        'Recarrega os workspaces. Útil depois que outra pessoa da equipe criou ou alterou algo.',
        'Reloads the workspaces. Useful after someone else on the team created or changed something.',
        'Recarga los workspaces. Útil después de que otra persona del equipo creó o cambió algo.',
      ], OPT),
      st('card', 'portal.ws_card', ['O cartão do workspace', 'The workspace card', 'La tarjeta del workspace'], [
        'Mostra o nome, o endereço (/slug) e quantos projetos ele tem. Clicar no cartão, ou no botão redondo, abre os projetos do workspace.',
        'Shows the name, the address (/slug) and how many projects it has. Clicking the card, or the round button, opens the projects of the workspace.',
        'Muestra el nombre, la dirección (/slug) y cuántos proyectos tiene. Hacer clic en la tarjeta, o en el botón redondo, abre los proyectos del workspace.',
      ], OPT),
      st('actions', 'portal.ws_actions', ['Ícones do cartão', 'Card icons', 'Íconos de la tarjeta'], [
        'Ao passar o mouse sobre o cartão aparecem os ícones de ação. Quais aparecem depende do seu papel e do plano. Vamos ver um a um.',
        'When you hover the card, the action icons show up. Which ones show depends on your role and plan. Let us see them one by one.',
        'Al pasar el mouse sobre la tarjeta aparecen los íconos de acción. Cuáles aparecen depende de su rol y plan. Los veremos uno por uno.',
      ], OPT),
      st('act-open', 'portal.ws_act_open', ['Acessar Portal', 'Open Portal', 'Acceder al Portal'], [
        'Abre o portal do workspace, a vitrine com os projetos marcados para aparecer nele. Só existe se algum projeto do workspace estiver no portal.',
        'Opens the workspace portal, the showcase with the projects marked to show in it. It only exists if some project of the workspace is in the portal.',
        'Abre el portal del workspace, la vitrina con los proyectos marcados para aparecer en él. Solo existe si algún proyecto del workspace está en el portal.',
      ], OPT),
      st('act-desktop', 'portal.ws_act_desktop', ['Gerar App Desktop Nativo', 'Generate Native Desktop App', 'Generar App de Escritorio Nativo'], [
        'Empacota o workspace como um aplicativo de desktop instalável. Exclusivo da IDE Desktop.',
        'Packages the workspace as an installable desktop application. Exclusive to the Desktop IDE.',
        'Empaqueta el workspace como una aplicación de escritorio instalable. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('act-ide', 'portal.ws_act_ide', ['IDE Local (Sincronizar)', 'Local IDE (Sync)', 'IDE Local (Sincronizar)'], [
        'Abre a IDE Local do workspace: traz os apps para uma pasta do seu computador, edita o código e sincroniza de volta. É onde ficam também o ejetar e o Git. Exclusivo da IDE Desktop.',
        'Opens the Local IDE of the workspace: brings the apps to a folder on your computer, edits the code and syncs back. It is also where eject and Git live. Exclusive to the Desktop IDE.',
        'Abre la IDE Local del workspace: trae las apps a una carpeta de su computador, edita el código y sincroniza de vuelta. Allí también están eyectar y Git. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('act-edit', 'portal.ws_act_edit', ['Editar workspace', 'Edit workspace', 'Editar workspace'], [
        'Abre o painel de edição para mudar os dados do workspace. As mudanças só valem ao salvar.',
        'Opens the edit panel to change the workspace data. Changes only apply on save.',
        'Abre el panel de edición para cambiar los datos del workspace. Los cambios solo valen al guardar.',
      ], OPT),
      st('act-delete', 'portal.ws_act_delete', ['Excluir workspace', 'Delete workspace', 'Eliminar workspace'], [
        'Pede confirmação antes de excluir. Hoje a lixeira cobre só os casos de uso: a exclusão de um workspace não volta, então confira antes.',
        'Asks for confirmation before deleting. Today the trash covers only use cases: deleting a workspace cannot be undone, so double-check.',
        'Pide confirmación antes de eliminar. Hoy la papelera cubre solo los casos de uso: eliminar un workspace no se deshace, así que revise antes.',
      ], OPT),
      st('act-ai', 'portal.ws_act_ai', ['Configurações de IA', 'AI settings', 'Configuraciones de IA'], [
        'Define como o AI Builder trabalha neste workspace. Aparece só para o dono, no plano PRO.',
        'Defines how the AI Builder works in this workspace. It only shows for the owner, on the PRO plan.',
        'Define cómo trabaja el AI Builder en este workspace. Aparece solo para el dueño, en el plan PRO.',
      ], OPT),
      st('enter', 'portal.ws_enter', ['Entrar no workspace', 'Enter the workspace', 'Entrar al workspace'], [
        'Mostra o número de projetos e leva para a lista deles. É o caminho normal para começar a trabalhar.',
        'Shows the number of projects and takes you to their list. It is the normal way to start working.',
        'Muestra el número de proyectos y lleva a su lista. Es el camino normal para empezar a trabajar.',
      ], OPT),
      st('add-card', 'portal.ws_add_card', ['Atalho para criar', 'Shortcut to create', 'Atajo para crear'], [
        'O cartão pontilhado faz o mesmo que o botão "Novo workspace" do topo.',
        'The dotted card does the same as the "New workspace" button at the top.',
        'La tarjeta punteada hace lo mismo que el botón "Nuevo workspace" de arriba.',
      ], OPT),
    ],
  },

  // ───────────────────────── projetos do workspace ─────────────────────────
  {
    id: 'portal-projetos',
    route: PJ,
    title: h(['Projetos do workspace: visão geral', 'Workspace projects: overview', 'Proyectos del workspace: visión general']),
    summary: h(['Criar projeto, o cartão, cada ícone de ação e como personalizar o portal do workspace.', 'Create a project, the card, each action icon and how to customize the workspace portal.', 'Crear un proyecto, la tarjeta, cada ícono de acción y cómo personalizar el portal del workspace.']),
    neverClick: ['portal.portal_save'],
    cleanupClick: ['portal.portal_cancel'],
    steps: [
      st('banner', 'portal.pj_banner', ['Projetos do workspace', 'Workspace projects', 'Proyectos del workspace'], [
        'Aqui ficam os projetos do workspace. Um projeto é um sistema: tem as tabelas do banco do cliente, os casos de uso (as telas) e o app publicado.',
        'This is where the projects of the workspace live. A project is a system: it has the customer database tables, the use cases (the screens) and the published app.',
        'Aquí están los proyectos del workspace. Un proyecto es un sistema: tiene las tablas de la base del cliente, los casos de uso (las pantallas) y la app publicada.',
      ]),
      st('new', 'portal.pj_new', ['Novo projeto', 'New project', 'Nuevo proyecto'], [
        'Abre um painel lateral: nome, endereço, descrição, ícone e se o projeto aparece no Portal do workspace (com logo e banner próprios). Nada é criado até salvar.',
        'Opens a side panel: name, address, description, icon and whether the project shows in the workspace Portal (with its own logo and banner). Nothing is created until you save.',
        'Abre un panel lateral: nombre, dirección, descripción, ícono y si el proyecto aparece en el Portal del workspace (con logo y banner propios). No se crea nada hasta guardar.',
      ], OPT),
      st('tabs', 'portal.pj_tabs', ['Abas desta tela', 'Tabs of this screen', 'Pestañas de esta pantalla'], [
        '"Seus Projetos" é a lista. Na IDE Desktop aparecem também as abas Gerenciador do Túnel e Bancos Sincronizados do workspace.',
        '"Your Projects" is the list. In the Desktop IDE the workspace tabs Tunnel Manager and Synced Databases also show.',
        '"Sus Proyectos" es la lista. En la IDE Desktop aparecen también las pestañas Gestor del Túnel y Bases Sincronizadas del workspace.',
      ]),
      st('customize', 'portal.pj_customize', ['Personalizar o portal', 'Customize the portal', 'Personalizar el portal'], [
        'Abre a janela com o logo e o banner da tela de login do portal. Aparece quando há projetos no portal e você pode criar projetos.',
        'Opens the window with the logo and banner of the portal login screen. It shows when there are projects in the portal and you can create projects.',
        'Abre la ventana con el logo y el banner de la pantalla de login del portal. Aparece cuando hay proyectos en el portal y usted puede crear proyectos.',
      ], OPT),
      st('refresh', 'portal.refresh', ['Atualizar a lista', 'Refresh the list', 'Actualizar la lista'], [
        'Recarrega os projetos, com o total ao lado.',
        'Reloads the projects, with the total next to it.',
        'Recarga los proyectos, con el total al lado.',
      ], OPT),
      st('card', 'portal.pj_card', ['O cartão do projeto', 'The project card', 'La tarjeta del proyecto'], [
        'Nome, endereço (/slug) e descrição do projeto. Clicar no cartão abre o Studio dele.',
        'Name, address (/slug) and description of the project. Clicking the card opens its Studio.',
        'Nombre, dirección (/slug) y descripción del proyecto. Hacer clic en la tarjeta abre su Studio.',
      ], OPT),
      st('status', 'portal.pj_status', ['Situação', 'Status', 'Estado'], [
        'Ativo ou Inativo. Se houver alterações estruturais do banco aguardando revisão, aparece também o selo "Sincronização pendente": clique nele para revisar.',
        'Active or Inactive. If structural database changes are waiting for review, the "Pending sync" badge also shows: click it to review.',
        'Activo o Inactivo. Si hay cambios estructurales de la base esperando revisión, aparece también la insignia "Sincronización pendiente": haga clic para revisar.',
      ], OPT),
      st('stats', 'portal.pj_stats', ['Tabelas e casos de uso', 'Tables and use cases', 'Tablas y casos de uso'], [
        'Quantas tabelas o projeto já sincronizou do banco do cliente e o atalho para os casos de uso.',
        'How many tables the project has already synced from the customer database and the shortcut to the use cases.',
        'Cuántas tablas el proyecto ya sincronizó de la base del cliente y el atajo a los casos de uso.',
      ], OPT),
      st('enter', 'portal.pj_enter', ['Entrar no Studio', 'Enter the Studio', 'Entrar al Studio'], [
        'O botão redondo abre o Studio do projeto, onde você cria e edita os casos de uso.',
        'The round button opens the project Studio, where you create and edit the use cases.',
        'El botón redondo abre el Studio del proyecto, donde crea y edita los casos de uso.',
      ], OPT),
      st('actions', 'portal.pj_actions', ['Ícones do cartão', 'Card icons', 'Íconos de la tarjeta'], [
        'Passe o mouse sobre o cartão para ver as ações. Quais aparecem depende do seu papel e do plano. Vamos ver um a um.',
        'Hover the card to see the actions. Which ones show depends on your role and plan. Let us see them one by one.',
        'Pase el mouse sobre la tarjeta para ver las acciones. Cuáles aparecen depende de su rol y plan. Los veremos uno por uno.',
      ], OPT),
      st('act-open', 'portal.pj_act_open', ['Acessar versão publicada', 'Open published version', 'Acceder a la versión publicada'], [
        'Abre o app do projeto como o usuário final o vê, no endereço publicado.',
        'Opens the project app as the end user sees it, at the published address.',
        'Abre la app del proyecto como la ve el usuario final, en la dirección publicada.',
      ], OPT),
      st('act-desktop', 'portal.pj_act_desktop', ['Gerar App Desktop Nativo', 'Generate Native Desktop App', 'Generar App de Escritorio Nativo'], [
        'Empacota o projeto como um aplicativo de desktop instalável. Exclusivo da IDE Desktop.',
        'Packages the project as an installable desktop application. Exclusive to the Desktop IDE.',
        'Empaqueta el proyecto como una aplicación de escritorio instalable. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('act-ide', 'portal.pj_act_ide', ['IDE Local (Ejetar & Sincronizar)', 'Local IDE (Eject & Sync)', 'IDE Local (Eyectar y Sincronizar)'], [
        'Abre a IDE Local do projeto: ejeta o app (Node ou Java) para uma pasta, edita o código, usa o Git e sincroniza de volta. Exclusivo da IDE Desktop.',
        'Opens the Local IDE of the project: ejects the app (Node or Java) to a folder, edits the code, uses Git and syncs back. Exclusive to the Desktop IDE.',
        'Abre la IDE Local del proyecto: eyecta la app (Node o Java) a una carpeta, edita el código, usa Git y sincroniza de vuelta. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('act-tests', 'portal.pj_act_tests', ['Ambiente de Testes', 'Test Environment', 'Entorno de Pruebas'], [
        'Abre o Ambiente de Testes, o mesmo da IDE Local. Só vale depois de sincronizar o projeto na IDE (pasta em AGTech\\MetaBuilderPRO).',
        'Opens the Test Environment, the same as in the Local IDE. It only works after the project is synced in the IDE (folder in AGTech\\MetaBuilderPRO).',
        'Abre el Entorno de Pruebas, el mismo de la IDE Local. Solo vale después de sincronizar el proyecto en la IDE (carpeta en AGTech\\MetaBuilderPRO).',
      ], { ...OPT, ideOnly: true }),
      st('act-portal', 'portal.pj_act_portal', ['Adicionar ou remover do Portal', 'Add to or remove from the Portal', 'Agregar o quitar del Portal'], [
        'Mostra ou esconde este projeto na vitrine do portal do workspace. Quando o ícone está destacado, o projeto está no portal. Vale na hora.',
        'Shows or hides this project in the workspace portal showcase. When the icon is highlighted, the project is in the portal. It applies right away.',
        'Muestra u oculta este proyecto en la vitrina del portal del workspace. Cuando el ícono está resaltado, el proyecto está en el portal. Vale al instante.',
      ], OPT),
      st('act-toggle', 'portal.pj_act_toggle', ['Desativar ou ativar', 'Deactivate or activate', 'Desactivar o activar'], [
        'Muda a situação do projeto entre Ativo e Inativo, sem apagar nada. Dá para ativar de novo quando quiser.',
        'Switches the project between Active and Inactive, without deleting anything. You can activate it again whenever you want.',
        'Cambia el proyecto entre Activo e Inactivo, sin borrar nada. Se puede activar de nuevo cuando quiera.',
      ], OPT),
      st('act-edit', 'portal.pj_act_edit', ['Editar projeto', 'Edit project', 'Editar proyecto'], [
        'Abre o mesmo painel do "Novo projeto", com os dados atuais. As mudanças só valem ao salvar.',
        'Opens the same panel as "New project", with the current data. Changes only apply on save.',
        'Abre el mismo panel de "Nuevo proyecto", con los datos actuales. Los cambios solo valen al guardar.',
      ], OPT),
      st('act-delete', 'portal.pj_act_delete', ['Excluir projeto', 'Delete project', 'Eliminar proyecto'], [
        'Pede confirmação antes de excluir. Hoje a lixeira cobre só os casos de uso: a exclusão de um projeto não volta, então confira antes.',
        'Asks for confirmation before deleting. Today the trash covers only use cases: deleting a project cannot be undone, so double-check.',
        'Pide confirmación antes de eliminar. Hoy la papelera cubre solo los casos de uso: eliminar un proyecto no se deshace, así que revise antes.',
      ], OPT),
      st('add-card', 'portal.pj_add_card', ['Atalho para criar', 'Shortcut to create', 'Atajo para crear'], [
        'O cartão pontilhado faz o mesmo que o botão "Novo projeto" do topo.',
        'The dotted card does the same as the "New project" button at the top.',
        'La tarjeta punteada hace lo mismo que el botón "Nuevo proyecto" de arriba.',
      ], OPT),
      // a janela do portal abre por este passo (só navega, nada é gravado) e é fechada no fim
      st('portal-info', 'portal.portal_info', ['Configurações do portal', 'Portal settings', 'Configuraciones del portal'], [
        'Esta janela personaliza a tela de login global do portal de aplicações do workspace. Para ver como fica, abrimos a janela por você: nada é gravado.',
        'This window customizes the global login screen of the workspace applications portal. To show it, we opened the window for you: nothing is saved.',
        'Esta ventana personaliza la pantalla de login global del portal de aplicaciones del workspace. Para mostrarla, abrimos la ventana por usted: no se guarda nada.',
      ], { ...OPT, enterClick: 'portal.pj_customize', backClick: 'portal.portal_cancel' }),
      st('portal-logo', 'portal.portal_logo', ['Logo do portal', 'Portal logo', 'Logo del portal'], [
        'Endereço (URL) de uma imagem para o logo. Opcional: sem ele vale o logo padrão.',
        'Address (URL) of an image for the logo. Optional: without it the default logo is used.',
        'Dirección (URL) de una imagen para el logo. Opcional: sin ella vale el logo estándar.',
      ], OPT),
      st('portal-banner', 'portal.portal_banner', ['Banner do portal', 'Portal banner', 'Banner del portal'], [
        'Endereço (URL) da imagem de fundo ou banner. Também opcional.',
        'Address (URL) of the background or banner image. Also optional.',
        'Dirección (URL) de la imagen de fondo o banner. También opcional.',
      ], OPT),
      st('portal-save', 'portal.portal_save', ['Salvar ou cancelar', 'Save or cancel', 'Guardar o cancelar'], [
        '"Salvar" grava o logo e o banner do portal; "Cancelar" fecha sem gravar. O tour fecha a janela sozinho ao terminar.',
        '"Save" stores the portal logo and banner; "Cancel" closes without saving. The tour closes the window by itself when it ends.',
        '"Guardar" graba el logo y el banner del portal; "Cancelar" cierra sin grabar. El tour cierra la ventana solo al terminar.',
      ], OPT),
    ],
  },
]
