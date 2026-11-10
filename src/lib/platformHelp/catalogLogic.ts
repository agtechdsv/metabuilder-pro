/**
 * Tours das demais lógicas do assistente (Kanban, Agenda, Linha do Tempo, Gantt, Fluxograma, Mapa Mental, Mapa, BI, Galeria e
 * Personalizado). Cada tour percorre as 4 etapas do assistente para aquela lógica: escolher a lógica, a tabela, a configuração
 * própria dela, as zonas de campos e as ações, e reaproveita o final do tour "Criar um caso de uso" (botões, exportação,
 * consulta, rascunho e publicação). Textos em pt, en e es; cada alvo é um `data-help-id` do assistente.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour, StepRule } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const STUDIO = '/admin/:workspace/:project/studio'
const exists = (id: string): StepRule => ({ id, check: 'attr', attr: 'data-help-id', equals: id })
const stage = (n: string): StepRule => ({ id: 'wizard.stepper', check: 'attr', attr: 'data-help-state', equals: n })

interface Spec {
  /** id da lógica no assistente (`config.logic_type`) */
  logic: string
  /** `data-help-id` do cartão da lógica e do grupo onde ele fica */
  card: string
  cat: string
  catName: T3
  name: T3
  summary: T3
  /** o que a lógica faz, em uma frase (passo da escolha) */
  about: T3
  /** o que dizer na escolha da tabela */
  tables: T3
  /** passos da etapa 3 (a configuração própria da lógica); o primeiro leva o `backClick` */
  cfg: PlatformStep[]
  /** o que dizer em cada zona (omitida = a zona não existe nesta lógica ou fica sem texto próprio) */
  grid?: T3
  form?: T3
  filter?: T3
  /** frase a mais no passo "Padrões da tela" (itens dessa caixa próprios da lógica, ex.: a ordem da linha do tempo) */
  defaultsNote?: T3
  /** o que falta para o "Próximo passo" habilitar */
  ready: T3
  /** a lógica pede o interruptor "argumentos" (filtros) */
  args?: boolean
}

const pickSteps = (s: Spec): PlatformStep[] => [
  st('group', s.cat, [`Abra o grupo "${s.catName[0]}"`, `Open the "${s.catName[1]}" group`, `Abra el grupo "${s.catName[2]}"`], [
    `As lógicas ficam em grupos. Clique em "${s.catName[0]}" para abrir e ver os tipos de tela.`,
    `Logics are in groups. Click "${s.catName[1]}" to open it and see the screen types.`,
    `Las lógicas están en grupos. Haga clic en "${s.catName[2]}" para abrirlo y ver los tipos de pantalla.`,
  ], {
    interactive: true,
    completeWhen: exists(s.card),
    waitingHint: h([`Clique em "${s.catName[0]}" para abrir o grupo.`, `Click "${s.catName[1]}" to open the group.`, `Haga clic en "${s.catName[2]}" para abrir el grupo.`]),
  }),
  st('pick', s.card, [`Escolha "${s.name[0]}"`, `Pick "${s.name[1]}"`, `Elija "${s.name[2]}"`], s.about, {
    interactive: true,
    completeWhen: { id: 'wizard.logic', check: 'attr', attr: 'data-help-logic', equals: s.logic },
    waitingHint: h([`Clique no cartão "${s.name[0]}" para continuar.`, `Click the "${s.name[1]}" card to continue.`, `Haga clic en la tarjeta "${s.name[2]}" para continuar.`]),
  }),
  ...(s.args ? [st('args', 'wizard.has_args', ['Argumentos de busca', 'Search arguments', 'Argumentos de búsqueda'], [
    'Este interruptor liga a zona de filtros: o usuário passa a ter campos para filtrar antes de ver os dados. Desligado, a tela já mostra tudo. Você pode marcar ou não; dá para mudar depois.',
    'This switch turns on the filter zone: users get fields to filter before seeing the data. Off, the screen shows everything right away. You can check it or not; you can change it later.',
    'Este interruptor activa la zona de filtros: el usuario pasa a tener campos para filtrar antes de ver los datos. Apagado, la pantalla ya muestra todo. Puede marcarlo o no; se puede cambiar después.',
  ], { skipIfMissing: true })] : []),
]

const zoneSteps = (s: Spec): PlatformStep[] => [
  ...(s.filter ? [st('zone-filter', 'wizard.zone_filter', ['Zona de filtro', 'Filter zone', 'Zona de filtro'], s.filter, { skipIfMissing: true })] : []),
  ...(s.grid ? [st('zone-grid', 'wizard.zone_grid', ['Zona dos campos exibidos', 'Displayed fields zone', 'Zona de campos mostrados'], s.grid, { skipIfMissing: true })] : []),
  ...(s.form ? [st('zone-form', 'wizard.zone_form', ['Zona do formulário', 'Form zone', 'Zona del formulario'], s.form, { skipIfMissing: true })] : []),
]

function build(base: PlatformTour, s: Spec): PlatformTour {
  const tail = base.steps.slice(base.steps.findIndex(x => x.id === 'next3'))
  const byId = (id: string) => base.steps.find(x => x.id === id)!
  // ordem de leitura = ordem na tela, de cima para baixo: padrões da tela, configuração da lógica, painel de campos, zonas
  // a introdução só mostra a área (sem edição); a configuração é feita nos passos seguintes, campo a campo
  const cfg = s.cfg.map(x => (x.id === 'cfg-intro' ? { ...x, readOnly: true } : x))
  const steps: PlatformStep[] = [
    byId('open'),
    st('name', 'wizard.name', ['Nome e endereço', 'Name and address', 'Nombre y dirección'], [
      'O nome aparece no menu do app e o endereço (slug) vira o final da URL. Para treinar, use um nome como "Teste".',
      'The name shows in the app menu and the address (slug) becomes the end of the URL. To practice, use a name like "Test".',
      'El nombre aparece en el menú de la app y la dirección (slug) pasa a ser el final de la URL. Para practicar, use un nombre como "Prueba".',
    ], {
      interactive: true,
      completeWhen: { id: 'wizard.name_input', check: 'filled' },
      waitingHint: h(['Digite o nome da tela para continuar.', 'Type the screen name to continue.', 'Escriba el nombre de la pantalla para continuar.']),
    }),
    ...pickSteps(s),
    byId('next1'),
    st('tables', 'wizard.tables', ['A tabela principal', 'The main table', 'La tabla principal'], s.tables, {
      backClick: 'wizard.prev',
      interactive: true,
      completeWhen: { id: 'wizard.tables', check: 'attr', attr: 'data-help-state', equals: 'ok' },
      waitingHint: h(['Clique em uma tabela para continuar.', 'Click a table to continue.', 'Haga clic en una tabla para continuar.']),
    }),
    byId('next2'),
    st('general', 'wizard.cfg_general', ['Padrões da tela', 'Screen defaults', 'Valores de la pantalla'], [
      'Registros por página (LIMIT) define quantos registros vêm de cada vez; em branco vale o padrão do sistema. Aqui também ficam o texto de ajuda da tela e a visão geral da ajuda dos campos.',
      'Records per page (LIMIT) sets how many records come at a time; blank uses the system default. The screen help text and the field help overview are also here.',
      'Registros por página (LIMIT) define cuántos registros vienen cada vez; en blanco vale el valor del sistema. Aquí también están el texto de ayuda de la pantalla y la visión general de la ayuda de los campos.',
    ].map((b, i) => (s.defaultsNote ? b + ' ' + s.defaultsNote[i] : b)) as unknown as T3, { skipIfMissing: true, backClick: 'wizard.prev' }),
    ...cfg,
    st('fields-panel', 'wizard.fields_panel', ['De onde vêm os campos', 'Where fields come from', 'De dónde vienen los campos'], [
      'O painel lista os campos das tabelas escolhidas. Arraste um campo para uma zona (ou clique no + dele). Os seletores de configuração acima também mostram esses campos.',
      'The panel lists the fields of the chosen tables. Drag a field into a zone (or click its +). The configuration selectors above also list these fields.',
      'El panel lista los campos de las tablas elegidas. Arrastre un campo a una zona (o haga clic en su +). Los selectores de configuración de arriba también muestran estos campos.',
    ], { skipIfMissing: true }),
    ...zoneSteps(s),
    st('fill', 'wizard.fields_panel', ['Agora é com você', 'Now it is your turn', 'Ahora es su turno'], [
      `Preencha o que a lógica pede e arraste os campos para as zonas. A tela está liberada nesta etapa.`,
      `Fill in what the logic asks for and drag the fields into the zones. The screen is free in this step.`,
      `Complete lo que la lógica pide y arrastre los campos a las zonas. La pantalla está liberada en esta etapa.`,
    ], {
      skipIfMissing: true,
      freeInteraction: true,
      completeWhen: { id: 'wizard.next', check: 'attr', attr: 'data-help-state', equals: 'ready' },
      waitingHint: h(s.ready),
    }),
    ...tail,
  ]
  return {
    id: `studio-logica-${s.logic.replace(/_/g, '-')}`,
    route: STUDIO,
    onlyLogic: s.logic,
    freeClicks: true,
    title: h([`Criar: ${s.name[0]}`, `Create: ${s.name[1]}`, `Crear: ${s.name[2]}`]),
    summary: h(s.summary),
    recover: ['studio.tab_list', 'ai.back'],
    entry: [
      { rule: stage('4'), step: 'buttons' },
      { rule: stage('3'), step: 'general' },
      { rule: stage('2'), step: 'tables' },
      { rule: stage('1'), step: 'name' },
    ],
    steps,
  }
}

