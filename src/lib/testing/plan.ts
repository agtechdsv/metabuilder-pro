import type { ManifestAuth, ManifestDetail, ManifestField, ManifestRowRule, ManifestView } from './manifestTypes'

/**
 * Plano de testes de um caso de uso: a lista do que será conferido, derivada do manifesto. É a ÚNICA fonte: o painel da IDE mostra este plano
 * antes de rodar e o teste do Playwright (e2e/dynamic) gera exatamente estes testes, com estes nomes. Sem dependências: o e2e também a importa.
 *
 * Todas as regras daqui só LEEM dados: nenhuma grava no banco (o cadastro com dados gerados entra depois, junto com o banco de teste do cliente).
 */
export type PlannedKind =
  | 'abre' | 'lista' | 'formulario' | 'mascara' | 'obrigatorios'
  | 'grid_total' | 'grid_ordenacao' | 'grid_filtro' | 'exportacao'
  | 'grid_paginacao' | 'filtro_opcoes' | 'visualizar' | 'exportacao_filtrada' | 'exportacao_marcadas' | 'central_downloads'
  | 'botoes' | 'acoes_linha' | 'campos_tipos' | 'abas'
  | 'crud_cadastro' | 'crud_reabrir' | 'crud_edicao' | 'crud_exclusao' | 'kanban_mover' | 'fluxo_conectar' | 'detalhe_adicionar'
  | 'seg_tabela' | 'seg_nivel_nenhum' | 'seg_nivel_leitura' | 'seg_linha'
  | 'compat_chrome' | 'compat_firefox' | 'compat_webkit'
  | 'carga_abertura' | 'carga_simultaneos'
  | 'visual_responsivo' | 'visual_acessibilidade'
  | 'acesso_abre' | 'acesso_usuarios_lista' | 'acesso_usuario_ciclo' | 'acesso_email_repetido' | 'acesso_grupo_ciclo' | 'acesso_permissoes_matriz' | 'acesso_permissao_ciclo' | 'acesso_so_admin'
  | 'filtros_tela' | 'tipo_galeria' | 'tipo_kanban' | 'tipo_fluxo' | 'tipo_timeline' | 'tipo_gantt' | 'tipo_agenda' | 'tipo_mapa_mental' | 'tipo_mapa' | 'tipo_bi'

export interface PlannedTest {
  kind: PlannedKind
  /** nome do teste (é o nome que o Playwright reporta: o painel casa o resultado por ele) */
  title: string
  /** coluna, quando o teste é de um campo (máscara, ordenação, filtro) */
  field?: string
  /** formato, quando é de exportação (csv, json, xlsx) */
  format?: string
  /** rótulo do campo e máscara (entram no texto traduzido do teste) */
  label?: string
  mask?: string
}

export type PlanLang = 'pt' | 'en' | 'es'

/** Tipos de teste: funcional só LÊ dados; integração GRAVA (cadastro, edição e exclusão com dados gerados) e exige um banco de teste. */
export type TestType = 'funcional' | 'integracao' | 'seguranca' | 'compat' | 'carga' | 'visual'

/** Tamanhos de tela do tipo Responsividade e acessibilidade: celular, tablet e computador. */
export const TELAS_VISUAL = [
  { nome: 'celular', width: 375, height: 812 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'computador', width: 1280, height: 800 },
] as const

/** Limites do tipo Desempenho e carga (valem para o app local de teste, não para produção). */
export const LIMITES_CARGA = { aberturaMs: 5000, simultaneos: 20, p95Ms: 10000 } as const

/** Navegadores do tipo Compatibilidade: o Chrome já vem com a IDE; Firefox e WebKit (o motor do Safari) são baixados pelo Playwright, só com a permissão do usuário. */
export const NAVEGADORES_COMPAT = [
  { kind: 'compat_chrome', nome: 'Chrome', motor: 'chromium' },
  { kind: 'compat_firefox', nome: 'Firefox', motor: 'firefox' },
  { kind: 'compat_webkit', nome: 'Safari (WebKit)', motor: 'webkit' },
] as const
export interface PlanOptions {
  types?: TestType[]
  /** configuração de login do projeto (manifest.auth): os testes de segurança por grupo e por linha dependem dela */
  auth?: ManifestAuth
}

