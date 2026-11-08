/**
 * Catálogo dos tours da PLATAFORMA (escritos pela equipe do MetaBuilder). Cada passo aponta para um `data-help-id` da tela;
 * o teste `platformHelp.test.ts` confere que todo alvo citado aqui existe de fato no código e que todo texto está nos 3 idiomas.
 */

import type { HelpText } from '../helpText'
import type { PlatformTour } from './types'
import { AUTH_TOURS } from './catalogAuth'
import { SETTINGS_TOURS } from './catalogSettings'
import { LOGS_TOURS } from './catalogLogs'

const h = (pt: string, en: string, es: string): HelpText => ({ pt, en, es })

const STUDIO = '/admin/:workspace/:project/studio'

const BASE_TOURS: readonly PlatformTour[] = [
  {
    id: 'studio-visao-geral',
    needs: 'studio.tabs',
    needsHint: h('Disponível na lista do Studio: saia do assistente (seta ao lado do título) para ver este tour.', 'Available on the Studio list: leave the wizard (arrow next to the title) to see this tour.', 'Disponible en la lista del Studio: salga del asistente (flecha junto al título) para ver este recorrido.'),
    route: STUDIO,
    title: h('Conhecendo o Studio', 'Getting to know Studio', 'Conociendo el Studio'),
    summary: h('Onde ficam as áreas do Studio, os indicadores, os atalhos e a lista dos seus casos de uso.', 'Where Studio areas, indicators, shortcuts and your use case list are.', 'Dónde están las áreas del Studio, los indicadores, los atajos y la lista de sus casos de uso.'),
    recover: ['studio.tab_list', 'wizard.back', 'ai.back'],
    steps: [
      {
        id: 'rail',
        target: 'studio.rail',
        title: h('Menu do Studio', 'Studio menu', 'Menú del Studio'),
        body: h(
          'Cada ícone abre uma área: Dashboard (casos de uso), Dados & Schemas, Autenticação, BYOC, Configurações, Bancos (JSON), Terminal, Logs e SQL Studio. Passe o mouse para ver o nome.',
          'Each icon opens an area: Dashboard (use cases), Data & Schemas, Authentication, BYOC, Settings, Databases (JSON), Terminal, Logs and SQL Studio. Hover to see the name.',
          'Cada ícono abre un área: Dashboard (casos de uso), Datos y Esquemas, Autenticación, BYOC, Configuración, Bases (JSON), Terminal, Logs y SQL Studio. Pase el mouse para ver el nombre.',
        ),
      },
      {
        id: 'tabs',
        target: 'studio.tabs',
        title: h('Abas do Dashboard', 'Dashboard tabs', 'Pestañas del Dashboard'),
        body: h(
          'Casos de Uso: as telas do seu app. Navegação: o menu do app publicado. Enums: listas de valores fixos. Gerenciador do Túnel e Bancos Sincronizados: a conexão com o banco do cliente (IDE Desktop). Central de Ajuda: a ajuda que o usuário final vê.',
          'Use Cases: your app screens. Navigation: the published app menu. Enums: fixed value lists. Tunnel Manager and Synced Databases: the connection to the customer database (Desktop IDE). Help Center: the help end users see.',
          'Casos de Uso: las pantallas de su app. Navegación: el menú de la app publicada. Enums: listas de valores fijos. Administrador del Túnel y Bases Sincronizadas: la conexión con la base del cliente (IDE de escritorio). Centro de Ayuda: la ayuda que ve el usuario final.',
        ),
      },
      {
        id: 'stat-tables',
        target: 'studio.stat_tables',
        title: h('Tabelas sincronizadas', 'Synced tables', 'Tablas sincronizadas'),
        body: h('Quantas tabelas do banco do cliente o MetaBuilder já conhece. Elas chegam pelo Agente CLI e são a matéria-prima dos casos de uso.', 'How many tables of the customer database MetaBuilder already knows. They arrive through the CLI Agent and are the raw material of use cases.', 'Cuántas tablas de la base del cliente ya conoce MetaBuilder. Llegan por el Agente CLI y son la materia prima de los casos de uso.'),
      },
      {
        id: 'stat-views',
        target: 'studio.stat_views',
        title: h('Views personalizadas', 'Custom views', 'Vistas personalizadas'),
        body: h('Quantos casos de uso (telas) este projeto tem, contando os do sistema (login, automações, downloads).', 'How many use cases (screens) this project has, including the system ones (login, automations, downloads).', 'Cuántos casos de uso (pantallas) tiene este proyecto, incluidos los del sistema (acceso, automatizaciones, descargas).'),
      },
      {
        id: 'stat-agent',
        target: 'studio.stat_agent',
        title: h('Agente e conexão', 'Agent and connection', 'Agente y conexión'),
        body: h('Mostra se o Agente CLI está respondendo agora, o ID e o token secreto do projeto (usados na configuração do túnel) e por quanto tempo as exportações geradas ficam disponíveis. Trate o token como uma senha.', 'Shows whether the CLI Agent is answering right now, the project ID and secret token (used in the tunnel setup) and how long generated exports stay available. Treat the token like a password.', 'Muestra si el Agente CLI está respondiendo ahora, el ID y el token secreto del proyecto (usados en la configuración del túnel) y cuánto tiempo quedan disponibles las exportaciones generadas. Trate el token como una contraseña.'),
      },
      {
        id: 'quick-start',
        target: 'studio.quick_start',
        title: h('Quick Start', 'Quick Start', 'Quick Start'),
        body: h('Atalhos para criar um caso de uso já de um tipo específico: cadastro, Kanban, linha do tempo, Gantt, agenda, fluxograma, mapa mental, mapa, gráfico, galeria e painel de BI. Clique em um ícone, dê o nome e pronto.', 'Shortcuts to create a use case of a specific type right away: form, Kanban, timeline, Gantt, calendar, flowchart, mind map, map, chart, gallery and BI dashboard. Click an icon, name it and you are done.', 'Atajos para crear de inmediato un caso de uso de un tipo específico: formulario, Kanban, línea de tiempo, Gantt, agenda, diagrama de flujo, mapa mental, mapa, gráfico, galería y panel de BI. Haga clic en un ícono, póngale nombre y listo.'),
      },
      {
        id: 'type-filter',
        target: 'studio.type_filter',
        title: h('Filtrar por categoria', 'Filter by category', 'Filtrar por categoría'),
        body: h('Mostra só os casos de uso de uma categoria: Sistema, Gestão de Dados, Projetos e Prazos, Mapeamento e Fluxos, Inteligência e Mídia ou Avançado. Clique de novo no mesmo ícone para limpar o filtro.', 'Shows only the use cases of one category: System, Data Management, Projects and Schedules, Mapping and Flows, Intelligence and Media or Advanced. Click the same icon again to clear the filter.', 'Muestra solo los casos de uso de una categoría: Sistema, Gestión de Datos, Proyectos y Plazos, Mapeo y Flujos, Inteligencia y Medios o Avanzado. Haga clic otra vez en el mismo ícono para quitar el filtro.'),
      },
      {
        id: 'scale',
        target: 'studio.scale',
        title: h('Tamanho dos cartões', 'Card size', 'Tamaño de las tarjetas'),
        body: h('Pequeno, normal, grande ou extra grande: muda quantos cartões cabem na tela. Em projetos com muitas telas, o pequeno ajuda a achar tudo de uma vez.', 'Small, normal, large or extra large: changes how many cards fit on screen. In projects with many screens, small helps you see everything at once.', 'Pequeño, normal, grande o extra grande: cambia cuántas tarjetas caben en la pantalla. En proyectos con muchas pantallas, el pequeño ayuda a verlo todo de una vez.'),
      },
      {
        id: 'refresh',
        target: 'studio.refresh',
        title: h('Atualizar a lista', 'Refresh the list', 'Actualizar la lista'),
        body: h('Recarrega os casos de uso. Ao lado, o contador mostra quantos existem no projeto.', 'Reloads the use cases. Next to it, the counter shows how many exist in the project.', 'Recarga los casos de uso. Al lado, el contador muestra cuántos existen en el proyecto.'),
      },
      {
        id: 'cards',
        target: 'studio.cards',
        title: h('Seus casos de uso', 'Your use cases', 'Sus casos de uso'),
        body: h('Cada cartão é uma tela do app. Os de cima, marcados como Sistema, são do próprio MetaBuilder (login, automações, downloads). Os demais são os seus: use Configurar para editar, a seta para abrir a tela publicada e o ícone de lixeira para excluir. O selo de cor mostra o tipo da tela.', 'Each card is an app screen. The top ones, marked System, belong to MetaBuilder itself (login, automations, downloads). The rest are yours: use Configure to edit, the arrow to open the published screen and the trash icon to delete. The colored badge shows the screen type.', 'Cada tarjeta es una pantalla de la app. Las de arriba, marcadas como Sistema, son del propio MetaBuilder (acceso, automatizaciones, descargas). Las demás son suyas: use Configurar para editar, la flecha para abrir la pantalla publicada y el ícono de papelera para eliminar. La insignia de color muestra el tipo de pantalla.'),
      },
      {
        id: 'new',
        target: 'studio.new_use_case',
        title: h('Novo caso de uso', 'New use case', 'Nuevo caso de uso'),
        body: h('Abre o assistente de 4 etapas para criar uma tela: lógica, tabelas, campos e layout, ações e query. Há um tour só para ele.', 'Opens the 4-step wizard to create a screen: logic, tables, fields and layout, actions and query. There is a tour just for it.', 'Abre el asistente de 4 etapas para crear una pantalla: lógica, tablas, campos y diseño, acciones y consulta. Hay un tour solo para él.'),
      },
      {
        id: 'ai',
        target: 'studio.ai',
        title: h('Gerar com IA', 'Generate with AI', 'Generar con IA'),
        body: h('Descreva a tela que você quer e a IA monta o caso de uso para você ajustar depois. Disponível no plano Pro.', 'Describe the screen you want and the AI builds the use case for you to adjust. Available on the Pro plan.', 'Describa la pantalla que quiere y la IA arma el caso de uso para que lo ajuste. Disponible en el plan Pro.'),
      },
      {
        id: 'help',
        target: 'studio.tab_help',
        title: h('Central de Ajuda', 'Help Center', 'Centro de Ayuda'),
        body: h('Aqui você escreve a ajuda que o usuário final vê (dicas dos campos e tutoriais ▶), sem republicar o caso de uso.', 'Here you write the help end users see (field hints and ▶ tutorials) without republishing the use case.', 'Aquí escribe la ayuda que ve el usuario final (pistas de campos y tutoriales ▶) sin republicar el caso de uso.'),
      },
    ],
  },
  {
    id: 'studio-criar-caso-de-uso',
    route: STUDIO,
    title: h('Criar um caso de uso', 'Create a use case', 'Crear un caso de uso'),
    summary: h('Passo a passo do assistente, com ou sem tabelas de detalhe (mestre + detalhe): da lógica ao botão final.', 'Wizard walkthrough, with or without detail tables (master + detail): from logic to the final button.', 'Recorrido del asistente, con o sin tablas de detalle (maestro + detalle): de la lógica al botón final.'),
    recover: ['studio.tab_list', 'ai.back'],
    // aberto com o assistente já na tela: começa na etapa em que a pessoa está
    entry: [
      { rule: { id: 'wizard.stepper', check: 'attr', attr: 'data-help-state', equals: '4' }, step: 'buttons' },
      { rule: { id: 'wizard.stepper', check: 'attr', attr: 'data-help-state', equals: '3' }, step: 'fields-panel' },
      { rule: { id: 'wizard.stepper', check: 'attr', attr: 'data-help-state', equals: '2' }, step: 'depth' },
      { rule: { id: 'wizard.stepper', check: 'attr', attr: 'data-help-state', equals: '1' }, step: 'stepper' },
    ],
    steps: [
      {
        id: 'open',
        target: 'studio.new_use_case',
        title: h('Comece por aqui', 'Start here', 'Empiece aquí'),
        body: h('Clique em "Novo caso de uso" para abrir o assistente.', 'Click "New use case" to open the wizard.', 'Haga clic en "Nuevo caso de uso" para abrir el asistente.'),
        advanceOnClick: true,
      },
      {
        id: 'stepper',
        target: 'wizard.stepper',
        backClick: 'wizard.back',
        title: h('As 4 etapas', 'The 4 steps', 'Las 4 etapas'),
        body: h('Lógica → Tabelas → Campos & Layout → Ações & Query. Você pode voltar a qualquer etapa antes de concluir.', 'Logic → Tables → Fields & Layout → Actions & Query. You can go back to any step before finishing.', 'Lógica → Tablas → Campos y Diseño → Acciones y Consulta. Puede volver a cualquier etapa antes de concluir.'),
      },
      {
        id: 'name',
        target: 'wizard.name',
        interactive: true,
        completeWhen: { id: 'wizard.name_input', check: 'filled' },
        waitingHint: h('Digite o nome da tela para continuar.', 'Type the screen name to continue.', 'Escriba el nombre de la pantalla para continuar.'),
        title: h('Nome e endereço', 'Name and address', 'Nombre y dirección'),
        body: h('O nome aparece no menu do app. O endereço (slug) vira o final da URL da tela e é gerado a partir do nome; você pode trocar. Para treinar, use um nome como "Teste".', 'The name shows in the app menu. The address (slug) becomes the end of the screen URL and is generated from the name; you can change it. To practice, use a name like "Test".', 'El nombre aparece en el menú de la app. La dirección (slug) es el final de la URL de la pantalla y se genera a partir del nombre; puede cambiarla. Para practicar, use un nombre como "Prueba".'),
      },
      {
        id: 'logic',
        target: 'wizard.logic',
        interactive: true,
        completeWhen: { id: 'wizard.logic', check: 'attr', attr: 'data-help-state', equals: 'ok' },
        waitingHint: h('Abra um grupo e clique no tipo de tela para continuar.', 'Open a group and click the screen type to continue.', 'Abra un grupo y haga clic en el tipo de pantalla para continuar.'),
        title: h('Qual é a lógica?', 'What is the logic?', '¿Cuál es la lógica?'),
        body: h('Define o tipo de tela: cadastro com pesquisa, Kanban, Agenda, Gantt, mapa, painel de BI e outros. Abra um grupo e escolha o tipo. Dica: "Pesquisa + Cadastro" serve para a maioria das telas de dados.', 'Defines the screen type: search + form, Kanban, Calendar, Gantt, map, BI dashboard and more. Open a group and pick the type. Tip: "Search + Form" fits most data screens.', 'Define el tipo de pantalla: búsqueda y formulario, Kanban, Agenda, Gantt, mapa, panel de BI y más. Abra un grupo y elija el tipo. Consejo: "Búsqueda + Formulario" sirve para la mayoría de las pantallas de datos.'),
      },
      {
        id: 'next1',
        target: 'wizard.next',
        completeWhen: { id: 'wizard.next', check: 'attr', attr: 'data-help-state', equals: 'ready' },
        waitingHint: h('O botão "Próximo passo" só habilita com o nome e o tipo de tela preenchidos.', 'The "Next step" button only enables once the name and screen type are set.', 'El botón "Siguiente paso" solo se habilita con el nombre y el tipo de pantalla completos.'),
        title: h('Próxima etapa', 'Next step', 'Siguiente etapa'),
        body: h('Preencha o nome, escolha a lógica e clique em "Próximo passo".', 'Fill in the name, pick the logic and click "Next step".', 'Complete el nombre, elija la lógica y haga clic en "Siguiente paso".'),
        advanceOnClick: true,
      },
      {
        id: 'depth',
        target: 'wizard.depth',
        backClick: 'wizard.prev',
        interactive: true,
        title: h('Profundidade das relações', 'Relation depth', 'Profundidad de las relaciones'),
        body: h('Quantos níveis de relacionamento entram automaticamente. 2 é o padrão e basta na maioria dos casos; níveis maiores deixam a consulta mais lenta. Se precisar, troque o valor agora.', 'How many relationship levels come in automatically. 2 is the default and enough most of the time; deeper levels make the query slower. If you need to, change the value now.', 'Cuántos niveles de relación entran automáticamente. 2 es el valor por defecto y suele bastar; más niveles hacen la consulta más lenta. Si lo necesita, cambie el valor ahora.'),
      },
      {
        id: 'tables',
        target: 'wizard.tables',
        interactive: true,
        completeWhen: { id: 'wizard.tables', check: 'attr', attr: 'data-help-state', equals: 'ok' },
        waitingHint: h('Clique em uma tabela para continuar.', 'Click a table to continue.', 'Haga clic en una tabla para continuar.'),
        title: h('Tabela principal', 'Main table', 'Tabla principal'),
        body: h('Escolha a tabela raiz da tela. As tabelas relacionadas entram sozinhas na etapa seguinte.', 'Pick the screen root table. Related tables come in automatically in the next step.', 'Elija la tabla raíz de la pantalla. Las tablas relacionadas entran solas en la siguiente etapa.'),
      },
      {
        id: 'next2',
        target: 'wizard.next',
        completeWhen: { id: 'wizard.next', check: 'attr', attr: 'data-help-state', equals: 'ready' },
        waitingHint: h('Selecione uma tabela para habilitar o "Próximo passo".', 'Select a table to enable "Next step".', 'Seleccione una tabla para habilitar "Siguiente paso".'),
        title: h('Selecione a tabela e avance', 'Select the table and continue', 'Seleccione la tabla y avance'),
        body: h('Escolha uma tabela e clique em "Próximo passo".', 'Pick a table and click "Next step".', 'Elija una tabla y haga clic en "Siguiente paso".'),
        advanceOnClick: true,
      },
      {
        id: 'fields-panel',
        target: 'wizard.fields_panel',
        backClick: 'wizard.prev',
        title: h('De onde vêm os campos', 'Where fields come from', 'De dónde vienen los campos'),
        body: h(
          'Este painel lista os campos das tabelas escolhidas. É daqui que você ARRASTA os campos para as zonas ao lado (ou clica no + de cada campo). "Arrastar todos" leva a tabela inteira de uma vez. Em "Ferramentas virtuais", o "Campo calculado" cria um campo com fórmula. O painel pode ser movido se estiver atrapalhando.',
          'This panel lists the fields of the chosen tables. It is where you DRAG fields into the zones beside it (or click each field + button). "Drag all" takes the whole table at once. Under "Virtual tools", "Calculated field" creates a field with a formula. The panel can be moved if it is in the way.',
          'Este panel lista los campos de las tablas elegidas. Desde aquí ARRASTRA los campos a las zonas de al lado (o haga clic en el + de cada campo). "Arrastrar todos" lleva la tabla entera de una vez. En "Herramientas virtuales", "Campo calculado" crea un campo con fórmula. El panel se puede mover si estorba.',
        ),
      },
      {
        id: 'zone-filter',
        target: 'wizard.zone_filter',
        title: h('Zona 1: filtro de busca', 'Zone 1: search filter', 'Zona 1: filtro de búsqueda'),
        body: h('Arraste para cá os campos que o usuário poderá usar para filtrar a lista.', 'Drag here the fields users can use to filter the list.', 'Arrastre aquí los campos que el usuario podrá usar para filtrar la lista.'),
      },
      {
        id: 'zone-grid',
        target: 'wizard.zone_grid',
        title: h('Zona 2: grid de dados', 'Zone 2: data grid', 'Zona 2: cuadrícula de datos'),
        body: h('Os campos que aparecem como colunas da lista (ou como cartões, conforme o modo escolhido).', 'The fields that show as list columns (or as cards, depending on the chosen mode).', 'Los campos que aparecen como columnas de la lista (o como tarjetas, según el modo elegido).'),
      },
      {
        id: 'zone-form',
        target: 'wizard.zone_form',
        title: h('Zona 3: formulário', 'Zone 3: form', 'Zona 3: formulario'),
        body: h('Os campos do cadastro e da edição. Campos de tabelas filhas viram abas de detalhe.', 'The fields of the create and edit form. Fields of child tables become detail tabs.', 'Los campos del alta y la edición. Los campos de tablas hijas se vuelven pestañas de detalle.'),
      },
      {
        id: 'fill-zones',
        target: 'wizard.fields_panel',
        freeInteraction: true,
        completeWhen: { id: 'wizard.next', check: 'attr', attr: 'data-help-state', equals: 'ready' },
        title: h('Agora é com você', 'Now it is your turn', 'Ahora es su turno'),
        body: h('Arraste pelo menos um campo para o Grid de dados e um para o Formulário (e para o Filtro, se a tela usa busca por argumentos). A tela está liberada nesta etapa.', 'Drag at least one field into the Data grid and one into the Form (and into the Filter if the screen uses search arguments). The screen is free during this step.', 'Arrastre al menos un campo a la Cuadrícula de datos y uno al Formulario (y al Filtro, si la pantalla usa argumentos de búsqueda). La pantalla está libre en esta etapa.'),
        waitingHint: h('Faltam campos nas zonas: o "Próximo passo" só habilita quando a grade e o formulário têm campos.', 'Fields are missing in the zones: "Next step" only enables once the grid and form have fields.', 'Faltan campos en las zonas: "Siguiente paso" solo se habilita cuando la cuadrícula y el formulario tienen campos.'),
      },
      {
        id: 'detail-expand',
        target: 'wizard.detail_expand',
        skipIfMissing: true,
        interactive: true,
        completeWhen: { id: 'wizard.detail_block', check: 'attr', attr: 'data-help-state', equals: 'open' },
        waitingHint: h('Clique na setinha de um detalhe para expandi-lo.', 'Click the small arrow of a detail to expand it.', 'Haga clic en la flechita de un detalle para expandirlo.'),
        title: h('Tem detalhes? Expanda um', 'Has details? Expand one', '¿Tiene detalles? Expanda uno'),
        body: h(
          'Embaixo do formulário aparecem as tabelas de DETALHE ligadas ao cadastro (por exemplo, os itens de um pedido). Cada uma começa recolhida. Clique na setinha de um detalhe para expandir a área de campos dele.',
          'Below the form you see the DETAIL tables linked to the record (for example, the items of an order). Each one starts collapsed. Click the small arrow of a detail to expand its field area.',
          'Debajo del formulario aparecen las tablas de DETALLE vinculadas al registro (por ejemplo, los ítems de un pedido). Cada una empieza contraída. Haga clic en la flechita de un detalle para expandir su área de campos.',
        ),
      },
      {
        id: 'detail-fill',
        target: 'wizard.detail_block',
        alsoTarget: 'wizard.fields_panel',
        skipIfMissing: true,
        freeInteraction: true,
        title: h('Campos do detalhe', 'Detail fields', 'Campos del detalle'),
        body: h(
          'Arraste do painel "Campos disponíveis" os campos do detalhe para esta área. No app, eles viram a aba ou a seção do detalhe dentro do formulário do mestre. Aqui também dá escolher Aba ou Seção, Modal ou Drawer e o título de cada item. Este passo é opcional: quando terminar, clique em Próximo.',
          'Drag the detail fields from the "Available fields" panel into this area. In the app they become the detail tab or section inside the master form. Here you can also choose Tab or Section, Modal or Drawer and each item title. This step is optional: when you are done, click Next.',
          'Arrastre del panel "Campos disponibles" los campos del detalle a esta área. En la app se vuelven la pestaña o la sección del detalle dentro del formulario del maestro. Aquí también puede elegir Pestaña o Sección, Modal o Drawer y el título de cada ítem. Este paso es opcional: cuando termine, haga clic en Siguiente.',
        ),
      },
      {
        id: 'next3',
        target: 'wizard.next',
        completeWhen: { id: 'wizard.next', check: 'attr', attr: 'data-help-state', equals: 'ready' },
        waitingHint: h('O "Próximo passo" só habilita quando a grade e o formulário têm campos.', 'The "Next step" button only enables once the grid and the form have fields.', 'El botón "Siguiente paso" solo se habilita cuando la cuadrícula y el formulario tienen campos.'),
        title: h('Siga para as ações', 'On to the actions', 'Siga a las acciones'),
        body: h('Com os campos distribuídos, clique em "Próximo passo".', 'With the fields in place, click "Next step".', 'Con los campos distribuidos, haga clic en "Siguiente paso".'),
        advanceOnClick: true,
      },
      {
        id: 'buttons',
        target: 'wizard.buttons',
        backClick: 'wizard.prev',
        interactive: true,
        title: h('Botões da interface', 'Interface buttons', 'Botones de la interfaz'),
        body: h('Escolha quais botões a tela terá: Pesquisar, Limpar, Visualizar, Novo, Editar e Excluir. Ações customizadas (abrir outra tela, SQL, REST) ficam logo abaixo.', 'Choose which buttons the screen has: Search, Clear, View, New, Edit and Delete. Custom actions (open another screen, SQL, REST) are right below.', 'Elija qué botones tendrá la pantalla: Buscar, Limpiar, Ver, Nuevo, Editar y Eliminar. Las acciones personalizadas (abrir otra pantalla, SQL, REST) están justo debajo.'),
      },
      {
        id: 'interface',
        target: 'wizard.action_interface',
        interactive: true,
        title: h('Onde abre o formulário', 'Where the form opens', 'Dónde se abre el formulario'),
        body: h('Mesma tela (substitui a lista), gaveta lateral ou janela central (modal). Muda só a experiência de quem usa.', 'Same screen (replaces the list), side drawer or centered window (modal). It only changes the experience of whoever uses it.', 'Misma pantalla (reemplaza la lista), panel lateral o ventana central (modal). Solo cambia la experiencia de quien lo usa.'),
      },
      {
        id: 'export',
        target: 'wizard.export',
        interactive: true,
        title: h('Exportação de dados', 'Data export', 'Exportación de datos'),
        body: h('Liga a exportação em segundo plano e define os formatos permitidos (Excel, CSV, JSON, PDF, OFX).', 'Turns on background export and sets the allowed formats (Excel, CSV, JSON, PDF, OFX).', 'Activa la exportación en segundo plano y define los formatos permitidos (Excel, CSV, JSON, PDF, OFX).'),
      },
      {
        id: 'query',
        target: 'wizard.query_strategy',
        interactive: true,
        title: h('Estratégia de dados', 'Data strategy', 'Estrategia de datos'),
        body: h('Query Dinâmica: o MetaBuilder monta os JOINs e SELECTs pelas relações. SQL Manual: você escreve o SQL para ter mais controle e desempenho.', 'Dynamic Query: MetaBuilder builds the JOINs and SELECTs from the relations. Manual SQL: you write the SQL for more control and performance.', 'Consulta Dinámica: MetaBuilder arma los JOIN y SELECT por las relaciones. SQL Manual: usted escribe el SQL para más control y rendimiento.'),
      },
      {
        id: 'finish',
        target: 'wizard.next',
        advanceOnClick: true,
        advanceWaitMs: 15000,
        title: h('Finalizar: cria de verdade', 'Finish: it really creates it', 'Finalizar: lo crea de verdad'),
        body: h(
          'Clique em "Finalizar caso de uso". Ele é criado DE VERDADE, como rascunho: só vira tela do app quando você publicar, e dá para excluir pela lixeira do cartão. Se está só treinando, use um nome como "Teste" e apague depois. No plano gratuito ele conta no limite de casos de uso.',
          'Click "Finish use case". It is REALLY created, as a draft: it only becomes an app screen once you publish it, and you can delete it with the card trash icon. If you are just practicing, use a name like "Test" and delete it later. On the free plan it counts toward the use case limit.',
          'Haga clic en "Finalizar caso de uso". Se crea DE VERDAD, como borrador: solo se vuelve pantalla de la app cuando lo publique, y se puede eliminar con la papelera de la tarjeta. Si solo está practicando, use un nombre como "Prueba" y elimínelo después. En el plan gratuito cuenta para el límite de casos de uso.',
        ),
      },
      {
        id: 'draft',
        target: 'studio.latest_card',
        noBack: true,
        findWaitMs: 20000,
        title: h('Seu caso de uso, como rascunho', 'Your use case, as a draft', 'Su caso de uso, como borrador'),
        body: h(
          'Pronto, ele aparece na lista. Enquanto estiver como rascunho, só você o vê pelo Studio: os usuários do app ainda não têm acesso. Use "Configurar" para continuar editando quando quiser.',
          'Done, it shows up in the list. While it is a draft, only you see it in Studio: app users do not have access yet. Use "Configure" to keep editing whenever you want.',
          'Listo, aparece en la lista. Mientras sea borrador, solo usted lo ve en el Studio: los usuarios de la app todavía no tienen acceso. Use "Configurar" para seguir editando cuando quiera.',
        ),
      },
      {
        id: 'publish',
        target: 'studio.latest_publish',
        noBack: true,
        advanceOnClick: true,
        title: h('Publicar', 'Publish', 'Publicar'),
        body: h('Para disponibilizar a tela no app, clique em "Publicar".', 'To make the screen available in the app, click "Publish".', 'Para dejar la pantalla disponible en la app, haga clic en "Publicar".'),
      },
      {
        id: 'publish-confirm',
        target: 'studio.publish_confirm',
        noBack: true,
        advanceOnClick: true,
        advanceWaitMs: 15000,
        title: h('Confirme a publicação', 'Confirm publishing', 'Confirme la publicación'),
        body: h('O MetaBuilder pede uma confirmação porque a publicação passa a valer na hora para os usuários. Clique em "Sim, Publicar".', 'MetaBuilder asks for confirmation because publishing takes effect immediately for users. Click "Yes, Publish".', 'MetaBuilder pide confirmación porque la publicación vale de inmediato para los usuarios. Haga clic en "Sí, Publicar".'),
      },
      {
        id: 'open-published',
        target: 'studio.latest_open',
        noBack: true,
        title: h('Acessar a versão publicada', 'Open the published version', 'Acceder a la versión publicada'),
        body: h(
          'Agora o caso de uso está publicado. A seta "Acessar versão publicada" abre a tela como o usuário final a vê. Alterações futuras ficam em rascunho até você publicar de novo, então dá para testar com calma.',
          'The use case is now published. The "Open published version" arrow opens the screen as the end user sees it. Future changes stay as a draft until you publish again, so you can test calmly.',
          'El caso de uso ya está publicado. La flecha "Acceder a la versión publicada" abre la pantalla como la ve el usuario final. Los cambios futuros quedan como borrador hasta que vuelva a publicar, así que puede probar con calma.',
        ),
      },
    ],
  },
  {
    id: 'studio-dados',
    route: `${STUDIO}/data`,
    title: h('Dados e Schemas', 'Data and Schemas', 'Datos y Esquemas'),
    summary: h('Nomes amigáveis, permissões, auditoria e relacionamentos das tabelas.', 'Friendly names, permissions, audit and table relationships.', 'Nombres amigables, permisos, auditoría y relaciones de las tablas.'),
    steps: [
      {
        id: 'tabs',
        target: 'data.tabs',
        title: h('Duas visões', 'Two views', 'Dos vistas'),
        body: h('Tabela / Campos: nomes e regras de cada tabela e coluna. Relacionamentos: como as tabelas se ligam (a base dos JOINs automáticos).', 'Table / Fields: names and rules for each table and column. Relationships: how tables connect (the basis of automatic JOINs).', 'Tabla / Campos: nombres y reglas de cada tabla y columna. Relaciones: cómo se unen las tablas (la base de los JOIN automáticos).'),
      },
      {
        id: 'tables',
        target: 'data.tables',
        title: h('Suas tabelas', 'Your tables', 'Sus tablas'),
        body: h('Vêm do banco sincronizado. Busque pelo nome e clique para editar os detalhes dela ao lado.', 'They come from the synced database. Search by name and click one to edit its details on the right.', 'Vienen de la base sincronizada. Busque por nombre y haga clic para editar sus detalles a la derecha.'),
      },
      {
        id: 'permissions',
        target: 'data.permissions',
        title: h('Permissões da tabela', 'Table permissions', 'Permisos de la tabla'),
        body: h('Define se os apps podem criar, editar e excluir registros desta tabela. Valem para todos os casos de uso que a usam.', 'Defines whether apps can create, edit and delete records of this table. They apply to every use case that uses it.', 'Define si las apps pueden crear, editar y eliminar registros de esta tabla. Valen para todos los casos de uso que la usan.'),
      },
      {
        id: 'audit',
        target: 'data.audit',
        title: h('Auditoria', 'Audit', 'Auditoría'),
        body: h('Guarda quem criou e quem alterou cada registro, e quando. O servidor preenche sozinho: a tela nunca consegue falsificar. As colunas são reconhecidas pelo nome e você pode trocar.', 'Stores who created and changed each record, and when. The server fills it in: the screen can never fake it. Columns are recognized by name and you can change them.', 'Guarda quién creó y modificó cada registro, y cuándo. Lo completa el servidor: la pantalla nunca puede falsificarlo. Las columnas se reconocen por el nombre y puede cambiarlas.'),
      },
      {
        id: 'field',
        target: 'data.field',
        title: h('Cada coluna', 'Each column', 'Cada columna'),
        body: h('Dê um nome amigável (é o rótulo padrão nas telas), escolha o tipo de campo e ajuste as regras. Depois clique em "Salvar Tabela".', 'Give it a friendly name (the default label on screens), pick the field type and adjust the rules. Then click "Save Table".', 'Dele un nombre amigable (es la etiqueta por defecto en las pantallas), elija el tipo de campo y ajuste las reglas. Luego haga clic en "Guardar Tabla".'),
      },
    ],
  },
]

/** Todos os tours: o Studio e os dados (aqui) mais Login & Segurança, Configurações e Logs (um arquivo por área). */
export const PLATFORM_TOURS: readonly PlatformTour[] = [...BASE_TOURS, ...AUTH_TOURS, ...SETTINGS_TOURS, ...LOGS_TOURS]