const SPECS: Spec[] = [
  // ───────── Kanban
  {
    logic: 'kanban', card: 'wizard.logic_kanban', cat: 'wizard.logic_cat_projetos', catName: ['Projetos e Tempo', 'Projects and Time', 'Proyectos y Tiempo'],
    name: ['Kanban', 'Kanban', 'Kanban'],
    summary: ['Quadro de cartões em colunas (por status, responsável...), do assistente à publicação.', 'Board of cards in columns (by status, owner...), from the wizard to publishing.', 'Tablero de tarjetas en columnas (por estado, responsable...), del asistente a la publicación.'],
    about: ['Kanban mostra cada registro como um cartão, em colunas formadas pelo valor de um campo (ex.: status). Arrastar o cartão de uma coluna para outra muda esse campo.', 'Kanban shows each record as a card, in columns made from the value of a field (e.g. status). Dragging a card to another column changes that field.', 'Kanban muestra cada registro como una tarjeta, en columnas formadas por el valor de un campo (ej.: estado). Arrastrar la tarjeta a otra columna cambia ese campo.'],
    args: true,
    tables: ['Escolha a tabela dos cartões (ex.: Tarefas ou Pedidos). Cada registro dela vira um cartão. As tabelas relacionadas ficam disponíveis na próxima etapa.', 'Pick the table of the cards (e.g. Tasks or Orders). Each record of it becomes a card. Related tables are available in the next step.', 'Elija la tabla de las tarjetas (ej.: Tareas o Pedidos). Cada registro suyo pasa a ser una tarjeta. Las tablas relacionadas quedan disponibles en la próxima etapa.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_kanban', ['Configuração do Kanban', 'Kanban configuration', 'Configuración del Kanban'], [
        'Aqui você define em quais COLUNAS os cartões se dividem. Vamos ver cada campo, de cima para baixo; o de agrupamento é obrigatório.',
        'Here you define which COLUMNS the cards split into. We will go through each field, from top to bottom; the group field is required.',
        'Aquí define en qué COLUMNAS se dividen las tarjetas. Veremos cada campo, de arriba abajo; el de agrupamiento es obligatorio.',
      ]),
      st('group-field', 'wizard.kanban_group', ['Campo de agrupamento', 'Group field', 'Campo de agrupamiento'], [
        'Escolha o campo cujo valor define a coluna (ex.: status, etapa, responsável). Cada valor diferente vira uma coluna.',
        'Pick the field whose value defines the column (e.g. status, stage, owner). Each different value becomes a column.',
        'Elija el campo cuyo valor define la columna (ej.: estado, etapa, responsable). Cada valor distinto pasa a ser una columna.',
      ], { interactive: true }),
      st('alt-table', 'wizard.kanban_alt_table', ['Agrupamentos alternativos', 'Alternative groupings', 'Agrupamientos alternativos'], [
        'Opcional: escolha uma tabela e marque campos para o usuário final TROCAR o agrupamento na tela (ex.: ver por status ou por responsável). O campo acima continua sendo o padrão.',
        'Optional: pick a table and check fields so the end user can SWITCH the grouping on screen (e.g. view by status or by owner). The field above remains the default.',
        'Opcional: elija una tabla y marque campos para que el usuario final CAMBIE el agrupamiento en la pantalla (ej.: ver por estado o por responsable). El campo de arriba sigue siendo el predeterminado.',
      ], { interactive: true }),
      st('alt-selected', 'wizard.kanban_alt_selected', ['Os selecionados', 'The selected ones', 'Los seleccionados'], [
        'Lista os agrupamentos alternativos marcados, no formato tabela.coluna. O × remove. Se ficar vazia, o usuário não ganha o seletor.',
        'Lists the checked alternative groupings, as table.column. The × removes. If empty, the user gets no selector.',
        'Lista los agrupamientos alternativos marcados, en el formato tabla.columna. La × quita. Si queda vacía, el usuario no gana el selector.',
      ]),
    ],
    filter: ['Só aparece com os argumentos ligados: os campos que o usuário usa para filtrar os cartões antes de ver o quadro.', 'Only shows with arguments on: the fields users use to filter the cards before seeing the board.', 'Solo aparece con los argumentos activados: los campos que el usuario usa para filtrar las tarjetas antes de ver el tablero.'],
    grid: ['"Campos do Card": o que aparece em cada cartão (título, responsável, prazo...). Coloque pelo menos um: o Kanban exige.', '"Card fields": what shows on each card (title, owner, deadline...). Put at least one: Kanban requires it.', '"Campos de la tarjeta": lo que aparece en cada tarjeta (título, responsable, plazo...). Ponga al menos uno: el Kanban lo exige.'],
    form: ['O formulário que abre ao criar ou editar um cartão. Campos de tabelas filhas viram abas de detalhe.', 'The form that opens when creating or editing a card. Fields of child tables become detail tabs.', 'El formulario que se abre al crear o editar una tarjeta. Los campos de tablas hijas pasan a ser pestañas de detalle.'],
    ready: ['Faltam o campo de agrupamento e pelo menos um campo no card.', 'The group field and at least one card field are missing.', 'Faltan el campo de agrupamiento y al menos un campo en la tarjeta.'],
  },
  // ───────── Agenda
  {
    logic: 'scheduler', card: 'wizard.logic_scheduler', cat: 'wizard.logic_cat_projetos', catName: ['Projetos e Tempo', 'Projects and Time', 'Proyectos y Tiempo'],
    name: ['Agenda / Calendário', 'Schedule / Calendar', 'Agenda / Calendario'],
    summary: ['Compromissos, prazos e tarefas em um calendário, do assistente à publicação.', 'Appointments, deadlines and tasks on a calendar, from the wizard to publishing.', 'Compromisos, plazos y tareas en un calendario, del asistente a la publicación.'],
    about: ['A Agenda mostra cada registro como um evento em um calendário, posicionado pela data de início (e fim, se houver).', 'The Schedule shows each record as an event on a calendar, placed by the start date (and end, if any).', 'La Agenda muestra cada registro como un evento en un calendario, ubicado por la fecha de inicio (y fin, si hay).'],
    tables: ['Escolha a tabela dos eventos (ex.: Agendamentos, Visitas, Tarefas com prazo). Ela precisa ter pelo menos um campo de data.', 'Pick the events table (e.g. Appointments, Visits, Tasks with a deadline). It needs at least one date field.', 'Elija la tabla de los eventos (ej.: Citas, Visitas, Tareas con plazo). Necesita al menos un campo de fecha.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_scheduler', ['Configuração do Calendário', 'Calendar configuration', 'Configuración del Calendario'], [
        'Diga ao calendário quais campos usar. O título e a data de início são obrigatórios.',
        'Tell the calendar which fields to use. The title and start date are required.',
        'Diga al calendario qué campos usar. El título y la fecha de inicio son obligatorios.',
      ]),
      st('title', 'wizard.sched_title', ['Campo do título', 'Title field', 'Campo del título'], ['O texto que aparece em cada evento (ex.: nome do cliente ou assunto).', 'The text shown on each event (e.g. customer name or subject).', 'El texto que aparece en cada evento (ej.: nombre del cliente o asunto).'], { interactive: true }),
      st('start', 'wizard.sched_start', ['Data de início', 'Start date', 'Fecha de inicio'], ['Quando o evento começa. A lista só mostra campos de data ou data e hora.', 'When the event starts. The list only shows date or date-time fields.', 'Cuándo empieza el evento. La lista solo muestra campos de fecha o fecha y hora.'], { interactive: true }),
      st('end', 'wizard.sched_end', ['Data de fim (opcional)', 'End date (optional)', 'Fecha de fin (opcional)'], ['Quando termina. Sem ela, o evento vale para uma data única.', 'When it ends. Without it, the event is for a single date.', 'Cuándo termina. Sin ella, el evento vale para una fecha única.'], { interactive: true }),
      st('color', 'wizard.sched_color', ['Cor ou categoria (opcional)', 'Color or category (optional)', 'Color o categoría (opcional)'], ['Um campo cujo valor define a cor do evento (ex.: tipo, status). Sem ele, a cor padrão é índigo.', 'A field whose value defines the event color (e.g. type, status). Without it, the default color is indigo.', 'Un campo cuyo valor define el color del evento (ej.: tipo, estado). Sin él, el color predeterminado es índigo.'], { interactive: true }),
    ],
    grid: ['Os campos que aparecem na lista e no detalhe do evento. A Agenda exige pelo menos um.', 'The fields shown in the list and in the event detail. The Schedule requires at least one.', 'Los campos que aparecen en la lista y en el detalle del evento. La Agenda exige al menos uno.'],
    form: ['O formulário para criar e editar um evento.', 'The form to create and edit an event.', 'El formulario para crear y editar un evento.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar os eventos antes de ver o resultado.', 'Optional: the fields users use to filter the events before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los eventos antes de ver el resultado.'],
    ready: ['Faltam o título, a data de início e pelo menos um campo na zona de exibição.', 'The title, the start date and at least one field in the display zone are missing.', 'Faltan el título, la fecha de inicio y al menos un campo en la zona de visualización.'],
  },
  // ───────── Linha do tempo
  {
    logic: 'timeline', card: 'wizard.logic_timeline', cat: 'wizard.logic_cat_projetos', catName: ['Projetos e Tempo', 'Projects and Time', 'Proyectos y Tiempo'],
    name: ['Linha do Tempo / Feed', 'Timeline / Feed', 'Línea de Tiempo / Feed'],
    summary: ['Registros em ordem cronológica, na vertical ou na horizontal, do assistente à publicação.', 'Records in chronological order, vertical or horizontal, from the wizard to publishing.', 'Registros en orden cronológico, vertical u horizontal, del asistente a la publicación.'],
    about: ['A Linha do Tempo mostra os registros em ordem cronológica, a partir de uma data, como cartões ou como infográfico. Serve para históricos, andamentos e feeds.', 'The Timeline shows records in chronological order, from a date, as cards or as an infographic. It suits histories, progress logs and feeds.', 'La Línea de Tiempo muestra los registros en orden cronológico, a partir de una fecha, como tarjetas o como infografía. Sirve para historiales, avances y feeds.'],
    tables: ['Escolha a tabela dos fatos da linha (ex.: Histórico, Ocorrências). Ela precisa de um campo de data.', 'Pick the table of the timeline facts (e.g. History, Incidents). It needs a date field.', 'Elija la tabla de los hechos de la línea (ej.: Historial, Incidencias). Necesita un campo de fecha.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_timeline', ['Configuração da Linha do Tempo', 'Timeline configuration', 'Configuración de la Línea de Tiempo'], ['Dois blocos: os dados (que campos contam a história) e o estilo (como ela é desenhada). Título e data são obrigatórios.', 'Two blocks: the data (which fields tell the story) and the style (how it is drawn). Title and date are required.', 'Dos bloques: los datos (qué campos cuentan la historia) y el estilo (cómo se dibuja). Título y fecha son obligatorios.']),
      st('title', 'wizard.tl_title', ['Campo de título', 'Title field', 'Campo de título'], ['O título de cada ponto da linha.', 'The title of each point on the line.', 'El título de cada punto de la línea.'], { interactive: true }),
      st('date', 'wizard.tl_date', ['Campo de data', 'Date field', 'Campo de fecha'], ['A data que posiciona cada ponto. A lista só mostra campos de data.', 'The date that places each point. The list only shows date fields.', 'La fecha que ubica cada punto. La lista solo muestra campos de fecha.'], { interactive: true }),
      st('desc', 'wizard.tl_desc', ['Descrição (opcional)', 'Description (optional)', 'Descripción (opcional)'], ['Um texto abaixo do título.', 'A text below the title.', 'Un texto debajo del título.'], { interactive: true }),
      st('icon', 'wizard.tl_icon', ['Ícone ou status (opcional)', 'Icon or status (optional)', 'Ícono o estado (opcional)'], ['Um campo que muda o ícone ou a marca de cada ponto.', 'A field that changes the icon or mark of each point.', 'Un campo que cambia el ícono o la marca de cada punto.'], { interactive: true }),
      st('style', 'wizard.tl_style', ['Estilo e comportamento', 'Style and behavior', 'Estilo y comportamiento'], ['Direção (vertical ou horizontal), modo (intercalado ou mesmo lado), animação do desenho, estilo visual (cards ou infográfico) e escala dos textos. A prévia final é no app publicado.', 'Direction (vertical or horizontal), mode (alternating or same side), draw animation, visual style (cards or infographic) and text scale. The final preview is in the published app.', 'Dirección (vertical u horizontal), modo (intercalado o mismo lado), animación del dibujo, estilo visual (tarjetas o infografía) y escala de los textos. La vista final es en la app publicada.']),
    ],
    defaultsNote: ['Aqui também ficam a ordem cronológica (mais antigo ou mais recente primeiro), separada para tela horizontal e vertical.', 'The chronological order (oldest or newest first) is also here, separate for horizontal and vertical screens.', 'Aquí también está el orden cronológico (más antiguo o más reciente primero), por separado para pantalla horizontal y vertical.'],
    form: ['O formulário para criar e editar um ponto da linha. A Linha do Tempo não tem zona de lista: o que aparece vem da configuração acima.', 'The form to create and edit a point on the line. The Timeline has no list zone: what shows comes from the configuration above.', 'El formulario para crear y editar un punto de la línea. La Línea de Tiempo no tiene zona de lista: lo que aparece viene de la configuración de arriba.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar os pontos da linha antes de ver o resultado.', 'Optional: the fields users use to filter the points on the line before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los puntos de la línea antes de ver el resultado.'],
    ready: ['Faltam o campo de título e o campo de data.', 'The title field and the date field are missing.', 'Faltan el campo de título y el campo de fecha.'],
  },
  // ───────── Gantt
  {
    logic: 'gantt', card: 'wizard.logic_gantt', cat: 'wizard.logic_cat_projetos', catName: ['Projetos e Tempo', 'Projects and Time', 'Proyectos y Tiempo'],
    name: ['Gráfico de Gantt', 'Gantt Chart', 'Gráfico de Gantt'],
    summary: ['Cronograma em barras com início, fim e progresso, do assistente à publicação.', 'Bar schedule with start, end and progress, from the wizard to publishing.', 'Cronograma en barras con inicio, fin y progreso, del asistente a la publicación.'],
    about: ['O Gantt desenha cada registro como uma barra entre a data inicial e a final, opcionalmente com a porcentagem de progresso.', 'The Gantt draws each record as a bar between the start and end dates, optionally with the progress percentage.', 'El Gantt dibuja cada registro como una barra entre la fecha inicial y la final, opcionalmente con el porcentaje de progreso.'],
    tables: ['Escolha a tabela das tarefas (ex.: Tarefas do projeto, Etapas de obra). Ela precisa de data inicial e final.', 'Pick the tasks table (e.g. Project tasks, Construction stages). It needs start and end dates.', 'Elija la tabla de las tareas (ej.: Tareas del proyecto, Etapas de obra). Necesita fecha inicial y final.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_gantt', ['Configuração do Gantt', 'Gantt configuration', 'Configuración del Gantt'], ['Título, data inicial e data final são obrigatórios. O progresso é opcional.', 'Title, start date and end date are required. Progress is optional.', 'Título, fecha inicial y fecha final son obligatorios. El progreso es opcional.']),
      st('title', 'wizard.gantt_title', ['Campo de título', 'Title field', 'Campo de título'], ['O nome escrito em cada barra.', 'The name written on each bar.', 'El nombre escrito en cada barra.'], { interactive: true }),
      st('start', 'wizard.gantt_start', ['Data inicial', 'Start date', 'Fecha inicial'], ['Onde a barra começa. A lista só mostra campos de data.', 'Where the bar starts. The list only shows date fields.', 'Donde empieza la barra. La lista solo muestra campos de fecha.'], { interactive: true }),
      st('end', 'wizard.gantt_end', ['Data final', 'End date', 'Fecha final'], ['Onde a barra termina. Obrigatória nesta lógica.', 'Where the bar ends. Required in this logic.', 'Donde termina la barra. Obligatoria en esta lógica.'], { interactive: true }),
      st('progress', 'wizard.gantt_progress', ['Progresso % (opcional)', 'Progress % (optional)', 'Progreso % (opcional)'], ['Um campo numérico (0 a 100) que preenche a barra. Sem ele, o progresso não aparece.', 'A numeric field (0 to 100) that fills the bar. Without it, progress is not shown.', 'Un campo numérico (0 a 100) que llena la barra. Sin él, el progreso no aparece.'], { interactive: true }),
    ],
    form: ['O formulário para criar e editar uma tarefa. O Gantt não tem zona de lista: o que aparece vem da configuração acima.', 'The form to create and edit a task. The Gantt has no list zone: what shows comes from the configuration above.', 'El formulario para crear y editar una tarea. El Gantt no tiene zona de lista: lo que aparece viene de la configuración de arriba.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar as tarefas do Gantt antes de ver o resultado.', 'Optional: the fields users use to filter the Gantt tasks before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar las tareas del Gantt antes de ver el resultado.'],
    ready: ['Faltam o título, a data inicial ou a data final.', 'The title, the start date or the end date is missing.', 'Faltan el título, la fecha inicial o la fecha final.'],
  },
  // ───────── Fluxograma
  {
    logic: 'blueprint', card: 'wizard.logic_blueprint', cat: 'wizard.logic_cat_mapas', catName: ['Mapas e Fluxos', 'Maps and Flows', 'Mapas y Flujos'],
    name: ['Fluxograma (Blueprint)', 'Flowchart (Blueprint)', 'Diagrama de flujo (Blueprint)'],
    summary: ['Processos e etapas ligados por setas, do assistente à publicação.', 'Processes and steps linked by arrows, from the wizard to publishing.', 'Procesos y etapas unidos por flechas, del asistente a la publicación.'],
    about: ['O Fluxograma desenha cada registro como um nó e liga cada nó ao anterior por uma seta. Serve para processos, aprovações e dependências.', 'The Flowchart draws each record as a node and links each node to the previous one with an arrow. It suits processes, approvals and dependencies.', 'El Diagrama de flujo dibuja cada registro como un nodo y une cada nodo al anterior con una flecha. Sirve para procesos, aprobaciones y dependencias.'],
    tables: ['Escolha a tabela dos nós (ex.: Etapas do processo). Ela precisa de uma coluna que aponte para o nó anterior.', 'Pick the nodes table (e.g. Process steps). It needs a column pointing to the previous node.', 'Elija la tabla de los nodos (ej.: Etapas del proceso). Necesita una columna que apunte al nodo anterior.'],
    cfg: [
      st('cfg-intro', 'wizard.bp_data', ['Mapeamento de dados', 'Data mapping', 'Mapeo de datos'], ['Quais campos formam o nó e a ligação. O título e o nó anterior são obrigatórios.', 'Which fields form the node and the link. The title and the previous node are required.', 'Qué campos forman el nodo y el vínculo. El título y el nodo anterior son obligatorios.']),
      st('title', 'wizard.bp_title', ['Título do nó', 'Node title', 'Título del nodo'], ['O texto escrito em cada nó.', 'The text written on each node.', 'El texto escrito en cada nodo.'], { interactive: true }),
      st('pred', 'wizard.bp_pred', ['Nó anterior (predecessora)', 'Previous node (predecessor)', 'Nodo anterior (predecesor)'], ['A coluna que guarda o código do nó anterior. É ela que desenha as setas. Um nó sem valor aqui é o início do fluxo.', 'The column holding the code of the previous node. It draws the arrows. A node with no value here is the start of the flow.', 'La columna que guarda el código del nodo anterior. Ella dibuja las flechas. Un nodo sin valor aquí es el inicio del flujo.'], { interactive: true }),
      st('status', 'wizard.bp_status', ['Status (opcional)', 'Status (optional)', 'Estado (opcional)'], ['Um campo que colore o nó conforme o andamento.', 'A field that colors the node according to progress.', 'Un campo que colorea el nodo según el avance.'], { interactive: true }),
      st('desc', 'wizard.bp_desc', ['Descrição (opcional)', 'Description (optional)', 'Descripción (opcional)'], ['Um texto menor dentro do nó.', 'A smaller text inside the node.', 'Un texto menor dentro del nodo.'], { interactive: true }),
      st('style', 'wizard.bp_style', ['Estilo e comportamento', 'Style and behavior', 'Estilo y comportamiento'], ['Direção do fluxo (vertical ou horizontal), animação das setas e escala dos cards e textos.', 'Flow direction (vertical or horizontal), arrow animation and card and text scale.', 'Dirección del flujo (vertical u horizontal), animación de las flechas y escala de las tarjetas y textos.']),
    ],
    grid: ['Os campos que aparecem no detalhe do nó.', 'The fields shown in the node detail.', 'Los campos que aparecen en el detalle del nodo.'],
    form: ['O formulário para criar e editar um nó.', 'The form to create and edit a node.', 'El formulario para crear y editar un nodo.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar os nós do fluxo antes de ver o resultado.', 'Optional: the fields users use to filter the flow nodes before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los nodos del flujo antes de ver el resultado.'],
    ready: ['Faltam o título do nó e o campo do nó anterior.', 'The node title and the previous node field are missing.', 'Faltan el título del nodo y el campo del nodo anterior.'],
  },
  // ───────── Mapa mental
  {
    logic: 'mapa_mental', card: 'wizard.logic_mapa_mental', cat: 'wizard.logic_cat_mapas', catName: ['Mapas e Fluxos', 'Maps and Flows', 'Mapas y Flujos'],
    name: ['Mapa Mental', 'Mind Map', 'Mapa Mental'],
    summary: ['Hierarquia de tabelas desenhada como um mapa que se abre em ramos, do assistente à publicação.', 'Hierarchy of tables drawn as a map that opens into branches, from the wizard to publishing.', 'Jerarquía de tablas dibujada como un mapa que se abre en ramas, del asistente a la publicación.'],
    about: ['O Mapa Mental desenha uma hierarquia: a raiz é uma tabela e cada nível abaixo é uma tabela relacionada (ex.: Cliente > Pedidos > Itens). Os nós abrem em ramos.', 'The Mind Map draws a hierarchy: the root is a table and each level below is a related table (e.g. Customer > Orders > Items). The nodes open into branches.', 'El Mapa Mental dibuja una jerarquía: la raíz es una tabla y cada nivel de abajo es una tabla relacionada (ej.: Cliente > Pedidos > Ítems). Los nodos se abren en ramas.'],
    tables: ['Escolha a tabela raiz do mapa (o centro). Os níveis abaixo são montados na próxima etapa.', 'Pick the root table of the map (the center). The levels below are set up in the next step.', 'Elija la tabla raíz del mapa (el centro). Los niveles de abajo se arman en la próxima etapa.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_mindmap', ['Hierarquia do mapa', 'Map hierarchy', 'Jerarquía del mapa'], ['Cada cartão é um NÍVEL. O Nível 1 é a raiz; os seguintes se ligam ao anterior. É preciso configurar pelo menos um nível.', 'Each card is a LEVEL. Level 1 is the root; the following ones link to the previous one. At least one level must be set up.', 'Cada tarjeta es un NIVEL. El Nivel 1 es la raíz; los siguientes se unen al anterior. Hay que configurar al menos un nivel.']),
      st('start', 'wizard.mm_start', ['Criar o primeiro nível', 'Create the first level', 'Crear el primer nivel'], ['Clique em "Começar hierarquia relacional" para criar o Nível 1 (a raiz do mapa). Os próximos passos mostram o que configurar nele.', 'Click "Start relational hierarchy" to create Level 1 (the root of the map). The next steps show what to set up in it.', 'Haga clic en "Comenzar jerarquía relacional" para crear el Nivel 1 (la raíz del mapa). Los próximos pasos muestran qué configurar en él.'], { skipIfMissing: true, advanceOnClick: true }),
      st('level', 'wizard.mm_level', ['Um nível', 'One level', 'Un nivel'], ['Em cada nível você escolhe a tabela, como ela se liga ao nível anterior (coluna direta ou tabela intermediária N:M), o campo do título do card, o campo da descrição e, se quiser, um caso de uso que abre ao clicar no nó (em modal ou em outra tela).', 'On each level you pick the table, how it links to the previous level (direct column or N:M link table), the card title field, the description field and, if you want, a use case that opens when clicking the node (in a modal or another screen).', 'En cada nivel elige la tabla, cómo se une al nivel anterior (columna directa o tabla intermedia N:M), el campo del título de la tarjeta, el campo de la descripción y, si quiere, un caso de uso que se abre al hacer clic en el nodo (en modal o en otra pantalla).'], { skipIfMissing: true }),
      st('add', 'wizard.cfg_mindmap', ['Monte a hierarquia', 'Build the hierarchy', 'Arme la jerarquía'], ['A tela está livre: clique em "Adicionar nível abaixo" para criar o próximo nível (ex.: depois do Cliente, os Pedidos) e configure cada um (tabela, relação com o anterior, título, descrição). Pode adicionar quantos quiser. Quando terminar, clique em "Próximo" aqui no balão.', 'The screen is free: click "Add level below" to create the next level (e.g. after Customer, the Orders) and set up each one (table, link to the previous, title, description). Add as many as you want. When you are done, click "Next" here in the balloon.', 'La pantalla está libre: haga clic en "Agregar nivel debajo" para crear el próximo nivel (ej.: después del Cliente, los Pedidos) y configure cada uno (tabla, relación con el anterior, título, descripción). Agregue cuantos quiera. Al terminar, haga clic en "Siguiente" aquí en el globo.'], { skipIfMissing: true, freeInteraction: true }),
    ],
    grid: ['Os campos que aparecem dentro de cada nó do mapa. O Mapa Mental exige pelo menos um.', 'The fields shown inside each map node. The Mind Map requires at least one.', 'Los campos que aparecen dentro de cada nodo del mapa. El Mapa Mental exige al menos uno.'],
    form: ['O formulário que abre ao criar ou editar um nó.', 'The form that opens when creating or editing a node.', 'El formulario que se abre al crear o editar un nodo.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar os nós do mapa antes de ver o resultado.', 'Optional: the fields users use to filter the map nodes before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los nodos del mapa antes de ver el resultado.'],
    ready: ['Faltam pelo menos um nível na hierarquia e um campo nos nós.', 'At least one hierarchy level and one node field are missing.', 'Faltan al menos un nivel en la jerarquía y un campo en los nodos.'],
  },
  // ───────── Mapa
  {
    logic: 'map', card: 'wizard.logic_map', cat: 'wizard.logic_cat_mapas', catName: ['Mapas e Fluxos', 'Maps and Flows', 'Mapas y Flujos'],
    name: ['Visão de Mapa (Geospatial)', 'Map View (Geospatial)', 'Vista de Mapa (Geoespacial)'],
    summary: ['Registros como marcadores em um mapa interativo, do assistente à publicação.', 'Records as markers on an interactive map, from the wizard to publishing.', 'Registros como marcadores en un mapa interactivo, del asistente a la publicación.'],
    about: ['A Visão de Mapa mostra cada registro como um marcador em um mapa interativo, posicionado por latitude e longitude.', 'The Map View shows each record as a marker on an interactive map, placed by latitude and longitude.', 'La Vista de Mapa muestra cada registro como un marcador en un mapa interactivo, ubicado por latitud y longitud.'],
    tables: ['Escolha a tabela dos pontos (ex.: Clientes, Lojas, Obras). Ela precisa de duas colunas com as coordenadas.', 'Pick the table of the points (e.g. Customers, Stores, Sites). It needs two columns with the coordinates.', 'Elija la tabla de los puntos (ej.: Clientes, Tiendas, Obras). Necesita dos columnas con las coordenadas.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_map', ['Configuração do Mapa', 'Map configuration', 'Configuración del Mapa'], ['Título, latitude e longitude são obrigatórios. A descrição é opcional.', 'Title, latitude and longitude are required. The description is optional.', 'Título, latitud y longitud son obligatorios. La descripción es opcional.']),
      st('title', 'wizard.map_title', ['Campo de título', 'Title field', 'Campo de título'], ['O texto que aparece ao clicar no marcador.', 'The text shown when clicking the marker.', 'El texto que aparece al hacer clic en el marcador.'], { interactive: true }),
      st('desc', 'wizard.map_desc', ['Descrição (opcional)', 'Description (optional)', 'Descripción (opcional)'], ['Um texto menor abaixo do título, no balão do marcador.', 'A smaller text below the title, in the marker balloon.', 'Un texto menor debajo del título, en el globo del marcador.'], { interactive: true }),
      st('lat', 'wizard.map_lat', ['Latitude (Y)', 'Latitude (Y)', 'Latitud (Y)'], ['A coluna com a latitude (ex.: -23.55). Valores entre -90 e 90.', 'The column with the latitude (e.g. -23.55). Values between -90 and 90.', 'La columna con la latitud (ej.: -23.55). Valores entre -90 y 90.'], { interactive: true }),
      st('lng', 'wizard.map_lng', ['Longitude (X)', 'Longitude (X)', 'Longitud (X)'], ['A coluna com a longitude (ex.: -46.63). Valores entre -180 e 180. Latitude e longitude invertidas jogam o marcador em outro lugar do mundo.', 'The column with the longitude (e.g. -46.63). Values between -180 and 180. Swapped latitude and longitude put the marker elsewhere in the world.', 'La columna con la longitud (ej.: -46.63). Valores entre -180 y 180. Latitud y longitud invertidas ponen el marcador en otro lugar del mundo.'], { interactive: true }),
    ],
    form: ['O formulário para criar e editar um ponto. O Mapa não tem zona de lista: o que aparece vem da configuração acima.', 'The form to create and edit a point. The Map has no list zone: what shows comes from the configuration above.', 'El formulario para crear y editar un punto. El Mapa no tiene zona de lista: lo que aparece viene de la configuración de arriba.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar os marcadores do mapa antes de ver o resultado.', 'Optional: the fields users use to filter the map markers before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los marcadores del mapa antes de ver el resultado.'],
    ready: ['Faltam o título, a latitude ou a longitude.', 'The title, the latitude or the longitude is missing.', 'Faltan el título, la latitud o la longitud.'],
  },
  // ───────── BI
  {
    logic: 'analytics', card: 'wizard.logic_analytics', cat: 'wizard.logic_cat_outros', catName: ['Outros', 'Others', 'Otros'],
    name: ['Dashboard (BI)', 'Dashboard (BI)', 'Dashboard (BI)'],
    summary: ['Painel de indicadores, gráficos e KPIs com desempenho e acesso por linha, do assistente à publicação.', 'Dashboard of indicators, charts and KPIs with performance and row access, from the wizard to publishing.', 'Panel de indicadores, gráficos y KPIs con rendimiento y acceso por fila, del asistente a la publicación.'],
    about: ['O Dashboard (BI) é um painel de widgets: indicadores, gráficos e tabelas calculados sobre os seus dados, organizados em grupos.', 'The Dashboard (BI) is a panel of widgets: indicators, charts and tables calculated over your data, organized in groups.', 'El Dashboard (BI) es un panel de widgets: indicadores, gráficos y tablas calculados sobre sus datos, organizados en grupos.'],
    tables: ['Escolha a tabela base do painel. Os widgets podem usar também as tabelas relacionadas. Se você avançar sem escolher, o MetaBuilder seleciona a primeira tabela.', 'Pick the base table of the dashboard. Widgets can also use related tables. If you continue without picking, MetaBuilder selects the first table.', 'Elija la tabla base del panel. Los widgets pueden usar también las tablas relacionadas. Si avanza sin elegir, MetaBuilder selecciona la primera tabla.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_bi', ['O painel de BI', 'The BI panel', 'El panel de BI'], ['Aqui você monta o painel: widgets soltos ou em grupos recolhíveis. Arraste a alça de um widget para mudar a ordem ou levá-lo a outro grupo.', 'Here you build the panel: loose widgets or in collapsible groups. Drag a widget handle to change the order or move it to another group.', 'Aquí arma el panel: widgets sueltos o en grupos plegables. Arrastre el asa de un widget para cambiar el orden o llevarlo a otro grupo.']),
      st('runtime', 'wizard.bi_runtime', ['Edição em tempo de execução', 'Runtime editing', 'Edición en tiempo de ejecución'], ['ON deixa o usuário final reorganizar e ajustar os widgets no app publicado. OFF trava o painel como você desenhou. Você pode alternar para ver.', 'ON lets the end user rearrange and adjust widgets in the published app. OFF locks the panel as you designed it. You can toggle it to see.', 'ON deja al usuario final reorganizar y ajustar los widgets en la app publicada. OFF bloquea el panel como usted lo diseñó. Puede alternar para ver.']),
      st('access', 'wizard.bi_access', ['Desempenho e acesso por linha', 'Performance and row access', 'Rendimiento y acceso por fila'], ['Clique para abrir. Define o cache dos resultados, a atualização automática, o tempo limite das consultas e as regras de acesso por linha (cada usuário vê só os dados dele).', 'Click to open. It sets the results cache, auto refresh, query timeout and the row access rules (each user sees only their own data).', 'Haga clic para abrir. Define el caché de los resultados, la actualización automática, el tiempo límite de las consultas y las reglas de acceso por fila (cada usuario ve solo sus datos).']),
      st('widgets', 'wizard.bi_widgets', ['Os widgets', 'The widgets', 'Los widgets'], ['Cada cartão é um widget (indicador, gráfico, tabela). O lápis edita e a lixeira exclui. Widgets sem grupo ficam aqui; os agrupados ficam nos blocos abaixo.', 'Each card is a widget (indicator, chart, table). The pencil edits and the trash deletes. Ungrouped widgets stay here; grouped ones stay in the blocks below.', 'Cada tarjeta es un widget (indicador, gráfico, tabla). El lápiz edita y la papelera elimina. Los widgets sin grupo quedan aquí; los agrupados quedan en los bloques de abajo.']),
      st('add', 'wizard.bi_add_widget', ['Adicionar widget', 'Add a widget', 'Agregar widget'], ['Abre o editor de widget: tipo, tabela, campos, agregação e filtros. Pode abrir para conhecer e fechar sem salvar.', 'Opens the widget editor: type, table, fields, aggregation and filters. You can open it to take a look and close it without saving.', 'Abre el editor de widget: tipo, tabla, campos, agregación y filtros. Puede abrirlo para conocerlo y cerrarlo sin guardar.']),
      st('bi-group', 'wizard.cfg_bi', ['Grupos de widgets', 'Widget groups', 'Grupos de widgets'], ['A tela está livre. "Novo grupo" cria um bloco recolhível com título para reunir widgets do mesmo assunto (ex.: Vendas, Estoque). Crie quantos quiser, escreva o nome de cada grupo, use "+ Widget" ou arraste widgets para dentro dele. Quando terminar, clique em "Próximo" aqui no balão.', 'The screen is free. "New group" creates a collapsible titled block to gather widgets on the same subject (e.g. Sales, Stock). Create as many as you want, type each group name, use "+ Widget" or drag widgets into it. When you are done, click "Next" here in the balloon.', 'La pantalla está libre. "Nuevo grupo" crea un bloque plegable con título para reunir widgets del mismo tema (ej.: Ventas, Stock). Cree cuantos quiera, escriba el nombre de cada grupo, use "+ Widget" o arrastre widgets dentro. Al terminar, haga clic en "Siguiente" aquí en el globo.'], { skipIfMissing: true, freeInteraction: true }),
    ],
    filter: ['Opcional: os campos que o usuário usa para filtrar os dados do painel antes de ver o resultado.', 'Optional: the fields users use to filter the dashboard data before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los datos del panel antes de ver el resultado.'],
    grid: ['Opcional: os campos da lista de registros desta zona (em modo lista, card ou ambos). O painel não exige nada aqui para ser criado.', 'Optional: the fields of the record list in this zone (list, card or both). The dashboard needs nothing here to be created.', 'Opcional: los campos de la lista de registros de esta zona (lista, tarjeta o ambos). El panel no exige nada aquí para crearse.'],
    ready: ['O painel ainda não está pronto para avançar.', 'The panel is not ready to continue yet.', 'El panel aún no está listo para avanzar.'],
  },
  // ───────── Galeria
  {
    logic: 'galeria', card: 'wizard.logic_galeria', cat: 'wizard.logic_cat_outros', catName: ['Outros', 'Others', 'Otros'],
    name: ['Galeria / Assets', 'Gallery / Assets', 'Galería / Assets'],
    summary: ['Galeria de imagens, documentos e arquivos com visualização e download, do assistente à publicação.', 'Gallery of images, documents and files with preview and download, from the wizard to publishing.', 'Galería de imágenes, documentos y archivos con vista previa y descarga, del asistente a la publicación.'],
    about: ['A Galeria mostra os registros como cartões com a imagem ou o arquivo em destaque, com visualização ampliada e download.', 'The Gallery shows records as cards with the image or file highlighted, with enlarged preview and download.', 'La Galería muestra los registros como tarjetas con la imagen o el archivo destacado, con vista ampliada y descarga.'],
    tables: ['Escolha a tabela dos arquivos (ex.: Anexos, Fotos, Documentos). Ela precisa de um campo de imagem ou arquivo.', 'Pick the files table (e.g. Attachments, Photos, Documents). It needs an image or file field.', 'Elija la tabla de los archivos (ej.: Adjuntos, Fotos, Documentos). Necesita un campo de imagen o archivo.'],
    cfg: [
      st('cfg-intro', 'wizard.cfg_gallery', ['Configuração da Galeria', 'Gallery configuration', 'Configuración de la Galería'], ['Define como a imagem é vista ao clicar e quais campos aparecem no corpo de cada cartão.', 'Defines how the image is seen on click and which fields show in the body of each card.', 'Define cómo se ve la imagen al hacer clic y qué campos aparecen en el cuerpo de cada tarjeta.']),
      st('click', 'wizard.gallery_click', ['Visualização de imagem', 'Image view', 'Visualización de imagen'], ['Duas opções: abrir a imagem em uma janela (lightbox) ou exibir a imagem inteira, sem cortes, no próprio cartão. Você pode clicar para alternar.', 'Two options: open the image in a window (lightbox) or show the whole image, uncropped, in the card itself. You can click to switch.', 'Dos opciones: abrir la imagen en una ventana (lightbox) o mostrar la imagen entera, sin recortes, en la propia tarjeta. Puede hacer clic para alternar.']),
      st('fields', 'wizard.gallery_fields', ['Campos do cartão', 'Card fields', 'Campos de la tarjeta'], ['Escolha quais campos aparecem no corpo do cartão, além do título e do arquivo. É opcional: vazio usa só título e arquivo.', 'Choose which fields show in the card body, besides the title and the file. It is optional: empty uses only title and file.', 'Elija qué campos aparecen en el cuerpo de la tarjeta, además del título y el archivo. Es opcional: vacío usa solo título y archivo.']),
    ],
    grid: ['Os campos principais do cartão: inclua o campo da imagem ou do arquivo.', 'The main card fields: include the image or file field.', 'Los campos principales de la tarjeta: incluya el campo de la imagen o del archivo.'],
    form: ['O formulário para enviar e editar um item da galeria.', 'The form to upload and edit a gallery item.', 'El formulario para enviar y editar un ítem de la galería.'],
    filter: ['Opcional: os campos que o usuário usa para filtrar os itens da galeria antes de ver o resultado.', 'Optional: the fields users use to filter the gallery items before seeing the result.', 'Opcional: los campos que el usuario usa para filtrar los ítems de la galería antes de ver el resultado.'],
    ready: ['Faltam campos nas zonas da tela.', 'Fields are missing in the screen zones.', 'Faltan campos en las zonas de la pantalla.'],
  },
]

