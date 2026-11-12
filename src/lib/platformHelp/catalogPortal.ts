/**
 * Tours do portal: a tela de workspaces (/workspace) e a de projetos de um workspace (/admin/:workspace).
 * Cliques livres (`freeClicks`): a pessoa pode clicar no ícone destacado para experimentar. São só leitura os passos que navegam ou gravam na hora
 * (entrar, ativar/desativar, portal); os botões de confirmar exclusão e de salvar o portal nunca respondem (`neverClick`) e o tour fecha o que ficou aberto.
 * Os ícones sem permissão aparecem desativados (LockedAction), então o passo existe para todos os papéis. Funções exclusivas da IDE Desktop levam `ideOnly`.
 * Cada alvo é um `data-help-id` de WorkspaceManager, ProjectManager, ProjectCard e WorkspacePortalModal.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'
import { STUDIO_TABS_TOURS } from './catalogStudioTabs'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const WS = '/workspace'
const PJ = '/admin/:workspace'
const OPT = { skipIfMissing: true }

const BASE_PORTAL_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── workspaces ─────────────────────────
  {
    id: 'portal-workspaces',
    route: WS,
    freeClicks: true,
    neverClick: ['portal.ws_delete_yes', 'portal.desktop_generate'],
    cleanupClick: ['portal.ws_delete_cancel', 'portal.desktop_cancel'],
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
      st('trash', 'portal.ws_trash', ['Lixeira de workspaces', 'Workspace trash', 'Papelera de workspaces'], [
        'Guarda os workspaces excluídos, com todos os projetos deles, pelo prazo definido pela plataforma. Lá você busca pelo nome, restaura (tudo volta como estava, com os mesmos endereços) ou apaga de vez. Só aparece o que você tem permissão de excluir. Aqui o botão só é destacado.',
        'Keeps deleted workspaces, with all their projects, for the period set by the platform. There you search by name, restore (everything comes back as it was, with the same addresses) or erase for good. You only see what you are allowed to delete. Here the button is only highlighted.',
        'Guarda los workspaces eliminados, con todos sus proyectos, por el plazo definido por la plataforma. Allí busca por nombre, restaura (todo vuelve como estaba, con las mismas direcciones) o borra definitivamente. Solo aparece lo que usted puede eliminar. Aquí el botón solo se resalta.',
      ], { ...OPT, readOnly: true }),
      st('card', 'portal.ws_card', ['O cartão do workspace', 'The workspace card', 'La tarjeta del workspace'], [
        'Mostra o nome, o endereço (/slug) e quantos projetos ele tem. Clicar no cartão, ou no botão redondo, abre os projetos do workspace.',
        'Shows the name, the address (/slug) and how many projects it has. Clicking the card, or the round button, opens the projects of the workspace.',
        'Muestra el nombre, la dirección (/slug) y cuántos proyectos tiene. Hacer clic en la tarjeta, o en el botón redondo, abre los proyectos del workspace.',
      ], { ...OPT, readOnly: true }),
      st('actions', 'portal.ws_actions', ['Ícones do cartão', 'Card icons', 'Íconos de la tarjeta'], [
        'Ao passar o mouse sobre o cartão aparecem os ícones de ação. O que o seu papel ou plano não permite fica desativado, com o motivo no balãozinho do ícone. Vamos ver um a um nos próximos passos.',
        'When you hover the card, the action icons show up. What your role or plan does not allow is disabled, with the reason in the icon tooltip. Let us see them one by one in the next steps.',
        'Al pasar el mouse sobre la tarjeta aparecen los íconos de acción. Lo que su rol o plan no permite queda desactivado, con el motivo en el tooltip del ícono. Los veremos uno por uno en los próximos pasos.',
      ], { ...OPT, readOnly: true }),
      st('act-open', 'portal.ws_act_open', ['Acessar Portal', 'Open Portal', 'Acceder al Portal'], [
        'Abre o portal do workspace, a vitrine com os projetos marcados para aparecer nele. Fica desativado enquanto nenhum projeto do workspace estiver no portal.',
        'Opens the workspace portal, the showcase with the projects marked to show in it. It stays disabled while no project of the workspace is in the portal.',
        'Abre el portal del workspace, la vitrina con los proyectos marcados para aparecer en él. Queda desactivado mientras ningún proyecto del workspace esté en el portal.',
      ]),
      st('act-desktop', 'portal.ws_act_desktop', ['Gerar App Desktop Nativo', 'Generate Native Desktop App', 'Generar App de Escritorio Nativo'], [
        'Empacota o workspace como um aplicativo de desktop instalável. Exclusivo da IDE Desktop.',
        'Packages the workspace as an installable desktop application. Exclusive to the Desktop IDE.',
        'Empaqueta el workspace como una aplicación de escritorio instalable. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true, ideClick: true }),
      st('act-ide', 'portal.ws_act_ide', ['IDE Local (Sincronizar)', 'Local IDE (Sync)', 'IDE Local (Sincronizar)'], [
        'Abre a IDE Local do workspace: traz os apps para uma pasta do seu computador, edita o código e sincroniza de volta. É onde ficam também o ejetar e o Git. Exclusivo da IDE Desktop.',
        'Opens the Local IDE of the workspace: brings the apps to a folder on your computer, edits the code and syncs back. It is also where eject and Git live. Exclusive to the Desktop IDE.',
        'Abre la IDE Local del workspace: trae las apps a una carpeta de su computador, edita el código y sincroniza de vuelta. Allí también están eyectar y Git. Exclusivo de la IDE Desktop.',
      ], { ideOnly: true }),
      st('act-edit', 'portal.ws_act_edit', ['Editar workspace', 'Edit workspace', 'Editar workspace'], [
        'Abre o painel de edição para mudar os dados do workspace. As mudanças só valem ao salvar.',
        'Opens the edit panel to change the workspace data. Changes only apply on save.',
        'Abre el panel de edición para cambiar los datos del workspace. Los cambios solo valen al guardar.',
      ]),
      st('act-delete', 'portal.ws_act_delete', ['Excluir workspace', 'Delete workspace', 'Eliminar workspace'], [
        'Pede confirmação antes de excluir. O workspace e todos os projetos dele vão para a lixeira (ícone de lixeira ao lado de Atualizar) e podem ser restaurados dentro do prazo definido pela plataforma; depois disso são apagados de vez.',
        'Asks for confirmation before deleting. The workspace and all its projects go to the trash (trash icon next to Refresh) and can be restored within the period set by the platform; after that they are erased for good.',
        'Pide confirmación antes de eliminar. El workspace y todos sus proyectos van a la papelera (ícono de papelera junto a Actualizar) y pueden restaurarse dentro del plazo definido por la plataforma; después se borran definitivamente.',
      ]),
      st('act-ai', 'portal.ws_act_ai', ['Configurações de IA', 'AI settings', 'Configuraciones de IA'], [
        'Define como o AI Builder trabalha neste workspace. Só o dono, no plano PRO, pode usar; para os demais o ícone fica desativado.',
        'Defines how the AI Builder works in this workspace. Only the owner, on the PRO plan, can use it; for everyone else the icon is disabled.',
        'Define cómo trabaja el AI Builder en este workspace. Solo el dueño, en el plan PRO, puede usarlo; para los demás el ícono queda desactivado.',
      ]),
      st('enter', 'portal.ws_enter', ['Entrar no workspace', 'Enter the workspace', 'Entrar al workspace'], [
        'Mostra o número de projetos e leva para a lista deles. É o caminho normal para começar a trabalhar.',
        'Shows the number of projects and takes you to their list. It is the normal way to start working.',
        'Muestra el número de proyectos y lleva a su lista. Es el camino normal para empezar a trabajar.',
      ], { ...OPT, readOnly: true }),
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
    freeClicks: true,
    neverClick: ['portal.portal_save', 'portal.pj_delete_yes', 'portal.desktop_generate'],
    cleanupClick: ['portal.portal_cancel', 'portal.pj_delete_cancel', 'portal.desktop_cancel', 'portal.test_close'],
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
        'Abre a janela com o logo e o banner da tela de login do portal. Aparece quando há projetos no portal e você pode criar projetos. Clique no botão para ver a janela: os próximos passos explicam cada campo (nada é gravado).',
        'Opens the window with the logo and banner of the portal login screen. It shows when there are projects in the portal and you can create projects. Click the button to see the window: the next steps explain each field (nothing is saved).',
        'Abre la ventana con el logo y el banner de la pantalla de login del portal. Aparece cuando hay proyectos en el portal y usted puede crear proyectos. Haga clic en el botón para ver la ventana: los próximos pasos explican cada campo (no se guarda nada).',
      ], OPT),
      // a janela do portal abre pelo clique da pessoa no passo anterior (ou por este passo, se ela não clicou); só navega, nada é gravado. O passo depois dela a fecha
      st('portal-info', 'portal.portal_info', ['Configurações do portal', 'Portal settings', 'Configuraciones del portal'], [
        'Esta janela personaliza a tela de login global do portal de aplicações do workspace. Se você não clicou, abrimos a janela por você: nada é gravado.',
        'This window customizes the global login screen of the workspace applications portal. If you did not click, we opened the window for you: nothing is saved.',
        'Esta ventana personaliza la pantalla de login global del portal de aplicaciones del workspace. Si no hizo clic, abrimos la ventana por usted: no se guarda nada.',
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
        '"Salvar" grava o logo e o banner do portal; "Cancelar" fecha sem gravar. Ao avançar, o tour fecha a janela sozinho, sem gravar.',
        '"Save" stores the portal logo and banner; "Cancel" closes without saving. When you move on, the tour closes the window by itself, without saving.',
        '"Guardar" graba el logo y el banner del portal; "Cancelar" cierra sin grabar. Al avanzar, el tour cierra la ventana solo, sin grabar.',
      ], OPT),
      st('refresh', 'portal.refresh', ['Atualizar a lista', 'Refresh the list', 'Actualizar la lista'], [
        'Recarrega os projetos, com o total ao lado.',
        'Reloads the projects, with the total next to it.',
        'Recarga los proyectos, con el total al lado.',
      ], { ...OPT, enterClick: 'portal.portal_cancel', backClick: 'portal.pj_customize' }),
      st('trash', 'portal.pj_trash', ['Lixeira de projetos', 'Project trash', 'Papelera de proyectos'], [
        'Guarda os projetos excluídos deste workspace pelo prazo definido pela plataforma. Restaurar traz o projeto de volta com os casos de uso, as tabelas, os perfis e os fluxos de antes, e o mesmo token do túnel. Depois do prazo ele é apagado de vez. O banco do cliente nunca é tocado. Aqui o botão só é destacado.',
        'Keeps the projects deleted from this workspace for the period set by the platform. Restoring brings the project back with its use cases, tables, roles and flows, and the same tunnel token. After the period it is erased for good. The customer database is never touched. Here the button is only highlighted.',
        'Guarda los proyectos eliminados de este workspace por el plazo definido por la plataforma. Restaurar trae el proyecto de vuelta con sus casos de uso, tablas, perfiles y flujos, y el mismo token del túnel. Pasado el plazo se borra definitivamente. La base del cliente nunca se toca. Aquí el botón solo se resalta.',
      ], { ...OPT, readOnly: true }),
      st('card', 'portal.pj_card', ['O cartão do projeto', 'The project card', 'La tarjeta del proyecto'], [
        'Nome, endereço (/slug) e descrição do projeto. Clicar no cartão abre o Studio dele.',
        'Name, address (/slug) and description of the project. Clicking the card opens its Studio.',
        'Nombre, dirección (/slug) y descripción del proyecto. Hacer clic en la tarjeta abre su Studio.',
      ], { ...OPT, readOnly: true }),
      st('status', 'portal.pj_status', ['Situação', 'Status', 'Estado'], [
        'Ativo ou Inativo. Se houver alterações estruturais do banco aguardando revisão, aparece também o selo "Sincronização pendente": clique nele para revisar.',
        'Active or Inactive. If structural database changes are waiting for review, the "Pending sync" badge also shows: click it to review.',
        'Activo o Inactivo. Si hay cambios estructurales de la base esperando revisión, aparece también la insignia "Sincronización pendiente": haga clic para revisar.',
      ], { ...OPT, readOnly: true }),
      st('stats', 'portal.pj_stats', ['Tabelas e casos de uso', 'Tables and use cases', 'Tablas y casos de uso'], [
        'Quantas tabelas o projeto já sincronizou do banco do cliente e o atalho para os casos de uso.',
        'How many tables the project has already synced from the customer database and the shortcut to the use cases.',
        'Cuántas tablas el proyecto ya sincronizó de la base del cliente y el atajo a los casos de uso.',
      ], { ...OPT, readOnly: true }),
      st('enter', 'portal.pj_enter', ['Entrar no Studio', 'Enter the Studio', 'Entrar al Studio'], [
        'O botão redondo abre o Studio do projeto, onde você cria e edita os casos de uso.',
        'The round button opens the project Studio, where you create and edit the use cases.',
        'El botón redondo abre el Studio del proyecto, donde crea y edita los casos de uso.',
      ], { ...OPT, readOnly: true }),
      st('actions', 'portal.pj_actions', ['Ícones do cartão', 'Card icons', 'Íconos de la tarjeta'], [
        'Passe o mouse sobre o cartão para ver as ações. O que o seu papel ou plano não permite fica desativado, com o motivo no balãozinho do ícone. Vamos ver um a um nos próximos passos.',
        'Hover the card to see the actions. What your role or plan does not allow is disabled, with the reason in the icon tooltip. Let us see them one by one in the next steps.',
        'Pase el mouse sobre la tarjeta para ver las acciones. Lo que su rol o plan no permite queda desactivado, con el motivo en el tooltip del ícono. Los veremos uno por uno en los próximos pasos.',
      ], { ...OPT, readOnly: true }),
      st('act-open', 'portal.pj_act_open', ['Acessar versão publicada', 'Open published version', 'Acceder a la versión publicada'], [
        'Abre o app do projeto como o usuário final o vê, no endereço publicado.',
        'Opens the project app as the end user sees it, at the published address.',
        'Abre la app del proyecto como la ve el usuario final, en la dirección publicada.',
      ], OPT),
      st('act-desktop', 'portal.pj_act_desktop', ['Gerar App Desktop Nativo', 'Generate Native Desktop App', 'Generar App de Escritorio Nativo'], [
        'Empacota o projeto como um aplicativo de desktop instalável. Exclusivo da IDE Desktop.',
        'Packages the project as an installable desktop application. Exclusive to the Desktop IDE.',
        'Empaqueta el proyecto como una aplicación de escritorio instalable. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true, ideClick: true }),
      st('act-ide', 'portal.pj_act_ide', ['IDE Local (Ejetar & Sincronizar)', 'Local IDE (Eject & Sync)', 'IDE Local (Eyectar y Sincronizar)'], [
        'Abre a IDE Local do projeto: ejeta o app (Node ou Java) para uma pasta, edita o código, usa o Git e sincroniza de volta. Exclusivo da IDE Desktop.',
        'Opens the Local IDE of the project: ejects the app (Node or Java) to a folder, edits the code, uses Git and syncs back. Exclusive to the Desktop IDE.',
        'Abre la IDE Local del proyecto: eyecta la app (Node o Java) a una carpeta, edita el código, usa Git y sincroniza de vuelta. Exclusivo de la IDE Desktop.',
      ], { ideOnly: true }),
      st('act-tests', 'portal.pj_act_tests', ['Ambiente de Testes', 'Test Environment', 'Entorno de Pruebas'], [
        'Abre o Ambiente de Testes, o mesmo da IDE Local. Só vale depois de sincronizar o projeto na IDE (pasta em AGTech\\MetaBuilderPRO). Na IDE você pode clicar para abrir e conhecer a janela; durante o tour nada é executado.',
        'Opens the Test Environment, the same as in the Local IDE. It only works after the project is synced in the IDE (folder in AGTech\\MetaBuilderPRO). In the IDE you can click to open and explore the window; nothing runs during the tour.',
        'Abre el Entorno de Pruebas, el mismo de la IDE Local. Solo vale después de sincronizar el proyecto en la IDE (carpeta en AGTech\\MetaBuilderPRO). En la IDE puede hacer clic para abrir y conocer la ventana; durante el tour no se ejecuta nada.',
      ], { ...OPT, ideOnly: true, ideClick: true }),
      st('act-portal', 'portal.pj_act_portal', ['Adicionar ou remover do Portal', 'Add to or remove from the Portal', 'Agregar o quitar del Portal'], [
        'Mostra ou esconde este projeto na vitrine do portal do workspace. Quando o ícone está destacado, o projeto está no portal. Vale na hora.',
        'Shows or hides this project in the workspace portal showcase. When the icon is highlighted, the project is in the portal. It applies right away.',
        'Muestra u oculta este proyecto en la vitrina del portal del workspace. Cuando el ícono está resaltado, el proyecto está en el portal. Vale al instante.',
      ], { readOnly: true }),
      st('act-toggle', 'portal.pj_act_toggle', ['Desativar ou ativar', 'Deactivate or activate', 'Desactivar o activar'], [
        'Muda a situação do projeto entre Ativo e Inativo, sem apagar nada. Dá para ativar de novo quando quiser.',
        'Switches the project between Active and Inactive, without deleting anything. You can activate it again whenever you want.',
        'Cambia el proyecto entre Activo e Inactivo, sin borrar nada. Se puede activar de nuevo cuando quiera.',
      ], { readOnly: true }),
      st('act-edit', 'portal.pj_act_edit', ['Editar projeto', 'Edit project', 'Editar proyecto'], [
        'Abre o mesmo painel do "Novo projeto", com os dados atuais. As mudanças só valem ao salvar.',
        'Opens the same panel as "New project", with the current data. Changes only apply on save.',
        'Abre el mismo panel de "Nuevo proyecto", con los datos actuales. Los cambios solo valen al guardar.',
      ]),
      st('act-delete', 'portal.pj_act_delete', ['Excluir projeto', 'Delete project', 'Eliminar proyecto'], [
        'Pede confirmação antes de excluir. O projeto vai para a lixeira (ícone de lixeira ao lado de Atualizar) e pode ser restaurado dentro do prazo definido pela plataforma; depois disso é apagado de vez.',
        'Asks for confirmation before deleting. The project goes to the trash (trash icon next to Refresh) and can be restored within the period set by the platform; after that it is erased for good.',
        'Pide confirmación antes de eliminar. El proyecto va a la papelera (ícono de papelera junto a Actualizar) y puede restaurarse dentro del plazo definido por la plataforma; después se borra definitivamente.',
      ]),
      st('add-card', 'portal.pj_add_card', ['Atalho para criar', 'Shortcut to create', 'Atajo para crear'], [
        'O cartão pontilhado faz o mesmo que o botão "Novo projeto" do topo.',
        'The dotted card does the same as the "New project" button at the top.',
        'La tarjeta punteada hace lo mismo que el botón "Nuevo proyecto" de arriba.',
      ], OPT),
    ],
  },
]

// ───────────────────────── abas do portal (só na IDE Desktop) ─────────────────────────
// São os mesmos componentes das abas do Studio (Gerenciador do Túnel e Bancos Sincronizados): os passos vêm dos tours do Studio,
// trocando só a aba de entrada e o texto do botão de sincronizar, que aqui sincroniza o workspace inteiro.
const IDE_ONLY_HINT = h(['Disponível só na IDE Desktop: estas abas não existem no site.', 'Only in the Desktop IDE: these tabs do not exist on the site.', 'Disponible solo en la IDE Desktop: estas pestañas no existen en el sitio.'])

const SYNC_TEXT = {
  ws: {
    title: ['Sincronização global', 'Global sync', 'Sincronización global'] as T3,
    body: [
      'Lê a estrutura de todos os bancos configurados no metabuilder.config.json (tabelas, colunas, relacionamentos) e atualiza os projetos. Não mexe nos dados nem para o túnel. Se houver mudanças estruturais, o projeto fica com "Sincronização pendente" para você revisar.',
      'Reads the structure of all databases set in metabuilder.config.json (tables, columns, relationships) and updates the projects. It does not touch the data nor stop the tunnel. If there are structural changes, the project is flagged "Pending sync" for you to review.',
      'Lee la estructura de todas las bases configuradas en metabuilder.config.json (tablas, columnas, relaciones) y actualiza los proyectos. No toca los datos ni detiene el túnel. Si hay cambios estructurales, el proyecto queda con "Sincronización pendiente" para que los revise.',
    ] as T3,
  },
  pj: {
    title: ['Sincronizar o workspace', 'Sync the workspace', 'Sincronizar el workspace'] as T3,
    body: [
      'Lê a estrutura dos bancos dos projetos deste workspace (tabelas, colunas, relacionamentos) e atualiza os projetos. Não mexe nos dados nem para o túnel. Se houver mudanças estruturais, o projeto fica com "Sincronização pendente" para você revisar.',
      'Reads the structure of the databases of the projects in this workspace (tables, columns, relationships) and updates the projects. It does not touch the data nor stop the tunnel. If there are structural changes, the project is flagged "Pending sync" for you to review.',
      'Lee la estructura de las bases de los proyectos de este workspace (tablas, columnas, relaciones) y actualiza los proyectos. No toca los datos ni detiene el túnel. Si hay cambios estructurales, el proyecto queda con "Sincronización pendiente" para que los revise.',
    ] as T3,
  },
}

function fromStudioTab(srcId: string, id: string, route: string, tab: string, scope: 'ws' | 'pj'): PlatformTour {
  const src = STUDIO_TABS_TOURS.find(t => t.id === srcId)
  if (!src) throw new Error('tour do Studio não encontrado: ' + srcId)
  return {
    ...src,
    id,
    route,
    needs: tab,
    needsHint: IDE_ONLY_HINT,
    recover: [tab],
    steps: src.steps.map((s, i) => {
      if (i === 0) return { ...s, target: tab, enterClick: tab }
      if (s.id === 'sync') return { ...s, title: h(SYNC_TEXT[scope].title), body: h(SYNC_TEXT[scope].body) }
      return s
    }),
  }
}

// ───────────────────────── gerador de instalador desktop (só na IDE Desktop) ─────────────────────────
// A mesma janela abre pelo cartão do projeto (/admin/:workspace) e pelo do workspace (/workspace). O tour abre a janela, mostra os campos e nunca gera.
function desktopTour(id: string, route: string, icon: string, scope: 'ws' | 'pj'): PlatformTour {
  const what: T3 = scope === 'ws'
    ? ['o Portal de Aplicações do workspace', 'the workspace Applications Portal', 'el Portal de Aplicaciones del workspace']
    : ['este projeto', 'this project', 'este proyecto']
  return {
    id,
    route,
    needs: icon,
    needsHint: IDE_ONLY_HINT,
    neverClick: ['portal.desktop_generate'],
    cleanupClick: ['portal.desktop_cancel'],
    title: h(scope === 'ws'
      ? ['Instalador Desktop do workspace', 'Workspace Desktop installer', 'Instalador de escritorio del workspace']
      : ['Instalador Desktop do projeto', 'Project Desktop installer', 'Instalador de escritorio del proyecto']),
    summary: h(['A janela que transforma em um aplicativo Windows (.msi) com a sua marca: nome, versão, ícone, banco e notas da versão.', 'The window that turns it into a Windows application (.msi) with your brand: name, version, icon, database and release notes.', 'La ventana que lo convierte en una aplicación de Windows (.msi) con su marca: nombre, versión, ícono, base y notas de la versión.']),
    steps: [
      st('button', icon, ['Gerar App Desktop Nativo', 'Generate Native Desktop App', 'Generar App de Escritorio Nativo'], [
        `Empacota ${what[0]} como um aplicativo de desktop instalável. Exclusivo da IDE Desktop. Abrimos a janela por você no próximo passo; nada é gerado.`,
        `Packages ${what[1]} as an installable desktop application. Exclusive to the Desktop IDE. We open the window for you in the next step; nothing is generated.`,
        `Empaqueta ${what[2]} como una aplicación de escritorio instalable. Exclusivo de la IDE Desktop. Abrimos la ventana por usted en el próximo paso; no se genera nada.`,
      ], { ...OPT, ideOnly: true, readOnly: true }),
      st('header', 'portal.desktop_header', ['O Gerador de Instalador Desktop', 'The Desktop Installer Generator', 'El Generador de Instalador de Escritorio'], [
        'Gera um instalador do Windows (.msi). Preencha os campos e clique em Gerar; fechar a janela não gera nada.',
        'Generates a Windows installer (.msi). Fill in the fields and click Generate; closing the window generates nothing.',
        'Genera un instalador de Windows (.msi). Complete los campos y haga clic en Generar; cerrar la ventana no genera nada.',
      ], { ...OPT, ideOnly: true, enterClick: icon, backClick: 'portal.desktop_cancel' }),
      st('info', 'portal.desktop_info', ['Aplicativo White-Label', 'White-Label application', 'Aplicación White-Label'], [
        'O instalador empacota o código atual e sai com a sua marca (nome, ícone e versão), com a conexão de banco nativa quando você informar uma.',
        'The installer packages the current code and comes out with your brand (name, icon and version), with the native database connection when you provide one.',
        'El instalador empaqueta el código actual y sale con su marca (nombre, ícono y versión), con la conexión de base nativa cuando usted informe una.',
      ], { ...OPT, ideOnly: true }),
      st('name', 'portal.desktop_name', ['Nome do software', 'Software name', 'Nombre del software'], [
        'O nome do aplicativo instalado. É obrigatório: sem ele o botão Gerar fica desativado. Pode digitar para experimentar; nada é gerado.',
        'The name of the installed application. It is required: without it the Generate button is disabled. You can type to try it; nothing is generated.',
        'El nombre de la aplicación instalada. Es obligatorio: sin él el botón Generar queda desactivado. Puede escribir para probar; no se genera nada.',
      ], { ...OPT, interactive: true }),
      st('desc', 'portal.desktop_desc', ['Descrição curta', 'Short description', 'Descripción corta'], [
        'Uma linha que descreve o sistema, mostrada no instalador.',
        'A line describing the system, shown in the installer.',
        'Una línea que describe el sistema, mostrada en el instalador.',
      ], { ...OPT, interactive: true }),
      st('version', 'portal.desktop_version', ['Versão do app', 'App version', 'Versión de la app'], [
        'O número da versão do instalador, por exemplo 1.0.0. Suba a versão a cada novo instalador.',
        'The installer version number, for example 1.0.0. Raise the version with each new installer.',
        'El número de versión del instalador, por ejemplo 1.0.0. Suba la versión con cada nuevo instalador.',
      ], { ...OPT, interactive: true }),
      st('icon', 'portal.desktop_icon', ['Ícone do app', 'App icon', 'Ícono de la app'], [
        'Um PNG quadrado (por exemplo 512x512) que vira o ícone do aplicativo. O envio abre o seletor de arquivos do sistema; durante o tour esta área fica só para leitura.',
        'A square PNG (for example 512x512) that becomes the application icon. Uploading opens the system file picker; during the tour this area is read-only.',
        'Un PNG cuadrado (por ejemplo 512x512) que pasa a ser el ícono de la aplicación. El envío abre el selector de archivos del sistema; durante el tour esta área queda solo de lectura.',
      ], { ...OPT, ideOnly: true, readOnly: true }),
      st('db', 'portal.desktop_db', ['Connection string do banco', 'Database connection string', 'Connection string de la base'], [
        'Opcional. Se preenchida, a string é embutida no instalador para o aplicativo falar direto com o banco. Cuidado: ela vai dentro do arquivo instalável e carrega a senha do banco. Não digite uma real durante o tour.',
        'Optional. If filled in, the string is embedded in the installer so the application talks directly to the database. Careful: it goes inside the installable file and carries the database password. Do not type a real one during the tour.',
        'Opcional. Si se completa, la cadena se incrusta en el instalador para que la aplicación hable directo con la base. Cuidado: va dentro del archivo instalable y lleva la contraseña de la base. No escriba una real durante el tour.',
      ], { ...OPT, interactive: true }),
      st('url', 'portal.desktop_url', ['URL da aplicação web', 'Web application URL', 'URL de la aplicación web'], [
        'Para o modo Wrapper: o endereço do backend central quando o aplicativo funciona como cliente do app publicado.',
        'For Wrapper mode: the address of the central backend when the application works as a client of the published app.',
        'Para el modo Wrapper: la dirección del backend central cuando la aplicación funciona como cliente de la app publicada.',
      ], { ...OPT, interactive: true }),
      st('notes', 'portal.desktop_notes', ['Notas da versão', 'Release notes', 'Notas de la versión'], [
        'Opcional. O que há de novo nesta versão: aparece no histórico de atualizações para os usuários do aplicativo.',
        'Optional. What is new in this version: it shows in the update history for the application users.',
        'Opcional. Qué hay de nuevo en esta versión: aparece en el historial de actualizaciones para los usuarios de la aplicación.',
      ], { ...OPT, interactive: true }),
      st('generate', 'portal.desktop_generate', ['Gerar Instalador (.msi)', 'Generate Installer (.msi)', 'Generar Instalador (.msi)'], [
        'Inicia a geração do instalador, que leva alguns minutos. O tour nunca clica neste botão.',
        'Starts generating the installer, which takes a few minutes. The tour never clicks this button.',
        'Inicia la generación del instalador, que tarda unos minutos. El tour nunca hace clic en este botón.',
      ], { ...OPT, ideOnly: true, readOnly: true }),
      st('close', 'portal.desktop_cancel', ['Cancelar', 'Cancel', 'Cancelar'], [
        'Fecha a janela sem gerar. Ao terminar o tour, fechamos a janela por você.',
        'Closes the window without generating. When the tour ends, we close the window for you.',
        'Cierra la ventana sin generar. Al terminar el tour, cerramos la ventana por usted.',
      ], { ...OPT, ideOnly: true, readOnly: true }),
    ],
  }
}

export const PORTAL_TOURS: readonly PlatformTour[] = [
  ...BASE_PORTAL_TOURS,
  fromStudioTab('studio-tunel', 'portal-ws-tunel', WS, 'portal.ws_tab_tunnel', 'ws'),
  fromStudioTab('studio-bancos-sincronizados', 'portal-ws-bancos', WS, 'portal.ws_tab_synced', 'ws'),
  fromStudioTab('studio-tunel', 'portal-pj-tunel', PJ, 'portal.pj_tab_tunnel', 'pj'),
  fromStudioTab('studio-bancos-sincronizados', 'portal-pj-bancos', PJ, 'portal.pj_tab_synced', 'pj'),
  desktopTour('portal-ws-desktop', WS, 'portal.ws_act_desktop', 'ws'),
  desktopTour('portal-pj-desktop', PJ, 'portal.pj_act_desktop', 'pj'),
]