/**
 * Texto do teste no idioma da tela. O `title` (português) é o NOME do teste para o Playwright e a chave dos resultados e do histórico: não muda
 * com o idioma. Só o que aparece na tela (painel, relatório, comparativo) passa por aqui.
 */
const PLAN_TEXT: Record<Exclude<PlanLang, 'pt'>, Record<string, (p: PlannedTest) => string>> = {
  en: {
    abre: () => 'the screen opens without errors and shows the use case title',
    lista: () => 'list: the use case filters and columns are on the screen',
    formulario: () => 'new form: the fields exist, with required and read-only as configured',
    mascara: p => `mask of "${p.label}" (${p.mask}) formats what is typed`,
    obrigatorios: () => 'required fields: saving the empty form does not create a record',
    grid_total: () => 'grid: the total shown equals the database total',
    grid_ordenacao: p => `grid: sort by "${p.label}" in both directions`,
    grid_filtro: p => `filter by "${p.label}": filters the rows and the Clear button undoes it`,
    acesso_abre: () => 'access management: the Users, Groups and Screen Permissions screens open for the Administrator',
    acesso_usuarios_lista: () => 'users: the list shows each user with the group that is in the database',
    acesso_usuario_ciclo: () => 'users: create with group, sign in, change group, reset password and delete (without touching other users)',
    acesso_email_repetido: () => 'users: a repeated e-mail shows the error in the window and creates nothing',
    acesso_grupo_ciclo: () => 'groups: create, rename and delete a group',
    acesso_permissoes_matriz: () => 'permissions: the matrix shows each group and each screen',
    acesso_permissao_ciclo: () => 'permissions: changing a group level is saved and can be undone',
    acesso_so_admin: () => 'access management screens are only for the Administrator (a user without admin rights does not get in)',
    seg_tabela: () => 'table permissions: New Record, Edit and Delete appear only as Studio allows',
    seg_nivel_nenhum: () => 'group access "none": the screen disappears from the menu and does not open by address',
    seg_nivel_leitura: () => 'group access "read": opens and shows the data, but does not allow creating, editing or deleting',
    seg_linha: () => 'row rule: whoever is not in the exception only sees the rows the rule allows',
    visual_responsivo: () => 'responsive: on phone, tablet and desktop sizes the screen shows no horizontal page scroll and keeps its content visible',
    visual_acessibilidade: () => 'accessibility: page language and title, one main heading, images with alternative text, and buttons, links and fields with a name for screen readers',
    carga_abertura: () => 'performance: the screen loads within the time limit (median of 3 loads)',
    carga_simultaneos: () => 'load: 20 simultaneous accesses to the screen, all answered without error and within the time limit',
    compat_chrome: () => 'Chrome: the screen opens, lists the same total as the database and shows the new form',
    compat_firefox: () => 'Firefox: the screen opens, lists the same total as the database and shows the new form',
    compat_webkit: () => 'Safari (WebKit): the screen opens, lists the same total as the database and shows the new form',
    crud_cadastro: () => 'registration: filling in generated data and saving writes everything to the database',
    crud_reabrir: () => 'registration: reopening the record shows what was saved',
    crud_edicao: () => 'edit: changing and saving writes only the change',
    detalhe_adicionar: () => 'tabs: adding a row in each detail tab and saving writes it with the parent key, and deleting the parent takes the rows with it',
    fluxo_conectar: () => 'flow: dragging a step only moves it; linking two steps saves the previous step in the database; a link that would make a loop is refused (and the steps go back afterwards)',
    kanban_mover: () => 'kanban: dragging a card to another column saves the new column in the database (and the card goes back afterwards)',
    crud_exclusao: () => 'deletion: deleting from the list removes the record',
    grid_paginacao: () => 'grid: pagination respects the chosen page size',
    filtro_opcoes: p => `filter by "${p.label}" option: only the rows of the option appear and Clear undoes it`,
    visualizar: () => 'View: opens the record read-only, without a save button',
    exportacao_filtrada: () => 'export: only what is filtered on the screen',
    exportacao_marcadas: () => 'export: only the checked rows',
    central_downloads: () => 'Downloads Center: lists the export and downloads the file',
    botoes: () => 'buttons: the buttons configured in Studio are on the screen',
    acoes_linha: () => 'row actions: each custom action opens the other screen in a window, filtered by the row',
    campos_tipos: () => 'form: each field uses the configured component (text, number, date, options)',
    abas: () => 'tabs: the detail tabs configured in Studio are in the form',
    filtros_tela: () => 'filters: all the use case filters are on the screen',
    tipo_galeria: () => 'gallery: one card per record, equal to the database',
    tipo_kanban: () => 'kanban: the cards (plus those still to load) add up to the database total',
    tipo_fluxo: () => 'flow: the diagram opens and the number of steps equals the database',
    tipo_timeline: () => 'timeline: the screen opens with data refresh and no error',
    tipo_gantt: () => 'gantt: Today button, sizes and row actions',
    tipo_agenda: () => 'calendar: month, week and day show different views',
    tipo_mapa_mental: () => 'mind map: the number of records equals the database',
    tipo_mapa: () => 'map: the map opens and the total with coordinates equals the database',
    tipo_bi: () => 'BI: the dashboard opens, refreshes and shows data',
    exportacao: p => `${FORMATOS_EXPORTACAO[p.format || ''] || p.format} export: ${({ csv: 'header with the grid columns and one line per record', json: 'one item per record', xlsx: 'valid .xlsx file' } as Record<string, string>)[p.format || ''] || ''}`,
  },
  es: {
    abre: () => 'la pantalla abre sin errores y muestra el título del caso de uso',
    lista: () => 'lista: los filtros y las columnas del caso de uso están en la pantalla',
    formulario: () => 'formulario nuevo: los campos existen, con obligatorio y solo lectura como configurado',
    mascara: p => `la máscara de "${p.label}" (${p.mask}) formatea lo que se escribe`,
    obrigatorios: () => 'obligatorios: guardar el formulario vacío no crea registro',
    grid_total: () => 'grid: el total mostrado es igual al total de la base de datos',
    grid_ordenacao: p => `grid: ordenar por "${p.label}" en ambos sentidos`,
    grid_filtro: p => `filtro de "${p.label}": filtra las filas y el botón Limpiar lo deshace`,
    acesso_abre: () => 'gestión de acceso: las pantallas Usuarios, Grupos y Permisos de pantallas abren para el Administrador',
    acesso_usuarios_lista: () => 'usuarios: la lista muestra cada usuario con el grupo que está en la base de datos',
    acesso_usuario_ciclo: () => 'usuarios: crear con grupo, entrar, cambiar de grupo, restablecer la contraseña y eliminar (sin tocar a otros usuarios)',
    acesso_email_repetido: () => 'usuarios: un correo repetido muestra el error en la ventana y no crea nada',
    acesso_grupo_ciclo: () => 'grupos: crear, renombrar y eliminar un grupo',
    acesso_permissoes_matriz: () => 'permisos: la matriz muestra cada grupo y cada pantalla',
    acesso_permissao_ciclo: () => 'permisos: cambiar el nivel de un grupo se guarda y se puede deshacer',
    acesso_so_admin: () => 'las pantallas de gestión de acceso son solo del Administrador (un usuario sin permisos de administrador no entra)',
    seg_tabela: () => 'permisos de la tabla: Nuevo Registro, Editar y Eliminar aparecen solo como Studio lo permite',
    seg_nivel_nenhum: () => 'acceso "ninguno" al grupo: la pantalla desaparece del menú y no abre por la dirección',
    seg_nivel_leitura: () => 'acceso "lectura" al grupo: abre y muestra los datos, pero no permite crear, editar ni eliminar',
    seg_linha: () => 'regla por fila: quien no está en la excepción solo ve las filas que la regla permite',
    visual_responsivo: () => 'responsivo: en celular, tableta y computadora la pantalla no tiene desplazamiento horizontal de la página y mantiene su contenido visible',
    visual_acessibilidade: () => 'accesibilidad: idioma y título de la página, un encabezado principal, imágenes con texto alternativo, y botones, enlaces y campos con nombre para lectores de pantalla',
    carga_abertura: () => 'rendimiento: la pantalla carga dentro del límite de tiempo (mediana de 3 cargas)',
    carga_simultaneos: () => 'carga: 20 accesos simultáneos a la pantalla, todos respondidos sin error y dentro del límite de tiempo',
    compat_chrome: () => 'Chrome: la pantalla abre, lista el mismo total de la base y muestra el formulario nuevo',
    compat_firefox: () => 'Firefox: la pantalla abre, lista el mismo total de la base y muestra el formulario nuevo',
    compat_webkit: () => 'Safari (WebKit): la pantalla abre, lista el mismo total de la base y muestra el formulario nuevo',
    crud_cadastro: () => 'registro: llenar con datos generados y guardar graba todo en la base de datos',
    crud_reabrir: () => 'registro: reabrir el registro muestra lo que se guardó',
    crud_edicao: () => 'edición: cambiar y guardar graba solo el cambio',
    detalhe_adicionar: () => 'pestañas: agregar una fila en cada pestaña de detalle y guardar la graba con la clave del padre, y eliminar el padre se lleva las filas',
    fluxo_conectar: () => 'flujo: arrastrar una etapa solo la mueve; unir dos etapas guarda la etapa anterior en la base de datos; una unión que cree un ciclo se rechaza (y las etapas vuelven después)',
    kanban_mover: () => 'kanban: arrastrar una tarjeta a otra columna guarda la nueva columna en la base de datos (y la tarjeta vuelve después)',
    crud_exclusao: () => 'eliminación: eliminar desde la lista quita el registro',
    grid_paginacao: () => 'grid: la paginación respeta el tamaño de página elegido',
    filtro_opcoes: p => `filtro de "${p.label}" por opción: solo aparecen las filas de la opción y Limpiar lo deshace`,
    visualizar: () => 'Visualizar: abre el registro solo lectura, sin botón de guardar',
    exportacao_filtrada: () => 'exportación: solo lo que está filtrado en la pantalla',
    exportacao_marcadas: () => 'exportación: solo las filas marcadas',
    central_downloads: () => 'Centro de descargas: lista la exportación y descarga el archivo',
    botoes: () => 'botones: los botones configurados en Studio están en la pantalla',
    acoes_linha: () => 'acciones de fila: cada acción personalizada abre la otra pantalla en una ventana, filtrada por la fila',
    campos_tipos: () => 'formulario: cada campo usa el componente configurado (texto, número, fecha, opciones)',
    abas: () => 'pestañas: las pestañas de detalle configuradas en Studio están en el formulario',
    filtros_tela: () => 'filtros: todos los filtros del caso de uso están en la pantalla',
    tipo_galeria: () => 'galería: una tarjeta por registro, igual a la base de datos',
    tipo_kanban: () => 'kanban: las tarjetas (más las que faltan cargar) suman el total de la base de datos',
    tipo_fluxo: () => 'flujo: el diagrama abre y el número de etapas es igual a la base de datos',
    tipo_timeline: () => 'línea de tiempo: la pantalla abre con actualización de datos y sin error',
    tipo_gantt: () => 'gantt: botón Hoy, tamaños y acciones de las filas',
    tipo_agenda: () => 'agenda: mes, semana y día muestran vistas distintas',
    tipo_mapa_mental: () => 'mapa mental: el número de registros es igual a la base de datos',
    tipo_mapa: () => 'mapa: el mapa abre y el total con coordenadas es igual a la base de datos',
    tipo_bi: () => 'BI: el panel abre, se actualiza y muestra datos',
    exportacao: p => `exportación ${FORMATOS_EXPORTACAO[p.format || ''] || p.format}: ${({ csv: 'encabezado con las columnas del grid y una línea por registro', json: 'un elemento por registro', xlsx: 'archivo .xlsx válido' } as Record<string, string>)[p.format || ''] || ''}`,
  },
}