/** Personalizado: orquestra casos de uso em abas (não tem tabelas nem zonas de campos). */
function buildPersonalizado(base: PlatformTour): PlatformTour {
  // no Orquestrador a etapa de ações não tem a seção "Botões da interface": o passo dela é pulado em vez de travar o tour
  const tail = base.steps.slice(base.steps.findIndex(x => x.id === 'next3') + 1).map(x => (x.id === 'buttons' ? { ...x, skipIfMissing: true } : x))
  const byId = (id: string) => base.steps.find(x => x.id === id)!
  const s: Spec = SPECS[0]
  const pick = pickSteps({ ...s, logic: 'personalizado', card: 'wizard.logic_personalizado', cat: 'wizard.logic_cat_avancado', catName: ['Avançado e Híbrido', 'Advanced and Hybrid', 'Avanzado e Híbrido'], name: ['Personalizado (Orquestrador)', 'Custom (Orchestrator)', 'Personalizado (Orquestador)'], args: false, about: ['O Personalizado não cria dados novos: ele une casos de uso que você já tem em abas, subabas e quadros, em um painel único em volta de um caso de uso mestre.', 'Custom does not create new data: it joins use cases you already have in tabs, subtabs and panels, in a single panel around a master use case.', 'El Personalizado no crea datos nuevos: une casos de uso que usted ya tiene en pestañas, subpestañas y cuadros, en un panel único alrededor de un caso de uso maestro.'] })
  return {
    id: 'studio-logica-personalizado',
    route: STUDIO,
    onlyLogic: 'personalizado',
    freeClicks: true,
    title: h(['Criar: Personalizado (Orquestrador)', 'Create: Custom (Orchestrator)', 'Crear: Personalizado (Orquestador)']),
    summary: h(['Unir casos de uso existentes em abas, subabas e quadros em torno de um mestre, do assistente à publicação.', 'Join existing use cases in tabs, subtabs and panels around a master, from the wizard to publishing.', 'Unir casos de uso existentes en pestañas, subpestañas y cuadros alrededor de un maestro, del asistente a la publicación.']),
    recover: ['studio.tab_list', 'ai.back'],
    entry: [
      { rule: stage('4'), step: 'buttons' },
      { rule: stage('2'), step: 'pers-box' },
      { rule: stage('1'), step: 'name' },
    ],
    steps: [
      byId('open'),
      st('name', 'wizard.name', ['Nome e endereço', 'Name and address', 'Nombre y dirección'], [
        'O nome aparece no menu do app e o endereço (slug) vira o final da URL. Para treinar, use um nome como "Teste".',
        'The name shows in the app menu and the address (slug) becomes the end of the URL. To practice, use a name like "Test".',
        'El nombre aparece en el menú de la app y la dirección (slug) pasa a ser el final de la URL. Para practicar, use un nombre como "Prueba".',
      ], { interactive: true, completeWhen: { id: 'wizard.name_input', check: 'filled' }, waitingHint: h(['Digite o nome da tela para continuar.', 'Type the screen name to continue.', 'Escriba el nombre de la pantalla para continuar.']) }),
      ...pick,
      byId('next1'),
      st('pers-box', 'wizard.pers_master_box', ['O caso de uso mestre', 'The master use case', 'El caso de uso maestro'], [
        'Nesta lógica a etapa 2 se chama "Caso de Uso Mestre": em vez de uma tabela, você escolhe um caso de uso que já existe. Ele vira a primeira aba e dá a tabela de referência do painel. Não há etapa de Campos & Layout: o assistente pula direto para as Ações.',
        'In this logic step 2 is called "Master Use Case": instead of a table, you pick a use case that already exists. It becomes the first tab and gives the reference table of the panel. There is no Fields & Layout step: the wizard jumps straight to Actions.',
        'En esta lógica la etapa 2 se llama "Caso de Uso Maestro": en lugar de una tabla, elige un caso de uso que ya existe. Pasa a ser la primera pestaña y da la tabla de referencia del panel. No hay etapa de Campos y Diseño: el asistente salta directo a las Acciones.',
      ], { backClick: 'wizard.prev', readOnly: true }),
      st('pers-master', 'wizard.pers_master', ['Escolha o mestre', 'Pick the master', 'Elija el maestro'], [
        'Escolha na lista o caso de uso mestre. Só aparecem os que já foram criados no projeto: se a lista estiver vazia, crie antes um caso de uso comum.',
        'Pick the master use case from the list. Only those already created in the project show: if the list is empty, create a regular use case first.',
        'Elija en la lista el caso de uso maestro. Solo aparecen los ya creados en el proyecto: si la lista está vacía, cree antes un caso de uso común.',
      ], { interactive: true }),
      st('pers-depth', 'wizard.pers_depth', ['Profundidade máxima', 'Maximum depth', 'Profundidad máxima'], [
        'O sistema detecta sozinho as tabelas ligadas à tabela raiz (você não escolhe os JOINs) e libera os campos delas para as abas. Aqui você define até quantos níveis ele alcança. O padrão, 2 níveis, serve na maioria dos casos.',
        'The system detects on its own the tables linked to the root table (you do not pick the JOINs) and makes their fields available to the tabs. Here you set how many levels it reaches. The default, 2 levels, fits most cases.',
        'El sistema detecta solo las tablas vinculadas a la tabla raíz (usted no elige los JOIN) y habilita sus campos para las pestañas. Aquí define hasta cuántos niveles alcanza. El valor predeterminado, 2 niveles, sirve en la mayoría de los casos.',
      ], { interactive: true, skipIfMissing: true }),
      st('pers-tabs', 'wizard.pers_tabs', ['O layout em abas', 'The tab layout', 'El diseño en pestañas'], [
        'Aqui você monta as abas do registro. A primeira aba é a do mestre; as seguintes trazem outros casos de uso (detalhes, históricos, mapas, painéis...). Você pode arrastar as abas para reordenar. Vamos ver cada parte, de cima para baixo.',
        'Here you build the record tabs. The first tab is the master one; the following ones bring other use cases (details, histories, maps, dashboards...). You can drag tabs to reorder. We will go through each part, from top to bottom.',
        'Aquí arma las pestañas del registro. La primera pestaña es la del maestro; las siguientes traen otros casos de uso (detalles, historiales, mapas, paneles...). Puede arrastrar las pestañas para reordenar. Veremos cada parte, de arriba abajo.',
      ], { skipIfMissing: true, readOnly: true }),
      st('pers-slot', 'wizard.pers_slot', ['A aba do mestre', 'The master tab', 'La pestaña del maestro'], [
        'A primeira aba é a do mestre: ela mostra o caso de uso mestre e é o registro principal do painel. Cada aba tem ícone, título (o texto da aba) e o caso de uso que mostra; o tipo do widget vem do caso de uso escolhido. Esta aba não tem vínculo a configurar: são as outras abas que se ligam a ela.',
        'The first tab is the master one: it shows the master use case and is the main record of the panel. Each tab has an icon, a title (the tab text) and the use case it shows; the widget type comes from the chosen use case. This tab has no link to set up: the other tabs are the ones linked to it.',
        'La primera pestaña es la del maestro: muestra el caso de uso maestro y es el registro principal del panel. Cada pestaña tiene ícono, título (el texto de la pestaña) y el caso de uso que muestra; el tipo de widget viene del caso de uso elegido. Esta pestaña no tiene vínculo que configurar: las otras pestañas son las que se vinculan a ella.',
      ], { skipIfMissing: true }),
      st('pers-add-tab', 'wizard.pers_add_tab', ['Criar a primeira aba de detalhe', 'Create the first detail tab', 'Crear la primera pestaña de detalle'], [
        'Agora vamos criar uma aba de detalhe, ligada ao mestre. Clique em "Adicionar Aba". Nada é gravado até concluir o assistente.',
        'Now we will create a detail tab, linked to the master. Click "Add Tab". Nothing is saved until you finish the wizard.',
        'Ahora crearemos una pestaña de detalle, vinculada al maestro. Haga clic en "Agregar Pestaña". No se guarda nada hasta terminar el asistente.',
      ], { skipIfMissing: true, advanceOnClick: true }),
      st('pers-detail-uc', 'wizard.pers_detail_uc', ['O caso de uso da aba', 'The tab use case', 'El caso de uso de la pestaña'], [
        'Escolha o caso de uso desta aba (ex.: Pedidos, se o mestre for Clientes). Ele precisa ter alguma ligação com o caso de uso mestre: é essa ligação que vamos configurar nos próximos passos. Dá para repetir o mesmo caso de uso em abas diferentes, com filtros diferentes.',
        'Pick the use case of this tab (e.g. Orders, if the master is Customers). It must have some link to the master use case: that link is what we set up in the next steps. You can repeat the same use case on different tabs, with different filters.',
        'Elija el caso de uso de esta pestaña (ej.: Pedidos, si el maestro es Clientes). Debe tener alguna relación con el caso de uso maestro: esa relación es lo que configuraremos en los próximos pasos. Se puede repetir el mismo caso de uso en pestañas distintas, con filtros distintos.',
      ], { skipIfMissing: true, interactive: true, completeWhen: { id: 'wizard.pers_detail_uc', check: 'filled' }, waitingHint: h(['Escolha o caso de uso da aba para continuar.', 'Pick the tab use case to continue.', 'Elija el caso de uso de la pestaña para continuar.']) }),
      st('pers-expand', 'wizard.pers_expand', ['Abrir as opções da aba', 'Open the tab options', 'Abrir las opciones de la pestaña'], [
        'Clique na seta para expandir as opções desta aba. É lá que fica o vínculo com o mestre, que decide quais registros a aba mostra.',
        'Click the arrow to expand the options of this tab. That is where the link to the master lives, which decides which records the tab shows.',
        'Haga clic en la flecha para expandir las opciones de esta pestaña. Allí está el vínculo con el maestro, que decide qué registros muestra la pestaña.',
      ], { skipIfMissing: true, advanceOnClick: true }),
      st('pers-perms', 'wizard.pers_perms', ['Permissões e modo de exibição', 'Permissions and display mode', 'Permisos y modo de visualización'], [
        'Permissões de ação na aba (visualizar, novo, editar, excluir) e modo de exibição (aba, botão ou ambos). Valem só para esta aba.',
        'Action permissions on the tab (view, new, edit, delete) and display mode (tab, button or both). They apply only to this tab.',
        'Permisos de acción en la pestaña (ver, nuevo, editar, eliminar) y modo de visualización (pestaña, botón o ambos). Valen solo para esta pestaña.',
      ], { skipIfMissing: true, readOnly: true }),
      st('pers-link', 'wizard.pers_link_master', ['Vincular ao mestre', 'Link to the master', 'Vincular al maestro'], [
        'Vincular ao mestre: SIM faz a aba mostrar só os registros ligados ao registro do mestre que está aberto (ex.: só os pedidos do cliente que está sendo editado). NÃO mostra todos os registros do caso de uso, sem filtrar pelo mestre.',
        'Link to the master: YES makes the tab show only the records linked to the open master record (e.g. only the orders of the customer being edited). NO shows all records of the use case, without filtering by the master.',
        'Vincular al maestro: SÍ hace que la pestaña muestre solo los registros vinculados al registro del maestro abierto (ej.: solo los pedidos del cliente que se está editando). NO muestra todos los registros del caso de uso, sin filtrar por el maestro.',
      ], { skipIfMissing: true }),
      st('pers-relpath', 'wizard.pers_relpath', ['Caminho de relacionamentos', 'Relationship path', 'Camino de relaciones'], [
        'O caminho de relacionamentos diz como a tabela desta aba chega até a tabela do mestre. Cada linha é uma relação "De: tabela que tem a chave → Para: tabela apontada". Monte na ordem, começando pela tabela da aba e terminando na tabela do mestre. Com mestre Clientes: a aba Pedidos tem 1 relação (pedidos → clientes); a aba Entregas tem 2 (entregas → pedidos, pedidos → clientes). Se o caminho ficar vazio, o MetaBuilder só acha sozinho uma ligação DIRETA com o mestre; sem ela, a aba NÃO filtra e mostra todos os registros. Por isso, ao escolher o caso de uso da aba o Studio já preenche este caminho sozinho (a rota mais curta entre as tabelas) e avisa na aba quando ele falta ou não chega ao mestre: confira se é a ligação que você quer.',
        'The relationship path says how the table of this tab reaches the master table. Each line is a relation "From: table that holds the key → To: table it points to". Build it in order, starting at the tab table and ending at the master table. With master Customers: the Orders tab has 1 relation (orders → customers); the Deliveries tab has 2 (deliveries → orders, orders → customers). If the path is empty, MetaBuilder only finds a DIRECT link to the master on its own; without one, the tab does NOT filter and shows all records. That is why, when you pick the tab use case, Studio already fills this path in (the shortest route between the tables) and warns on the tab when it is missing or does not reach the master: check it is the link you want.',
        'El camino de relaciones dice cómo la tabla de esta pestaña llega hasta la tabla del maestro. Cada línea es una relación "De: tabla que tiene la clave → Para: tabla a la que apunta". Arme el camino en orden, empezando en la tabla de la pestaña y terminando en la tabla del maestro. Con maestro Clientes: la pestaña Pedidos tiene 1 relación (pedidos → clientes); la pestaña Entregas tiene 2 (entregas → pedidos, pedidos → clientes). Si el camino queda vacío, MetaBuilder solo encuentra solo una relación DIRECTA con el maestro; sin ella, la pestaña NO filtra y muestra todos los registros. Por eso, al elegir el caso de uso de la pestaña, el Studio ya completa este camino solo (la ruta más corta entre las tablas) y avisa en la pestaña cuando falta o no llega al maestro: revise que sea el vínculo que quiere.',
      ], { skipIfMissing: true }),
      st('pers-static', 'wizard.pers_static', ['Filtros estáticos', 'Static filters', 'Filtros estáticos'], [
        'Opcional: condições fixas que sempre valem nesta aba, além do vínculo com o mestre (ex.: status = Aberto).',
        'Optional: fixed conditions that always apply to this tab, besides the link to the master (e.g. status = Open).',
        'Opcional: condiciones fijas que siempre valen en esta pestaña, además del vínculo con el maestro (ej.: estado = Abierto).',
      ], { skipIfMissing: true, readOnly: true }),
      st('pers-screen-filters', 'wizard.pers_screen_filters', ['Filtros de tela', 'Screen filters', 'Filtros de pantalla'], [
        'Opcional: campos que aparecem como barras de pesquisa acima da lista da aba, para o usuário final filtrar.',
        'Optional: fields that show as search bars above the tab list, for the end user to filter.',
        'Opcional: campos que aparecen como barras de búsqueda encima de la lista de la pestaña, para que el usuario final filtre.',
      ], { skipIfMissing: true, readOnly: true }),
      st('pers-add', 'wizard.pers_add', ['Adicionar aba ou grupo', 'Add a tab or group', 'Agregar pestaña o grupo'], [
        '"Adicionar Aba" cria uma aba de primeiro nível. "Adicionar Grupo" cria uma aba que reúne vários casos de uso em blocos de Subabas (um por vez) ou de Quadros (vários visíveis ao mesmo tempo, com largura e altura). O grupo só habilita depois da aba do mestre. Neste passo os botões só são mostrados, para não criar abas sem querer; use-os depois, no passo livre.',
        '"Add Tab" creates a first-level tab. "Add Group" creates a tab that gathers several use cases in blocks of Subtabs (one at a time) or Panels (several visible at once, with width and height). The group only enables after the master tab. In this step the buttons are only shown, so you do not create tabs by accident; use them afterwards, in the free step.',
        '"Agregar Pestaña" crea una pestaña de primer nivel. "Agregar Grupo" crea una pestaña que reúne varios casos de uso en bloques de Subpestañas (uno a la vez) o de Cuadros (varios visibles a la vez, con ancho y alto). El grupo solo se habilita después de la pestaña del maestro. En este paso los botones solo se muestran, para no crear pestañas sin querer; úselos después, en el paso libre.',
      ], { skipIfMissing: true, readOnly: true }),
      st('pers-fill', 'wizard.pers_tabs', ['Agora é com você', 'Now it is your turn', 'Ahora es su turno'], [
        'Escolha o mestre e configure pelo menos uma aba. A tela está liberada nesta etapa. Em cada aba nova, confira o caminho de relacionamentos: sem ele (ou sem ligação direta com o mestre) a aba não filtra pelo registro aberto.',
        'Pick the master and set up at least one tab. The screen is free in this step. On each new tab, check the relationship path: without it (or without a direct link to the master) the tab does not filter by the open record.',
        'Elija el maestro y configure al menos una pestaña. La pantalla está liberada en esta etapa. En cada pestaña nueva, revise el camino de relaciones: sin él (o sin relación directa con el maestro) la pestaña no filtra por el registro abierto.',
      ], {
        freeInteraction: true,
        completeWhen: { id: 'wizard.next', check: 'attr', attr: 'data-help-state', equals: 'ready' },
        waitingHint: h(['Faltam o caso de uso mestre e pelo menos uma aba configurada.', 'The master use case and at least one configured tab are missing.', 'Faltan el caso de uso maestro y al menos una pestaña configurada.']),
      }),
      { ...byId('next3'), id: 'next-actions', body: h(['Clique em "Próximo passo": como não há campos para arrastar, o assistente vai direto para as Ações & Query.', 'Click "Next step": since there are no fields to drag, the wizard goes straight to Actions & Query.', 'Haga clic en "Siguiente paso": como no hay campos para arrastrar, el asistente va directo a las Acciones y Query.']) },
      ...tail,
    ],
  }
}

/** Monta os tours das lógicas a partir do tour "Criar um caso de uso" (que fornece o início e o fim comuns). */
export function buildLogicTours(base: PlatformTour): PlatformTour[] {
  return [...SPECS.map(s => build(base, s)), buildPersonalizado(base)]
}
