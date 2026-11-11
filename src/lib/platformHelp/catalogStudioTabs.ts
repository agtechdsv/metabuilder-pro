/**
 * Tours das abas do dashboard do Studio que não são a lista de casos de uso: Navegação, Enums, Gerenciador do Túnel,
 * Bancos Sincronizados e Central de Ajuda. Cada tour abre a própria aba (só navegação) e explica; nada é gravado.
 * Alvos: `data-help-id` de StudioDashboardClient (abas), MenuBuilder, EnumerationsClient, WorkspaceTunnelControl,
 * WorkspaceSyncedDatabases, HelpCenterStudio e InteractiveHelpEditor.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const STUDIO = '/admin/:workspace/:project/studio'
const OPT = { skipIfMissing: true }
const HINT = h(['Abra a aba Casos de Uso do Studio para usar este tour.', 'Open the Use Cases tab of the Studio to use this tour.', 'Abra la pestaña Casos de Uso del Studio para usar este tour.'])

export const STUDIO_TABS_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── Navegação ─────────────────────────
  {
    id: 'studio-navegacao',
    route: STUDIO,
    needs: 'studio.tab_nav',
    needsHint: HINT,
    recover: ['studio.tab_nav'],
    title: h(['Navegação: o menu do app', 'Navigation: the app menu', 'Navegación: el menú de la app']),
    summary: h(['Como montar o menu que seus usuários veem: itens, pastas, ordem e o que aparece no dashboard.', 'How to build the menu your users see: items, folders, order and what shows on the dashboard.', 'Cómo armar el menú que ven sus usuarios: ítems, carpetas, orden y qué aparece en el dashboard.']),
    steps: [
      st('tab', 'studio.tab_nav', ['A aba Navegação', 'The Navigation tab', 'La pestaña Navegación'], [
        'Aqui você monta o menu de navegação do app publicado: quais telas aparecem, em que ordem e dentro de quais pastas. Abrimos a aba por você.',
        'Here you build the navigation menu of the published app: which screens show, in what order and inside which folders. We opened the tab for you.',
        'Aquí arma el menú de navegación de la app publicada: qué pantallas aparecen, en qué orden y dentro de qué carpetas. Abrimos la pestaña por usted.',
      ], { enterClick: 'studio.tab_nav' }),
      st('header', 'studio.nav_header', ['Gerador de menu', 'Menu generator', 'Generador de menú'], [
        'Organize como seus usuários vão navegar no app. Tudo o que você mexer só vale depois de "Salvar estrutura".',
        'Organize how your users will navigate the app. Anything you change only applies after "Save structure".',
        'Organice cómo navegarán sus usuarios en la app. Todo lo que cambie solo vale después de "Guardar estructura".',
      ]),
      st('drag', 'studio.nav_drag', ['Arrastar para reordenar', 'Drag to reorder', 'Arrastrar para reordenar'], [
        'Segure a alça e arraste para mudar a ordem do item ou para colocá-lo dentro de uma pasta.',
        'Hold the handle and drag to change the order of the item or to put it inside a folder.',
        'Mantenga la asa y arrastre para cambiar el orden del ítem o ponerlo dentro de una carpeta.',
      ], OPT),
      st('icon', 'studio.nav_icon', ['Ícone', 'Icon', 'Ícono'], [
        'O ícone que aparece ao lado do nome no menu. Clique para escolher outro.',
        'The icon shown next to the name in the menu. Click to pick another one.',
        'El ícono que aparece junto al nombre en el menú. Haga clic para elegir otro.',
      ], OPT),
      st('label', 'studio.nav_label', ['Nome e descrição', 'Name and description', 'Nombre y descripción'], [
        'O nome é o texto do item no menu. Logo abaixo, uma descrição curta, usada no dashboard do app.',
        'The name is the text of the item in the menu. Right below, a short description, used on the app dashboard.',
        'El nombre es el texto del ítem en el menú. Justo debajo, una descripción corta, usada en el dashboard de la app.',
      ], OPT),
      st('target', 'studio.nav_target', ['O que o item abre', 'What the item opens', 'Qué abre el ítem'], [
        'Escolha o caso de uso que o item abre. Também há dois utilitários prontos: a Central de Downloads e a Central de Ajuda. Em itens do tipo link, aqui vai o endereço externo.',
        'Pick the use case the item opens. There are also two ready utilities: the Downloads Center and the Help Center. For link items, the external address goes here.',
        'Elija el caso de uso que abre el ítem. También hay dos utilidades listas: el Centro de Descargas y el Centro de Ayuda. En los ítems de tipo enlace, aquí va la dirección externa.',
      ], OPT),
      st('dash', 'studio.nav_dash', ['Disponibilizar no dashboard', 'Show on the dashboard', 'Mostrar en el dashboard'], [
        'Marcado, o item aparece também como cartão no dashboard do app, além do menu. Desmarque para deixá-lo só no menu.',
        'When checked, the item also shows as a card on the app dashboard, besides the menu. Uncheck to keep it in the menu only.',
        'Marcado, el ítem aparece también como tarjeta en el dashboard de la app, además del menú. Desmarque para dejarlo solo en el menú.',
      ], OPT),
      st('remove', 'studio.nav_remove', ['Remover do menu', 'Remove from the menu', 'Quitar del menú'], [
        'Tira o item do menu. O caso de uso em si não é apagado, só deixa de ter esse atalho. Vale ao salvar.',
        'Takes the item out of the menu. The use case itself is not deleted, it just loses this shortcut. Applies on save.',
        'Quita el ítem del menú. El caso de uso en sí no se borra, solo deja de tener ese atajo. Vale al guardar.',
      ], OPT),
      st('add-link', 'studio.nav_add_link', ['Adicionar link', 'Add link', 'Agregar enlace'], [
        'Cria um item novo no menu, para abrir um caso de uso ou um endereço externo.',
        'Creates a new menu item, to open a use case or an external address.',
        'Crea un ítem nuevo en el menú, para abrir un caso de uso o una dirección externa.',
      ], OPT),
      st('add-folder', 'studio.nav_add_folder', ['Criar menu (pasta)', 'Create menu (folder)', 'Crear menú (carpeta)'], [
        'Cria uma pasta para agrupar itens. Dentro dela, o botão "Adicionar" cria os itens filhos.',
        'Creates a folder to group items. Inside it, the "Add" button creates the child items.',
        'Crea una carpeta para agrupar ítems. Dentro de ella, el botón "Agregar" crea los ítems hijos.',
      ], OPT),
      st('save', 'studio.nav_save', ['Salvar estrutura', 'Save structure', 'Guardar estructura'], [
        'Grava o menu. Sem salvar, nada do que você mexeu vale para os usuários.',
        'Stores the menu. Without saving, nothing you changed applies for the users.',
        'Graba el menú. Sin guardar, nada de lo que cambió vale para los usuarios.',
      ], OPT),
    ],
  },

  // ───────────────────────── Enums ─────────────────────────
  {
    id: 'studio-enums',
    route: STUDIO,
    needs: 'studio.tab_enums',
    needsHint: HINT,
    recover: ['studio.tab_enums'],
    title: h(['Enums: listas de valores fixos', 'Enums: fixed value lists', 'Enums: listas de valores fijos']),
    summary: h(['Para que servem, como criar, importar de outro projeto, editar e excluir.', 'What they are for, how to create, import from another project, edit and delete.', 'Para qué sirven, cómo crear, importar de otro proyecto, editar y eliminar.']),
    neverClick: ['studio.enum_delete'],
    steps: [
      st('tab', 'studio.tab_enums', ['A aba Enums', 'The Enums tab', 'La pestaña Enums'], [
        'Um enum é uma lista de valores fixos (por exemplo, o status de um pedido: Pendente, Entregue, Cancelado). Os casos de uso usam essas listas nos campos de escolha. Abrimos a aba por você.',
        'An enum is a list of fixed values (for example, an order status: Pending, Delivered, Canceled). Use cases use these lists in choice fields. We opened the tab for you.',
        'Un enum es una lista de valores fijos (por ejemplo, el estado de un pedido: Pendiente, Entregado, Cancelado). Los casos de uso usan esas listas en los campos de elección. Abrimos la pestaña por usted.',
      ], { enterClick: 'studio.tab_enums' }),
      st('header', 'studio.enum_header', ['Enumerations globais', 'Global enumerations', 'Enumeraciones globales'], [
        'Gerencie aqui as listas do projeto. Como são globais, mudar um valor aqui vale para todos os casos de uso que a usam.',
        'Manage the project lists here. Since they are global, changing a value here applies to every use case that uses it.',
        'Gestione aquí las listas del proyecto. Como son globales, cambiar un valor aquí vale para todos los casos de uso que la usan.',
      ]),
      st('import', 'studio.enum_import', ['Importar', 'Import', 'Importar'], [
        'Copia enums de outro projeto seu para este, em vez de digitar tudo de novo. Abre uma janela onde você escolhe o projeto e as listas.',
        'Copies enums from another project of yours into this one, instead of typing everything again. Opens a window where you pick the project and the lists.',
        'Copia enums de otro proyecto suyo a este, en vez de escribir todo de nuevo. Abre una ventana donde elige el proyecto y las listas.',
      ], OPT),
      st('new', 'studio.enum_new', ['Novo enum', 'New enum', 'Nuevo enum'], [
        'Abre a janela de criação: o nome da lista e os valores fixos (valor gravado e texto mostrado). Também dá para carregar os valores distintos que já existem em um campo do banco. Nada é gravado até salvar.',
        'Opens the creation window: the list name and the fixed values (stored value and displayed text). You can also load the distinct values that already exist in a database field. Nothing is saved until you save.',
        'Abre la ventana de creación: el nombre de la lista y los valores fijos (valor guardado y texto mostrado). También se pueden cargar los valores distintos que ya existen en un campo de la base. No se guarda nada hasta guardar.',
      ], OPT),
      st('card', 'studio.enum_card', ['O cartão do enum', 'The enum card', 'La tarjeta del enum'], [
        'Mostra o nome e os primeiros valores no formato valor (texto). Quando há mais, aparece "+N itens".',
        'Shows the name and the first values in the format value (text). When there are more, "+N items" shows.',
        'Muestra el nombre y los primeros valores en el formato valor (texto). Cuando hay más, aparece "+N ítems".',
      ], OPT),
      st('edit', 'studio.enum_edit', ['Editar', 'Edit', 'Editar'], [
        'Abre a mesma janela do "Novo enum" com os dados atuais.',
        'Opens the same window as "New enum" with the current data.',
        'Abre la misma ventana de "Nuevo enum" con los datos actuales.',
      ], OPT),
      st('delete', 'studio.enum_delete', ['Excluir', 'Delete', 'Eliminar'], [
        'Pede confirmação antes de excluir. Confira se nenhum caso de uso depende da lista.',
        'Asks for confirmation before deleting. Check that no use case depends on the list.',
        'Pide confirmación antes de eliminar. Verifique que ningún caso de uso dependa de la lista.',
      ], OPT),
    ],
  },

  // ───────────────────────── Gerenciador do Túnel ─────────────────────────
  {
    id: 'studio-tunel',
    route: STUDIO,
    needs: 'studio.tab_tunnel',
    needsHint: HINT,
    recover: ['studio.tab_tunnel'],
    title: h(['Gerenciador do Túnel', 'Tunnel Manager', 'Gestor del Túnel']),
    summary: h(['O programa que liga o MetaBuilder ao banco do cliente: iniciar, parar, configurar, logs e sincronizar.', 'The program that connects MetaBuilder to the customer database: start, stop, configure, logs and sync.', 'El programa que conecta MetaBuilder con la base del cliente: iniciar, detener, configurar, logs y sincronizar.']),
    neverClick: ['studio.tunnel_start', 'studio.tunnel_stop', 'studio.tunnel_sync'],
    steps: [
      st('tab', 'studio.tab_tunnel', ['A aba Gerenciador do Túnel', 'The Tunnel Manager tab', 'La pestaña Gestor del Túnel'], [
        'O túnel é o Agente CLI que roda no computador com acesso ao banco do cliente. Ele é quem executa as consultas do app e sincroniza as tabelas. Abrimos a aba por você.',
        'The tunnel is the CLI Agent that runs on the computer with access to the customer database. It runs the app queries and syncs the tables. We opened the tab for you.',
        'El túnel es el Agente CLI que corre en el computador con acceso a la base del cliente. Él ejecuta las consultas de la app y sincroniza las tablas. Abrimos la pestaña por usted.',
      ], { enterClick: 'studio.tab_tunnel' }),
      st('notice', 'studio.tunnel_notice', ['Só na IDE Desktop', 'Only in the Desktop IDE', 'Solo en la IDE Desktop'], [
        'No navegador esta aba só explica que o gerenciador pertence à IDE Desktop: ele controla um programa do seu computador, que o site não alcança. Para usar, abra o Studio pela IDE (o botão leva ao download).',
        'In the browser this tab only explains that the manager belongs to the Desktop IDE: it controls a program on your computer, which the site cannot reach. To use it, open the Studio through the IDE (the button leads to the download).',
        'En el navegador esta pestaña solo explica que el gestor pertenece a la IDE Desktop: controla un programa de su computador, que el sitio no alcanza. Para usarlo, abra el Studio por la IDE (el botón lleva a la descarga).',
      ], OPT),
      st('config', 'studio.tunnel_config', ['Configurar o túnel', 'Configure the tunnel', 'Configurar el túnel'], [
        'Abre o arquivo metabuilder.config.json: as conexões com os bancos do cliente que o túnel atende.',
        'Opens the metabuilder.config.json file: the connections to the customer databases that the tunnel serves.',
        'Abre el archivo metabuilder.config.json: las conexiones con las bases del cliente que atiende el túnel.',
      ], { ...OPT, ideOnly: true }),
      st('status', 'studio.tunnel_status', ['Estado do serviço', 'Service status', 'Estado del servicio'], [
        'Mostra se o túnel está em execução (verde), parado (vermelho) ou verificando, e o número do processo (PID). Um único túnel atende todos os projetos.',
        'Shows whether the tunnel is running (green), stopped (red) or checking, and the process number (PID). A single tunnel serves all projects.',
        'Muestra si el túnel está en ejecución (verde), detenido (rojo) o verificando, y el número del proceso (PID). Un solo túnel atiende todos los proyectos.',
      ], { ...OPT, ideOnly: true }),
      st('start', 'studio.tunnel_start', ['Iniciar túnel', 'Start tunnel', 'Iniciar túnel'], [
        'Liga o túnel. Só fica ativo com ele parado.',
        'Turns the tunnel on. It is only enabled while the tunnel is stopped.',
        'Enciende el túnel. Solo está activo con él detenido.',
      ], { ...OPT, ideOnly: true }),
      st('stop', 'studio.tunnel_stop', ['Parar túnel', 'Stop tunnel', 'Detener túnel'], [
        'Desliga o túnel: enquanto ele estiver parado, os apps não alcançam o banco do cliente.',
        'Turns the tunnel off: while it is stopped, the apps cannot reach the customer database.',
        'Apaga el túnel: mientras esté detenido, las apps no alcanzan la base del cliente.',
      ], { ...OPT, ideOnly: true }),
      st('logs', 'studio.tunnel_logs', ['Logs do túnel', 'Tunnel logs', 'Logs del túnel'], [
        'Abre o console com o que o túnel está fazendo: conexões, consultas e erros. É o primeiro lugar a olhar quando algo não responde.',
        'Opens the console with what the tunnel is doing: connections, queries and errors. It is the first place to look when something does not answer.',
        'Abre la consola con lo que hace el túnel: conexiones, consultas y errores. Es el primer lugar donde mirar cuando algo no responde.',
      ], { ...OPT, ideOnly: true }),
      st('sync', 'studio.tunnel_sync', ['Sincronizar este projeto', 'Sync this project', 'Sincronizar este proyecto'], [
        'Lê a estrutura do banco do cliente (tabelas, colunas, relacionamentos) e atualiza o projeto. Não mexe nos dados nem para o túnel. Se houver mudanças estruturais, o projeto fica com "Sincronização pendente" para você revisar.',
        'Reads the structure of the customer database (tables, columns, relationships) and updates the project. It does not touch the data nor stop the tunnel. If there are structural changes, the project is flagged "Pending sync" for you to review.',
        'Lee la estructura de la base del cliente (tablas, columnas, relaciones) y actualiza el proyecto. No toca los datos ni detiene el túnel. Si hay cambios estructurales, el proyecto queda con "Sincronización pendiente" para que los revise.',
      ], { ...OPT, ideOnly: true }),
      st('consoles', 'studio.tunnel_sync', ['O que aparece ao sincronizar e nos logs', 'What shows up when syncing and in the logs', 'Qué aparece al sincronizar y en los logs'], [
        'Ao sincronizar abre o Console de Sincronização: a saída ao vivo do comando do túnel, linha a linha (erros em vermelho, sucesso em verde). O botão Fechar fica desativado enquanto roda; no fim aparece "Sincronização concluída com sucesso" ou "Falha na sincronização", e se mudou a estrutura o projeto fica com "Sincronização pendente" (tela de revisão, com o tour próprio "Sincronização pendente"). O botão Logs abre o console do túnel numa janela separada, que não dá para destacar aqui; por isso o tour não executa nada disso.',
        'Syncing opens the Sync Console: the live output of the tunnel command, line by line (errors in red, success in green). The Close button is disabled while it runs; at the end it shows "Sync completed successfully" or "Sync failed", and if the structure changed the project is flagged "Pending sync" (review screen, with its own "Pending sync" tour). The Logs button opens the tunnel console in a separate window, which cannot be highlighted here; that is why the tour does not run any of this.',
        'Al sincronizar se abre la Consola de Sincronización: la salida en vivo del comando del túnel, línea a línea (errores en rojo, éxito en verde). El botón Cerrar queda desactivado mientras corre; al final aparece "Sincronización completada con éxito" o "Falla en la sincronización", y si cambió la estructura el proyecto queda con "Sincronización pendiente" (pantalla de revisión, con su propio tour "Sincronización pendiente"). El botón Logs abre la consola del túnel en una ventana aparte, que no se puede resaltar aquí; por eso el tour no ejecuta nada de esto.',
      ], { ...OPT, ideOnly: true, readOnly: true }),
    ],
  },

  // ───────────────────────── Bancos Sincronizados ─────────────────────────
  {
    id: 'studio-bancos-sincronizados',
    route: STUDIO,
    needs: 'studio.tab_synced',
    needsHint: HINT,
    recover: ['studio.tab_synced'],
    title: h(['Bancos Sincronizados', 'Synced Databases', 'Bases Sincronizadas']),
    summary: h(['Os schemas que a sincronização trouxe para o projeto: renomear a conexão ou limpar o que ficou antigo.', 'The schemas the sync brought into the project: rename the connection or clean up what became old.', 'Los esquemas que la sincronización trajo al proyecto: renombrar la conexión o limpiar lo que quedó antiguo.']),
    neverClick: ['studio.synced_delete'],
    steps: [
      st('tab', 'studio.tab_synced', ['A aba Bancos Sincronizados', 'The Synced Databases tab', 'La pestaña Bases Sincronizadas'], [
        'Cada vez que o túnel sincroniza, as tabelas entram no projeto sob o nome do schema do banco. Aqui você administra esses schemas. Abrimos a aba por você.',
        'Each time the tunnel syncs, the tables enter the project under the database schema name. Here you manage those schemas. We opened the tab for you.',
        'Cada vez que el túnel sincroniza, las tablas entran al proyecto bajo el nombre del esquema de la base. Aquí administra esos esquemas. Abrimos la pestaña por usted.',
      ], { enterClick: 'studio.tab_synced' }),
      st('header', 'studio.synced_header', ['Para que serve', 'What it is for', 'Para qué sirve'], [
        'Renomeie conexões ou limpe schemas antigos para evitar tabelas duplicadas no projeto.',
        'Rename connections or clean up old schemas to avoid duplicated tables in the project.',
        'Renombre conexiones o limpie esquemas antiguos para evitar tablas duplicadas en el proyecto.',
      ]),
      st('group', 'studio.synced_group', ['Projeto e schemas', 'Project and schemas', 'Proyecto y esquemas'], [
        'Cada bloco é um projeto, com a quantidade de schemas sincronizados. Cada linha abaixo é um schema, com o nome da conexão.',
        'Each block is a project, with the number of synced schemas. Each row below is a schema, with the connection name.',
        'Cada bloque es un proyecto, con la cantidad de esquemas sincronizados. Cada fila de abajo es un esquema, con el nombre de la conexión.',
      ], OPT),
      st('rename', 'studio.synced_rename', ['Renomear o schema', 'Rename the schema', 'Renombrar el esquema'], [
        'Muda o nome do schema em todas as tabelas e modelos do projeto que estão sob o schema atual. Abre uma janela de confirmação.',
        'Changes the schema name on all tables and models of the project that are under the current schema. Opens a confirmation window.',
        'Cambia el nombre del esquema en todas las tablas y modelos del proyecto que están bajo el esquema actual. Abre una ventana de confirmación.',
      ], OPT),
      st('delete', 'studio.synced_delete', ['Excluir o schema', 'Delete the schema', 'Eliminar el esquema'], [
        'Cuidado: apaga o schema e as tabelas ligadas a ele no projeto (o banco do cliente não é alterado). Uma janela avisa que a ação é destrutiva antes de confirmar.',
        'Careful: deletes the schema and the tables linked to it in the project (the customer database is not changed). A window warns the action is destructive before confirming.',
        'Cuidado: borra el esquema y las tablas ligadas a él en el proyecto (la base del cliente no se modifica). Una ventana avisa que la acción es destructiva antes de confirmar.',
      ], OPT),
    ],
  },

  // ───────────────────────── Central de Ajuda ─────────────────────────
  {
    id: 'studio-central-ajuda',
    route: STUDIO,
    needs: 'studio.tab_help',
    needsHint: HINT,
    recover: ['studio.tab_help'],
    title: h(['Central de Ajuda do app', 'App Help Center', 'Centro de Ayuda de la app']),
    summary: h(['A ajuda que o usuário final vê: texto, roteiros interativos e o feedback dos usuários.', 'The help the end user sees: text, interactive scripts and user feedback.', 'La ayuda que ve el usuario final: texto, guiones interactivos y la opinión de los usuarios.']),
    steps: [
      st('tab', 'studio.tab_help', ['A aba Central de Ajuda', 'The Help Center tab', 'La pestaña Centro de Ayuda'], [
        'Aqui você escreve a ajuda do SEU app (a que o usuário final vê). Não é a ajuda da plataforma, que são estes tours. Abrimos a aba por você.',
        'Here you write the help of YOUR app (the one the end user sees). It is not the platform help, which are these tours. We opened the tab for you.',
        'Aquí escribe la ayuda de SU app (la que ve el usuario final). No es la ayuda de la plataforma, que son estos tours. Abrimos la pestaña por usted.',
      ], { enterClick: 'studio.tab_help' }),
      st('open', 'studio.help_open', ['Ver a Central do app', 'See the app Center', 'Ver el Centro de la app'], [
        'Abre, em outra aba, a Central de Ajuda como o usuário final a vê.',
        'Opens, in another tab, the Help Center as the end user sees it.',
        'Abre, en otra pestaña, el Centro de Ayuda como lo ve el usuario final.',
      ], OPT),
      st('pick', 'studio.help_pick', ['Escolha o caso de uso', 'Pick the use case', 'Elija el caso de uso'], [
        'A ajuda é escrita caso de uso por caso de uso. O ✓ marca os que já têm ajuda escrita e o ⚠, os que têm roteiros possivelmente desatualizados. Só aparecem os publicados.',
        'Help is written use case by use case. The ✓ marks those that already have written help and the ⚠, those with possibly outdated scripts. Only published ones show.',
        'La ayuda se escribe caso de uso por caso de uso. El ✓ marca los que ya tienen ayuda escrita y el ⚠, los que tienen guiones posiblemente desactualizados. Solo aparecen los publicados.',
      ], { ...OPT, interactive: true }),
      st('tabs', 'studio.help_tabs', ['Três tipos de ajuda', 'Three kinds of help', 'Tres tipos de ayuda'], [
        'Ajuda textual (a tela e cada campo), Ajuda interativa (roteiros que o sistema executa sozinho em modo demonstração) e Feedback (o que os usuários acharam).',
        'Text help (the screen and each field), Interactive help (scripts the system runs by itself in demo mode) and Feedback (what users thought).',
        'Ayuda textual (la pantalla y cada campo), Ayuda interactiva (guiones que el sistema ejecuta solo en modo demostración) y Feedback (lo que opinaron los usuarios).',
      ], OPT),
      st('text', 'studio.help_text', ['Ajuda textual', 'Text help', 'Ayuda textual'], [
        'No alto, a ajuda da tela (o ícone ? do cabeçalho), em português, inglês e espanhol. Abaixo, a visão geral com a dica de cada campo por zona: filtro, grade e formulário. Dá para ocultar uma dica, um grupo ou todas, e personalizar o texto de um campo só em uma zona.',
        'At the top, the screen help (the ? icon in the header), in Portuguese, English and Spanish. Below, the overview with the tip of each field per zone: filter, grid and form. You can hide a tip, a group or all of them, and customize the text of a field in one zone only.',
        'Arriba, la ayuda de la pantalla (el ícono ? del encabezado), en portugués, inglés y español. Abajo, la visión general con la pista de cada campo por zona: filtro, grilla y formulario. Se puede ocultar una pista, un grupo o todas, y personalizar el texto de un campo solo en una zona.',
      ], { ...OPT, enterClick: 'studio.help_tab_text' }),
      st('interactive', 'studio.help_interactive', ['Ajuda interativa', 'Interactive help', 'Ayuda interactiva'], [
        'O usuário vê o sistema executar os passos sozinho, em modo demonstração (nada é gravado). O roteiro de cada ação (pesquisar, ver, cadastrar, editar, excluir) é gerado automático e você ajusta o que quiser. A ordem da lista é a ordem do "Reproduzir todos".',
        'The user sees the system run the steps by itself, in demo mode (nothing is saved). The script of each action (search, view, create, edit, delete) is generated automatically and you adjust whatever you want. The list order is the order of "Play all".',
        'El usuario ve al sistema ejecutar los pasos solo, en modo demostración (no se guarda nada). El guion de cada acción (buscar, ver, crear, editar, eliminar) se genera automático y usted ajusta lo que quiera. El orden de la lista es el orden de "Reproducir todos".',
      ], { ...OPT, enterClick: 'studio.help_tab_interactive' }),
      st('record', 'studio.help_record', ['Gravar roteiro', 'Record script', 'Grabar guion'], [
        'Abre a tela do caso de uso em modo demonstração e grava o que você fizer como um roteiro novo. Serve para fluxos que a geração automática não cobre.',
        'Opens the use case screen in demo mode and records what you do as a new script. It serves flows the automatic generation does not cover.',
        'Abre la pantalla del caso de uso en modo demostración y graba lo que haga como un guion nuevo. Sirve para flujos que la generación automática no cubre.',
      ], OPT),
      st('regen', 'studio.help_regen_all', ['Regenerar e excluir todos', 'Regenerate and delete all', 'Regenerar y eliminar todos'], [
        '"Regenerar todos" recria os roteiros a partir da configuração atual do caso de uso (use quando mudar campos ou botões). "Excluir todos" apaga os roteiros, com confirmação. Nos dois casos só vale depois de "Salvar ajuda".',
        '"Regenerate all" recreates the scripts from the current use case configuration (use it when you change fields or buttons). "Delete all" removes the scripts, with confirmation. In both cases it only applies after "Save help".',
        '"Regenerar todos" recrea los guiones desde la configuración actual del caso de uso (úselo al cambiar campos o botones). "Eliminar todos" borra los guiones, con confirmación. En ambos casos solo vale después de "Guardar ayuda".',
      ], OPT),
      st('feedback', 'studio.help_feedback', ['Feedback dos usuários', 'User feedback', 'Feedback de los usuarios'], [
        'Mostra a aprovação geral, o total de votos (positivos e negativos) e quantos itens precisam de atenção. Filtre por zona (filtro, grade, formulário), veja campo a campo onde a ajuda não está funcionando e use "Personalizar" para melhorar o texto naquela zona.',
        'Shows the overall approval, the total votes (positive and negative) and how many items need attention. Filter by zone (filter, grid, form), see field by field where the help is not working and use "Customize" to improve the text in that zone.',
        'Muestra la aprobación general, el total de votos (positivos y negativos) y cuántos ítems necesitan atención. Filtre por zona (filtro, grilla, formulario), vea campo por campo dónde la ayuda no funciona y use "Personalizar" para mejorar el texto en esa zona.',
      ], { ...OPT, enterClick: 'studio.help_tab_feedback' }),
      st('save', 'studio.help_save', ['Salvar ajuda', 'Save help', 'Guardar ayuda'], [
        'Grava a ajuda do caso de uso. Vale na hora, sem republicar o caso de uso. Aparece "Alterações não salvas" ao lado enquanto houver algo por gravar.',
        'Stores the use case help. It applies right away, without republishing the use case. "Unsaved changes" shows next to it while there is something to store.',
        'Graba la ayuda del caso de uso. Vale al instante, sin republicar el caso de uso. Aparece "Cambios sin guardar" al lado mientras haya algo por grabar.',
      ], OPT),
    ],
  },
]