/** Texto do teste para mostrar na tela, no idioma pedido (português = o próprio título). */
export const planTitle = (p: PlannedTest, lang: PlanLang): string => (lang === 'pt' ? p.title : PLAN_TEXT[lang]?.[p.kind]?.(p) ?? p.title)

/** Gabarito de cada tipo de tela especial (além de "a tela abre" e dos filtros): o tipo de tela → a regra que o confere. */
export const TIPO_TELA: Record<string, PlannedKind> = {
  galeria: 'tipo_galeria', kanban: 'tipo_kanban', blueprint: 'tipo_fluxo', timeline: 'tipo_timeline', gantt: 'tipo_gantt',
  scheduler: 'tipo_agenda', mapa_mental: 'tipo_mapa_mental', map: 'tipo_mapa', analytics: 'tipo_bi',
}
/** Tipos de tela com gabarito (lista, formulário, grid, exportação, ou a regra própria do tipo). Os demais (telas de IA) têm só "a tela abre". */
export const SUPPORTED_LOGIC_TYPES = ['pesquisa_cadastro', 'gestao_acesso', ...Object.keys(TIPO_TELA)]
export const isSupportedView = (v: Pick<ManifestView, 'logicType'>): boolean => SUPPORTED_LOGIC_TYPES.includes(v.logicType)

