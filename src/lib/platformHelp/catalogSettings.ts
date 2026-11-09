/**
 * Tours da tela "Configurações do Projeto" (Studio > settings): defaults dos campos (inclusive a janela de propriedades do campo),
 * como propagar os defaults e os campos calculados. Cada alvo é um `data-help-id` de SettingsDashboardClient, FieldSettingsModal e CalculatedFieldsTab.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const SETTINGS = '/admin/:workspace/:project/studio/settings'

/** a condição "o elemento existe na tela" (o alvo carrega o próprio data-help-id) */
const exists = (id: string) => ({ id, check: 'attr' as const, attr: 'data-help-id', equals: id })

export const SETTINGS_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── visão geral ─────────────────────────
  {
    id: 'settings-visao-geral',
    route: SETTINGS,
    freeClicks: true,
    title: h(['Configurações: visão geral', 'Settings: overview', 'Configuración: visión general']),
    summary: h(['Para que serve a tela e as duas abas: defaults dos campos e campos calculados.', 'What the screen is for and its two tabs: field defaults and calculated fields.', 'Para qué sirve la pantalla y sus dos pestañas: valores por defecto de los campos y campos calculados.']),
    steps: [
      st('what', undefined, ['Padrões do projeto', 'Project defaults', 'Valores por defecto del proyecto'], [
        'Aqui você define o comportamento PADRÃO que se repete em todas as telas do projeto, para não ter de configurar campo por campo em cada caso de uso: máscara, obrigatório, tipo de componente, layout, estilos e fórmulas.',
        'Here you set the DEFAULT behavior that repeats across all the screens of the project, so you do not have to set up field by field in every use case: mask, required, component type, layout, styles and formulas.',
        'Aquí define el comportamiento POR DEFECTO que se repite en todas las pantallas del proyecto, para no tener que configurar campo por campo en cada caso de uso: máscara, obligatorio, tipo de componente, diseño, estilos y fórmulas.',
      ]),
      st('tabs', 'settings.tabs', ['Duas abas', 'Two tabs', 'Dos pestañas'], [
        'Defaults dos Campos: como cada coluna se comporta em casos de uso NOVOS. Campos Calculados: fórmulas reutilizáveis em várias telas. Cada aba tem um tour próprio neste menu.',
        'Field Defaults: how each column behaves in NEW use cases. Calculated Fields: formulas reusable across screens. Each tab has its own tour in this menu.',
        'Valores por defecto de los Campos: cómo se comporta cada columna en casos de uso NUEVOS. Campos Calculados: fórmulas reutilizables en varias pantallas. Cada pestaña tiene su propio recorrido en este menú.',
      ]),
      st('rule', undefined, ['A regra de ouro', 'The golden rule', 'La regla de oro'], [
        'Mudar um default vale para os casos de uso criados DEPOIS. Os que já existem não mudam sozinhos: para levar o novo default até eles, use o ícone de atualizar do campo (veja o tour "Levar os defaults aos casos de uso existentes").',
        'Changing a default applies to use cases created AFTER it. Existing ones do not change by themselves: to carry the new default to them, use the refresh icon of the field (see the tour "Carry defaults to existing use cases").',
        'Cambiar un valor por defecto vale para los casos de uso creados DESPUÉS. Los que ya existen no cambian solos: para llevarles el nuevo valor, use el ícono de actualizar del campo (vea el recorrido "Llevar los valores por defecto a los casos de uso existentes").',
      ]),
    ],
  },

  // ───────────────────────── defaults dos campos ─────────────────────────
  {
    id: 'settings-defaults-campos',
    route: SETTINGS,
    freeClicks: true,
    title: h(['Defaults dos campos', 'Field defaults', 'Valores por defecto de los campos']),
    summary: h(['Escolha uma tabela, abra um campo e configure rótulo, máscara, componente, layout e estilos padrão.', 'Pick a table, open a field and set the default label, mask, component, layout and styles.', 'Elija una tabla, abra un campo y configure la etiqueta, la máscara, el componente, el diseño y los estilos por defecto.']),
    steps: [
      st('tables', 'settings.tables', ['Escolha uma tabela', 'Pick a table', 'Elija una tabla'], [
        'A lista mostra as tabelas sincronizadas do projeto. Clique em uma para ver as colunas dela.',
        'The list shows the synced tables of the project. Click one to see its columns.',
        'La lista muestra las tablas sincronizadas del proyecto. Haga clic en una para ver sus columnas.',
      ], {
        enterClick: 'settings.tab_fields',
        interactive: true,
        completeWhen: exists('settings.table_header'),
        waitingHint: h(['Clique em uma tabela para continuar.', 'Click a table to continue.', 'Haga clic en una tabla para continuar.']),
      }),
      st('header', 'settings.table_header', ['A tabela escolhida', 'The chosen table', 'La tabla elegida'], [
        'Aqui você gerencia como os campos desta tabela se comportam por padrão em novos casos de uso.',
        'Here you manage how the fields of this table behave by default in new use cases.',
        'Aquí gestiona cómo se comportan por defecto los campos de esta tabla en nuevos casos de uso.',
      ]),
      st('search', 'settings.search', ['Achar um campo', 'Find a field', 'Encontrar un campo'], [
        'Em tabelas grandes, busque a coluna pelo nome.',
        'On big tables, search the column by name.',
        'En tablas grandes, busque la columna por nombre.',
      ], { interactive: true }),
      st('card', 'settings.field_card', ['Um cartão por coluna', 'One card per column', 'Una tarjeta por columna'], [
        'Cada cartão é uma coluna: o tipo de dado fica no topo, depois o nome e o nome técnico. O selo "Customizado" aparece nas colunas que já têm defaults seus. Clique no cartão destacado para abrir as propriedades dele.',
        'Each card is a column: the data type is at the top, then the name and the technical name. The "Custom" badge shows on columns that already have defaults of yours. Click the highlighted card to open its properties.',
        'Cada tarjeta es una columna: el tipo de dato está arriba, luego el nombre y el nombre técnico. La insignia "Personalizado" aparece en las columnas que ya tienen valores por defecto suyos. Haga clic en la tarjeta destacada para abrir sus propiedades.',
      ], { advanceOnClick: true, advanceWaitMs: 4000 }),
      st('modal-tabs', 'settings.modal_tabs', ['Duas abas de propriedades', 'Two property tabs', 'Dos pestañas de propiedades'], [
        'A janela de propriedades do campo tem duas abas: GERAL (rótulo, conteúdo e componente) e ESTILOS (aparência do rótulo e do conteúdo).',
        'The field properties window has two tabs: GENERAL (label, content and component) and STYLES (look of the label and the content).',
        'La ventana de propiedades del campo tiene dos pestañas: GENERAL (etiqueta, contenido y componente) y ESTILOS (apariencia de la etiqueta y del contenido).',
      ], { backClick: 'settings.modal_close', enterClick: 'settings.modal_tab_general' }),
      st('label', 'settings.modal_label', ['Texto de exibição', 'Display text', 'Texto de visualización'], [
        'O rótulo que o usuário vê ao lado do campo, no lugar do nome técnico da coluna. Ex.: "Data de nascimento" em vez de dt_nasc.',
        'The label the user sees next to the field, in place of the technical column name. E.g. "Birth date" instead of dt_birth.',
        'La etiqueta que ve el usuario junto al campo, en lugar del nombre técnico de la columna. Ej.: "Fecha de nacimiento" en vez de dt_nac.',
      ], { enterClick: 'settings.modal_tab_general', interactive: true }),
      st('mask', 'settings.modal_mask', ['Máscara', 'Mask', 'Máscara'], [
        'Formata o que a pessoa digita: CPF, CNPJ, CEP, telefone, data, inteiro ou decimal com milhar. "Personalizado" deixa você escrever o seu padrão (0 representa um dígito).',
        'Formats what the person types: CPF, CNPJ, ZIP code, phone, date, integer or decimal with thousands. "Custom" lets you write your own pattern (0 stands for a digit).',
        'Da formato a lo que la persona escribe: CPF, CNPJ, código postal, teléfono, fecha, entero o decimal con miles. "Personalizado" le deja escribir su propio patrón (0 representa un dígito).',
      ], { enterClick: 'settings.modal_tab_general', interactive: true }),
      st('flags', 'settings.modal_flags', ['Obrigatório e somente leitura', 'Required and read-only', 'Obligatorio y solo lectura'], [
        'Obrigatório: o formulário não salva sem esse valor. Somente leitura: o usuário vê o valor, mas não consegue alterá-lo. Clique no quadro para ligar ou desligar.',
        'Required: the form does not save without this value. Read-only: the user sees the value but cannot change it. Click the box to turn it on or off.',
        'Obligatorio: el formulario no guarda sin este valor. Solo lectura: el usuario ve el valor, pero no puede cambiarlo. Haga clic en el recuadro para activar o desactivar.',
      ], { enterClick: 'settings.modal_tab_general', interactive: true }),
      st('layout', 'settings.modal_layout', ['Layout: colunas e largura', 'Layout: columns and width', 'Diseño: columnas y ancho'], [
        'Quantas das 12 colunas o campo ocupa (6 = metade da linha) e a largura visual. Há um layout para a página e outro para quando o formulário abre em modal ou drawer.',
        'How many of the 12 columns the field takes (6 = half the row) and the visual width. There is one layout for the page and another for when the form opens in a modal or drawer.',
        'Cuántas de las 12 columnas ocupa el campo (6 = media fila) y el ancho visual. Hay un diseño para la página y otro para cuando el formulario se abre en modal o drawer.',
      ], { enterClick: 'settings.modal_tab_general', interactive: true }),
      st('component', 'settings.modal_component_type', ['Tipo de componente', 'Component type', 'Tipo de componente'], [
        'Como o campo aparece: texto, texto longo, número, combo, autocomplete (busca dinâmica), rádio, checkbox, interruptor, data ou envio de imagem, documento e arquivo. Para combo, rádio e checkbox você escolhe de onde vêm as opções: valores fixos, um enum global ou um relacionamento com outra tabela. O autocomplete pede a tabela de origem e o campo de busca.',
        'How the field shows: text, long text, number, combo, autocomplete (dynamic search), radio, checkbox, switch, date or image, document and file upload. For combo, radio and checkbox you choose where the options come from: fixed values, a global enum or a relationship with another table. Autocomplete asks for the source table and the search field.',
        'Cómo aparece el campo: texto, texto largo, número, combo, autocomplete (búsqueda dinámica), radio, checkbox, interruptor, fecha o envío de imagen, documento y archivo. Para combo, radio y checkbox elige de dónde vienen las opciones: valores fijos, un enum global o una relación con otra tabla. El autocomplete pide la tabla de origen y el campo de búsqueda.',
      ], { enterClick: 'settings.modal_tab_general', interactive: true }),
      st('styles', 'settings.modal_label_style', ['Estilos do rótulo', 'Label styles', 'Estilos de la etiqueta'], [
        'Na aba ESTILOS: fonte, tamanho e cor do texto do rótulo.',
        'On the STYLES tab: font, size and text color of the label.',
        'En la pestaña ESTILOS: fuente, tamaño y color del texto de la etiqueta.',
      ], { enterClick: 'settings.modal_tab_styles', interactive: true }),
      st('content-styles', 'settings.modal_content_style', ['Estilos do conteúdo', 'Content styles', 'Estilos del contenido'], [
        'Fonte, tamanho e cor do que aparece dentro do campo (o valor digitado).',
        'Font, size and color of what shows inside the field (the typed value).',
        'Fuente, tamaño y color de lo que aparece dentro del campo (el valor escrito).',
      ], { enterClick: 'settings.modal_tab_styles', interactive: true }),
      st('save', 'settings.modal_save', ['Salvar os padrões', 'Save the defaults', 'Guardar los valores por defecto'], [
        '"Salvar Padrões" grava as propriedades no campo e vale para os casos de uso criados daqui para frente. Para sair sem salvar, use o X no canto da janela. O tour termina aqui.',
        '"Save Defaults" stores the properties on the field and applies to use cases created from now on. To leave without saving, use the X in the corner of the window. The tour ends here.',
        '"Guardar Valores" guarda las propiedades en el campo y vale para los casos de uso creados de ahora en adelante. Para salir sin guardar, use la X en la esquina de la ventana. El recorrido termina aquí.',
      ], { enterClick: 'settings.modal_tab_styles', freeInteraction: true }),
    ],
  },

  // ───────────────────────── propagar defaults ─────────────────────────
  {
    id: 'settings-propagar-defaults',
    route: SETTINGS,
    freeClicks: true,
    title: h(['Levar os defaults aos casos de uso existentes', 'Carry defaults to existing use cases', 'Llevar los valores por defecto a los casos de uso existentes']),
    summary: h(['Como aplicar um default novo aos casos de uso que já foram criados.', 'How to apply a new default to use cases that were already created.', 'Cómo aplicar un valor por defecto nuevo a los casos de uso ya creados.']),
    steps: [
      st('why', undefined, ['Por que isso existe', 'Why this exists', 'Por qué existe'], [
        'Um default novo só vale para casos de uso criados depois dele. Para levar a mudança aos que já existem, o campo tem um ícone de atualizar, que aparece quando ele já tem defaults seus.',
        'A new default only applies to use cases created after it. To carry the change to existing ones, the field has a refresh icon, which shows once it has defaults of yours.',
        'Un valor por defecto nuevo solo vale para los casos de uso creados después. Para llevar el cambio a los que ya existen, el campo tiene un ícono de actualizar, que aparece cuando ya tiene valores suyos.',
      ], { enterClick: 'settings.tab_fields' }),
      st('icon', 'settings.field_refresh', ['O ícone de atualizar', 'The refresh icon', 'El ícono de actualizar'], [
        'Está no cartão dos campos com o selo "Customizado" (aqui, o primeiro que aparece). Clique nele para abrir a lista dos casos de uso que usam o campo. Abrir não altera nada.',
        'It is on the cards of the fields with the "Custom" badge (here, the first one shown). Click it to open the list of use cases that use the field. Opening changes nothing.',
        'Está en las tarjetas de los campos con la insignia "Personalizado" (aquí, la primera que aparece). Haga clic para abrir la lista de los casos de uso que usan el campo. Abrir no cambia nada.',
      ], {
        skipIfMissing: true,
        interactive: true,
        completeWhen: { id: 'settings.update_modal_header', check: 'attr', attr: 'data-help-id', equals: 'settings.update_modal_header' },
        waitingHint: h(['Clique no ícone de atualizar para abrir a lista. Abrir não altera nada.', 'Click the refresh icon to open the list. Opening changes nothing.', 'Haga clic en el ícono de actualizar para abrir la lista. Abrir no cambia nada.']),
      }),
      st('modal', 'settings.update_modal_header', ['Atualizar casos de uso', 'Update use cases', 'Actualizar casos de uso'], [
        'A janela diz qual campo será propagado. Só entram os RASCUNHOS de casos de uso que usam esse campo.',
        'The window says which field will be propagated. Only the DRAFTS of use cases that use that field are included.',
        'La ventana dice qué campo se propagará. Solo entran los BORRADORES de casos de uso que usan ese campo.',
      ], { skipIfMissing: true }),
      st('list', 'settings.update_modal_list', ['Os casos de uso encontrados', 'The use cases found', 'Los casos de uso encontrados'], [
        'Cada cartão é um caso de uso. Clique para marcar ou desmarcar; desmarque os que você NÃO quer mexer. A atualização substitui as propriedades do campo naquele rascunho pelos defaults atuais.',
        'Each card is a use case. Click to check or uncheck; uncheck the ones you do NOT want to touch. The update replaces the field properties in that draft with the current defaults.',
        'Cada tarjeta es un caso de uso. Haga clic para marcar o desmarcar; desmarque los que NO quiere tocar. La actualización reemplaza las propiedades del campo en ese borrador por los valores por defecto actuales.',
      ], { skipIfMissing: true, findWaitMs: 3000 }),
      st('all', 'settings.update_modal_all', ['Selecionar todos', 'Select all', 'Seleccionar todos'], [
        'O atalho marca ou desmarca todos os casos de uso de uma vez.',
        'The shortcut checks or unchecks all use cases at once.',
        'El atajo marca o desmarca todos los casos de uso de una vez.',
      ], { skipIfMissing: true, findWaitMs: 3000 }),
      st('confirm', 'settings.update_modal_confirm', ['Confirmar Atualização', 'Confirm Update', 'Confirmar Actualización'], [
        'Grava os defaults nos rascunhos marcados. Depois, publique cada caso de uso para a mudança chegar aos usuários. O botão fica desligado se nenhum estiver marcado. Se for só treino, não clique aqui: feche a janela no X.',
        'Writes the defaults into the checked drafts. Then publish each use case for the change to reach users. The button is off when none is checked. If you are only practicing, do not click here: close the window with the X.',
        'Graba los valores por defecto en los borradores marcados. Después, publique cada caso de uso para que el cambio llegue a los usuarios. El botón queda apagado si no hay ninguno marcado. Si es solo práctica, no haga clic aquí: cierre la ventana con la X.',
      ], { skipIfMissing: true }),
      st('close', 'settings.update_modal_close', ['Fechar a janela', 'Close the window', 'Cerrar la ventana'], [
        'O X fecha a janela sem atualizar nada. Se nenhum ícone de atualizar apareceu, escolha uma tabela e salve defaults em algum campo primeiro.',
        'The X closes the window without updating anything. If no refresh icon showed, pick a table and save defaults on some field first.',
        'La X cierra la ventana sin actualizar nada. Si no apareció ningún ícono de actualizar, elija una tabla y guarde valores en algún campo primero.',
      ], { skipIfMissing: true }),
    ],
  },

  // ───────────────────────── campos calculados ─────────────────────────
  {
    id: 'settings-campos-calculados',
    route: SETTINGS,
    freeClicks: true,
    title: h(['Campos calculados', 'Calculated fields', 'Campos calculados']),
    summary: h(['Crie fórmulas reutilizáveis (totais, médias, condições) e use em qualquer caso de uso.', 'Create reusable formulas (totals, averages, conditions) and use them in any use case.', 'Cree fórmulas reutilizables (totales, promedios, condiciones) y úselas en cualquier caso de uso.']),
    steps: [
      st('tab', 'settings.tab_calculated', ['Fórmulas do projeto', 'Project formulas', 'Fórmulas del proyecto'], [
        'Um campo calculado é uma fórmula guardada no projeto. Depois de criado, ele aparece no painel de campos dos casos de uso e você o arrasta para a tela, como qualquer campo.',
        'A calculated field is a formula stored in the project. Once created, it shows in the field panel of use cases and you drag it onto the screen like any field.',
        'Un campo calculado es una fórmula guardada en el proyecto. Una vez creado, aparece en el panel de campos de los casos de uso y lo arrastra a la pantalla como cualquier campo.',
      ], { enterClick: 'settings.tab_calculated' }),
      st('edit', 'settings.calc_edit', ['Os que já existem', 'The ones that exist', 'Los que ya existen'], [
        'Cada campo da lista mostra o nome e quantos itens a fórmula tem. O lápis edita; a lixeira exclui, pedindo confirmação, e não dá para desfazer.',
        'Each field in the list shows the name and how many items the formula has. The pencil edits; the trash deletes, asking for confirmation, and cannot be undone.',
        'Cada campo de la lista muestra el nombre y cuántos elementos tiene la fórmula. El lápiz edita; la papelera elimina, pidiendo confirmación, y no se puede deshacer.',
      ], { skipIfMissing: true }),
      st('new', 'settings.calc_new', ['Novo campo calculado', 'New calculated field', 'Nuevo campo calculado'], [
        'Clique em "Novo" para abrir o editor. Nada é gravado até você salvar.',
        'Click "New" to open the editor. Nothing is stored until you save.',
        'Haga clic en "Nuevo" para abrir el editor. No se guarda nada hasta que guarde.',
      ], { advanceOnClick: true, advanceWaitMs: 3000 }),
      st('name', 'settings.calc_name', ['Dê um nome', 'Give it a name', 'Póngale un nombre'], [
        'O nome aparece onde o campo for usado (ex.: "Total R$"). Ele é obrigatório para salvar.',
        'The name shows wherever the field is used (e.g. "Total $"). It is required to save.',
        'El nombre aparece donde se use el campo (ej.: "Total $"). Es obligatorio para guardar.',
      ], {
        interactive: true,
        completeWhen: { id: 'settings.calc_name', check: 'filled' },
        waitingHint: h(['Digite um nome para continuar.', 'Type a name to continue.', 'Escriba un nombre para continuar.']),
      }),
      st('intro', 'settings.calc_intro', ['Como a fórmula acha os campos', 'How the formula finds the fields', 'Cómo la fórmula encuentra los campos'], [
        'Ao arrastar este campo calculado para um caso de uso, o sistema usa automaticamente os campos da tabela daquele caso de uso quando os nomes coincidem. Por isso vale reaproveitar nomes de colunas iguais entre tabelas.',
        'When you drag this calculated field into a use case, the system automatically uses the fields of that use case table when the names match. That is why reusing the same column names across tables pays off.',
        'Al arrastrar este campo calculado a un caso de uso, el sistema usa automáticamente los campos de la tabla de ese caso de uso cuando los nombres coinciden. Por eso conviene reutilizar nombres de columnas iguales entre tablas.',
      ]),
      st('builder', 'settings.calc_builder', ['Construtor de fórmula', 'Formula builder', 'Constructor de fórmulas'], [
        'Monte a fórmula juntando peças: operadores matemáticos e lógicos, funções (SOMA, MÉDIA, CONTAGEM, MÁXIMO, MÍNIMO, ARREDONDAR, SE), campos de qualquer tabela ou outros campos calculados (em "Inserir campo") e VALOR LIVRE, para um número ou texto fixo como 100 ou Cancelado. "Limpar" esvazia a fórmula. O construtor avisa se faltou fechar um parêntese ou se a ordem dos operadores está inválida.',
        'Build the formula by joining pieces: math and logic operators, functions (SUM, AVERAGE, COUNT, MAX, MIN, ROUND, IF), fields of any table or other calculated fields (under "Insert field") and FREE VALUE, for a fixed number or text such as 100 or Cancelled. "Clear" empties the formula. The builder warns if a parenthesis was left open or the operator order is invalid.',
        'Arme la fórmula juntando piezas: operadores matemáticos y lógicos, funciones (SUMA, PROMEDIO, CONTEO, MÁXIMO, MÍNIMO, REDONDEAR, SI), campos de cualquier tabla u otros campos calculados (en "Insertar campo") y VALOR LIBRE, para un número o texto fijo como 100 o Cancelado. "Limpiar" vacía la fórmula. El constructor avisa si faltó cerrar un paréntesis o si el orden de los operadores es inválido.',
      ], { interactive: true }),
      st('save', 'settings.calc_save', ['Salvar o campo', 'Save the field', 'Guardar el campo'], [
        '"Salvar Campo" grava a fórmula no projeto: ela fica disponível para todos os casos de uso. Você pode clicar para gravar de verdade ou seguir para o próximo passo e cancelar.',
        '"Save Field" stores the formula in the project: it becomes available to every use case.',
        '"Guardar Campo" guarda la fórmula en el proyecto: queda disponible para todos los casos de uso.',
      ]),
      st('cancel', 'settings.calc_cancel', ['Cancelar', 'Cancel', 'Cancelar'], [
        'Se estava só treinando, clique em Cancelar: o rascunho da fórmula é descartado sem gravar nada.',
        'If you were only practicing, click Cancel: the formula draft is discarded and nothing is stored.',
        'Si solo estaba practicando, haga clic en Cancelar: el borrador de la fórmula se descarta sin guardar nada.',
      ], { interactive: true, skipIfMissing: true }),
    ],
  },
]
