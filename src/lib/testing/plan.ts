import type { ManifestField, ManifestView } from './manifestTypes'

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
  | 'botoes' | 'campos_tipos' | 'abas'
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
    grid_paginacao: () => 'grid: pagination respects the chosen page size',
    filtro_opcoes: p => `filter by "${p.label}" option: only the rows of the option appear and Clear undoes it`,
    visualizar: () => 'View: opens the record read-only, without a save button',
    exportacao_filtrada: () => 'export: only what is filtered on the screen',
    exportacao_marcadas: () => 'export: only the checked rows',
    central_downloads: () => 'Downloads Center: lists the export and downloads the file',
    botoes: () => 'buttons: the buttons configured in Studio are on the screen',
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
    grid_paginacao: () => 'grid: la paginación respeta el tamaño de página elegido',
    filtro_opcoes: p => `filtro de "${p.label}" por opción: solo aparecen las filas de la opción y Limpiar lo deshace`,
    visualizar: () => 'Visualizar: abre el registro solo lectura, sin botón de guardar',
    exportacao_filtrada: () => 'exportación: solo lo que está filtrado en la pantalla',
    exportacao_marcadas: () => 'exportación: solo las filas marcadas',
    central_downloads: () => 'Centro de descargas: lista la exportación y descarga el archivo',
    botoes: () => 'botones: los botones configurados en Studio están en la pantalla',
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
export const SUPPORTED_LOGIC_TYPES = ['pesquisa_cadastro', ...Object.keys(TIPO_TELA)]
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

export function planView(v: ManifestView): PlannedTest[] {
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
  if (camposDeTipo(v).length > 0) plano.push({ kind: 'campos_tipos', title: 'formulário: cada campo usa o componente configurado (texto, número, data, opções)' })
  if (v.details.length > 0) plano.push({ kind: 'abas', title: 'abas: as abas de detalhe configuradas no Studio estão no formulário' })
  return plano
}