/** Nome do grupo de testes de um caso de uso (o "describe" do Playwright). */
export const describeName = (v: Pick<ManifestView, 'title' | 'slug' | 'logicType'>): string => `${v.title} (${v.slug}) · ${v.logicType}`

/** Só máscaras de padrão fixo (0 = dígito; . - / ( ) e espaço literais). Máscaras numéricas (0.000,00) têm outra regra e não entram aqui. */
export const mascaraDePadrao = (m?: string): boolean => !!m && /^[0.\-/() ]+$/.test(m) && /0{2}/.test(m) && !/^0\.0+,0+$/.test(m)

/** "00.000.000/0000-00" + dígitos → "11.111.111/1111-11" (cada 0 consome um dígito; o resto é literal). */
export function aplicarMascara(digitos: string, mascara: string): string {
  let out = ''
  let i = 0
  for (const ch of mascara) {
    if (i >= digitos.length) break
    if (ch === '0') out += digitos[i++]
    else out += ch
  }
  return out
}

export const camposEditaveis = (v: Pick<ManifestView, 'form'>): ManifestField[] => v.form.filter(f => !f.isPrimaryKey)

/** Campo de texto livre (serve para ordenar e filtrar por texto): não é lista de opções, nem fórmula, nem chave. */
export const ehTexto = (f: ManifestField): boolean =>
  /char|text|string/i.test(f.dataType) && !f.options?.length && !f.hasFormula && !f.isPrimaryKey && !/select|sele[cç][aã]o|autocomplete/i.test(f.componentType || '')

/** Campo de data/hora: o app usa o seletor nativo de data e a máscara de texto não se aplica (o tipo do componente no Studio manda sobre a máscara). */
export const ehData = (f: ManifestField): boolean => /date|time/i.test(f.dataType) || /data|date|hora/i.test(f.componentType || '')

export const FORMATOS_EXPORTACAO: Record<string, string> = { csv: 'CSV', json: 'JSON', xlsx: 'Excel' }

/** A tela e os campos usados em cada regra de grid (a mesma escolha vale para o plano e para o teste). */
export const campoDeOrdenacao = (v: Pick<ManifestView, 'grid'>): ManifestField | undefined => v.grid.find(ehTexto)
/** O filtro precisa estar também no grid: é pelas células do grid que o teste confere que as linhas casam com o filtro. */
export const campoDeFiltro = (v: Pick<ManifestView, 'filter' | 'grid'>): ManifestField | undefined =>
  v.filter.find(f => ehTexto(f) && v.grid.some(g => g.column === f.column))

/** Filtro por lista de opções (select) que também está no grid: dá para conferir as linhas pela célula. */
export const campoDeFiltroOpcoes = (v: Pick<ManifestView, 'filter' | 'grid'>): ManifestField | undefined =>
  v.filter.find(f => f.options?.length && v.grid.some(g => g.column === f.column))

/** Campos do formulário que o teste de tipos confere (têm nome no HTML: ficam de fora os calculados por fórmula). */
export const camposDeTipo = (v: Pick<ManifestView, 'form'>): ManifestField[] => v.form.filter(f => !f.isPrimaryKey && !f.hasFormula && f.dataType !== 'virtual')

const TITULO_TIPO: Record<string, string> = {
  tipo_galeria: 'galeria: um cartão por registro, igual ao banco',
  tipo_kanban: 'kanban: os cartões (mais os que faltam carregar) somam o total do banco',
  tipo_fluxo: 'fluxo: o diagrama abre e o total de etapas é igual ao banco',
  tipo_timeline: 'timeline: a tela abre com atualização de dados e sem erro',
  tipo_gantt: 'gantt: botão Hoje, tamanhos e ações das linhas',
  tipo_agenda: 'agenda: mês, semana e dia mostram visões diferentes',
  tipo_mapa_mental: 'mapa mental: o total de registros é igual ao banco',
  tipo_mapa: 'mapa: o mapa abre e o total com coordenadas é igual ao banco',
  tipo_bi: 'BI: o painel abre, atualiza e mostra dados',
}

/**
 * Campo de texto que identifica o registro criado pelo teste de integração: o primeiro campo de texto livre, editável e sem máscara de padrão.
 * É nele que o motor grava o prefixo "E2E-" (a limpeza de sobras só apaga linhas assim) e é por ele que acha a linha no banco.
 */
export const campoMarcador = (v: Pick<ManifestView, 'form'>): ManifestField | undefined =>
  v.form.find(f => !f.isPrimaryKey && !f.readOnly && !f.hasFormula && ehTexto(f) && !mascaraDePadrao(f.mask))

/** Prefixo dos dados gerados pelo teste de integração. */
export const PREFIXO_E2E = 'E2E-'

/**
 * Regra por linha que o motor sabe conferir: compara uma coluna com um valor que o motor controla no usuário temporário (id, e-mail, nome ou uma coluna dele).
 * Vale também para "related" (a coluna aponta para uma linha de outra tabela cuja coluna é igual ao valor do usuário). A lista de valores ("in") fica de fora.
 */
export const regraDeLinha = (v: Pick<ManifestView, 'rowPolicy'>): ManifestRowRule | undefined =>
  v.rowPolicy?.find(r => (r.op === 'eq' || (r.op === 'related' && !!r.related)) && (r.source !== 'user.attr' || !!r.attr))

/** Gestão de acesso (Usuários, Grupos, Permissões de Telas): só quando o app a tem (o projeto liga a opção) e o login é pelo banco. */
function planoAcesso(auth?: ManifestAuth): PlannedTest[] {
  if (auth?.type !== 'database' || !auth.access) return []
  return [
    { kind: 'acesso_abre', title: 'gestão de acesso: as telas Usuários, Grupos e Permissões de Telas abrem para o Administrador' },
    { kind: 'acesso_usuarios_lista', title: 'usuários: a lista mostra cada usuário com o grupo que está no banco' },
    { kind: 'acesso_usuario_ciclo', title: 'usuários: criar com grupo, entrar, trocar de grupo, redefinir a senha e excluir (sem mexer nos outros)' },
    { kind: 'acesso_email_repetido', title: 'usuários: e-mail repetido mostra o erro na janela e nada é criado' },
    { kind: 'acesso_grupo_ciclo', title: 'grupos: criar, renomear e excluir um grupo' },
    { kind: 'acesso_permissoes_matriz', title: 'permissões: a matriz mostra cada grupo e cada tela' },
    { kind: 'acesso_permissao_ciclo', title: 'permissões: mudar o nível de um grupo grava e pode ser desfeito' },
    { kind: 'acesso_so_admin', title: 'as telas de gestão de acesso são só do Administrador (quem não é admin não entra)' },
  ]
}

/** Testes de segurança derivados da configuração do projeto (criam usuários e grupos temporários no banco de teste e os apagam no fim). */
function planoSeguranca(v: ManifestView, auth?: ManifestAuth): PlannedTest[] {
  if (v.logicType === 'gestao_acesso') return planoAcesso(auth)
  if (v.logicType !== 'pesquisa_cadastro') return []
  const out: PlannedTest[] = [{ kind: 'seg_tabela', title: 'permissões da tabela: Novo Registro, Editar e Excluir aparecem só como o Studio permite' }]
  if (auth?.type === 'database') {
    if (auth.access) {
      out.push({ kind: 'seg_nivel_nenhum', title: 'acesso "nenhum" ao grupo: a tela some do menu e não abre pelo endereço' })
      out.push({ kind: 'seg_nivel_leitura', title: 'acesso "leitura" ao grupo: abre e mostra os dados, mas não deixa criar, editar nem excluir' })
    }
    if (regraDeLinha(v)) out.push({ kind: 'seg_linha', title: 'regra por linha: quem não é da exceção só vê as linhas que a regra permite' })
  }
  return out
}

/** Abas de detalhe em que o teste consegue adicionar uma linha: têm pelo menos um campo editável além da chave do pai, da chave primária e dos campos calculados. */
export const detalhesPreenchiveis = (v: Pick<ManifestView, 'details'>): ManifestDetail[] =>
  (v.details || []).filter(d => d.fields.some(f => !f.readOnly && !f.hasFormula && !f.isPrimaryKey && f.column.toLowerCase() !== d.foreignKey.toLowerCase()))

/** Testes de integração (gravam no banco de teste): cadastro, reabrir, edição e exclusão com dados gerados. Só para Pesquisa + Cadastro com pelo menos um campo editável. */
function planoIntegracao(v: ManifestView): PlannedTest[] {
  if (v.logicType === 'blueprint') return v.blueprintPredecessorColumn ? [{ kind: 'fluxo_conectar', title: 'fluxo: arrastar uma etapa só a move; ligar duas etapas grava a etapa anterior no banco; ligação que formaria um ciclo é recusada (e as etapas voltam depois)' }] : []
  if (v.logicType === 'kanban') return v.kanbanGroupColumn ? [{ kind: 'kanban_mover', title: 'kanban: arrastar um cartão para outra coluna grava a nova coluna no banco (e o cartão volta depois)' }] : []
  // com campo de texto, o registro é marcado com E2E-; sem ele (só listas, datas, números...), o motor o identifica pelo id novo e o anota num diário para limpar
  if (v.logicType !== 'pesquisa_cadastro' || camposDeTipo(v).every(f => f.readOnly)) return []
  return [
    { kind: 'crud_cadastro', title: 'cadastro: preencher com dados gerados e salvar grava tudo no banco' },
    { kind: 'crud_reabrir', title: 'cadastro: reabrir o registro mostra o que foi gravado' },
    { kind: 'crud_edicao', title: 'edição: alterar e salvar grava só a alteração' },
    ...(detalhesPreenchiveis(v).length > 0 ? [{ kind: 'detalhe_adicionar' as const, title: 'abas: adicionar uma linha em cada aba de detalhe e salvar grava com a chave do pai; excluir o pai leva as linhas junto' }] : []),
    { kind: 'crud_exclusao', title: 'exclusão: excluir pela lista remove o registro' },
  ]
}

export function planView(v: ManifestView, opts: PlanOptions = {}): PlannedTest[] {
  const types = opts.types ?? ['funcional']
  return [
    ...(types.includes('funcional') ? planoFuncional(v) : []),
    ...(types.includes('integracao') ? planoIntegracao(v) : []),
    ...(types.includes('seguranca') ? planoSeguranca(v, opts.auth) : []),
    ...(types.includes('compat') ? planoCompat(v) : []),
    ...(types.includes('carga') ? planoCarga(v) : []),
    ...(types.includes('visual') ? planoVisual(v) : []),
  ]
}

/** Responsividade e acessibilidade: a tela em três tamanhos e a leitura dela por tecnologia assistiva. Só lê dados. */
function planoVisual(v: ManifestView): PlannedTest[] {
  if (v.logicType === 'gestao_acesso') return []
  return [
    { kind: 'visual_responsivo', title: `responsividade: celular, tablet e computador sem rolagem horizontal da página e com o conteúdo visível` },
    { kind: 'visual_acessibilidade', title: 'acessibilidade: idioma e título da página, um título principal, imagens com texto alternativo e botões, links e campos com nome para leitor de tela' },
  ]
}

/** Desempenho e carga: tempo de abertura da tela e vários acessos ao mesmo tempo. Só lê dados. */
function planoCarga(v: ManifestView): PlannedTest[] {
  if (v.logicType === 'gestao_acesso') return []
  return [
    { kind: 'carga_abertura', title: `desempenho: a tela abre em até ${LIMITES_CARGA.aberturaMs / 1000} s (mediana de 3 aberturas)` },
    { kind: 'carga_simultaneos', title: `carga: ${LIMITES_CARGA.simultaneos} acessos simultâneos à tela, todos respondidos sem erro em até ${LIMITES_CARGA.p95Ms / 1000} s` },
  ]
}

/** Compatibilidade: a mesma verificação enxuta (abre, total da lista e formulário novo) em cada navegador. Só lê dados. */
function planoCompat(v: ManifestView): PlannedTest[] {
  if (v.logicType === 'gestao_acesso') return []
  return NAVEGADORES_COMPAT.map(n => ({ kind: n.kind, title: `compatibilidade (${n.nome}): a tela abre sem erro${v.logicType === 'pesquisa_cadastro' && isSupportedView(v) ? ', lista o total do banco e mostra o formulário novo' : ' e mostra o título'}` }))
}

function planoFuncional(v: ManifestView): PlannedTest[] {
  if (v.logicType === 'gestao_acesso') return [] // a gestão de acesso só tem testes no tipo segurança
  const plano: PlannedTest[] = [{ kind: 'abre', title: 'a tela abre sem erro e mostra o título do caso de uso' }]
  if (!isSupportedView(v)) return plano

  // telas especiais: o gabarito do tipo + os filtros configurados
  const tipo = TIPO_TELA[v.logicType]
  if (tipo) {
    plano.push({ kind: tipo, title: TITULO_TIPO[tipo] })
    if (v.filter.length > 0) plano.push({ kind: 'filtros_tela', title: 'filtros: todos os filtros do caso de uso estão na tela' })
    return plano
  }

  const editaveis = camposEditaveis(v)
  plano.push(
    { kind: 'lista', title: 'lista: os filtros e as colunas do caso de uso estão na tela' },
    { kind: 'formulario', title: 'formulário novo: os campos existem, com obrigatório e somente leitura como configurado' },
  )
  for (const f of editaveis.filter(x => mascaraDePadrao(x.mask) && !ehData(x))) plano.push({ kind: 'mascara', field: f.column, label: f.label, mask: f.mask, title: `máscara de "${f.label}" (${f.mask}) formata o que se digita` })
  if (editaveis.some(f => f.required)) plano.push({ kind: 'obrigatorios', title: 'obrigatórios: salvar o formulário vazio não cria registro' })

  plano.push({ kind: 'grid_total', title: 'grid: o total mostrado é igual ao total do banco' })
  const ord = campoDeOrdenacao(v)
  if (ord) plano.push({ kind: 'grid_ordenacao', field: ord.column, label: ord.label, title: `grid: ordenar por "${ord.label}" nos dois sentidos` })
  const fil = campoDeFiltro(v)
  if (fil) plano.push({ kind: 'grid_filtro', field: fil.column, label: fil.label, title: `filtro de "${fil.label}": filtra as linhas e o botão Limpar desfaz` })

  const descr: Record<string, string> = {
    csv: 'cabeçalho com as colunas do grid e uma linha por registro',
    json: 'um item por registro',
    xlsx: 'arquivo .xlsx válido',
  }
  for (const fmt of v.exportFormats.map(x => x.toLowerCase()).filter(x => FORMATOS_EXPORTACAO[x])) {
    plano.push({ kind: 'exportacao', format: fmt, title: `exportação ${FORMATOS_EXPORTACAO[fmt]}: ${descr[fmt]}` })
  }

  // fase 3 (só leitura): paginação, filtro por opção, Visualizar, exportação filtrada/marcada, Central de Downloads, botões, tipos de campo e abas
  plano.push({ kind: 'grid_paginacao', title: 'grid: a paginação respeita o tamanho de página escolhido' })
  const opc = campoDeFiltroOpcoes(v)
  if (opc) plano.push({ kind: 'filtro_opcoes', field: opc.column, label: opc.label, title: `filtro de "${opc.label}" por opção: só traz as linhas da opção e o botão Limpar desfaz` })
  plano.push({ kind: 'visualizar', title: 'Visualizar: abre o registro só para leitura, sem botão de gravar' })
  if (v.exportFormats.some(x => ['csv', 'json'].includes(x.toLowerCase()))) {
    if (fil) plano.push({ kind: 'exportacao_filtrada', title: 'exportação: só o que está filtrado na tela' })
    plano.push({ kind: 'exportacao_marcadas', title: 'exportação: só as linhas marcadas' })
    if (v.exportFormats.some(x => x.toLowerCase() === 'csv')) plano.push({ kind: 'central_downloads', title: 'Central de Downloads: lista a exportação e baixa o arquivo' })
  }
  if (v.buttons.length > 0) plano.push({ kind: 'botoes', title: 'botões: os botões configurados no Studio estão na tela' })
  if (v.logicType === 'pesquisa_cadastro' && v.buttons.some(b => b.actionType === 'custom' && b.placement === 'row')) plano.push({ kind: 'acoes_linha', title: 'ações da linha: cada ação customizada abre a outra tela em janela, filtrada pelo registro' })
  if (camposDeTipo(v).length > 0) plano.push({ kind: 'campos_tipos', title: 'formulário: cada campo usa o componente configurado (texto, número, data, opções)' })
  if (v.details.length > 0) plano.push({ kind: 'abas', title: 'abas: as abas de detalhe configuradas no Studio estão no formulário' })
  return plano
}
