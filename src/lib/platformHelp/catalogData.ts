/**
 * Tours da tela "Dados & Schemas" (Studio > data): visão geral, tabela e campos, auditoria, acesso por linha e relacionamentos.
 * Textos em pt, en e es; cada alvo é um `data-help-id` que existe em DataDashboardClient, TableFieldsManager,
 * AuditEditor, RowPolicyEditor e RelationsManager.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour, StepRule } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const DATA = '/admin/:workspace/:project/studio/data'

/** o elemento existe na tela (truque: o próprio data-help-id vale como condição) */
const exists = (id: string): StepRule => ({ id, check: 'attr', attr: 'data-help-id', equals: id })

/** primeiro passo dos tours de uma tabela: a pessoa escolhe uma tabela da lista (nenhuma vem selecionada) */
const pickTable = (what: T3): PlatformStep => st('pick', 'data.tables', ['Escolha uma tabela', 'Pick a table', 'Elija una tabla'], [
  `A primeira tabela já vem selecionada; clique em outra se preferir. ${what[0]}`,
  `The first table is already selected; click another if you prefer. ${what[1]}`,
  `La primera tabla ya viene seleccionada; haga clic en otra si prefiere. ${what[2]}`,
], {
  enterClick: 'data.tab_metadata',
  interactive: true,
})

const SAVE_NOTE: T3 = [
  'Nada do que você mexer vale até clicar em "Salvar Tabela". Se trocar de tabela antes de salvar, as mudanças não salvas da tabela anterior se perdem.',
  'Nothing you change applies until you click "Save Table". If you switch tables before saving, the unsaved changes of the previous table are lost.',
  'Nada de lo que cambie vale hasta hacer clic en "Guardar Tabla". Si cambia de tabla antes de guardar, los cambios sin guardar de la tabla anterior se pierden.',
]

export const DATA_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── visão geral ─────────────────────────
  {
    id: 'studio-dados',
    route: DATA,
    title: h(['Dados & Schemas: visão geral', 'Data & Schemas: overview', 'Datos y Esquemas: visión general']),
    summary: h(['As duas visões da tela e para que serve cada uma. Cada assunto tem um tour próprio neste menu.', 'The two views of the screen and what each is for. Each topic has its own tour in this menu.', 'Las dos vistas de la pantalla y para qué sirve cada una. Cada tema tiene su propio recorrido en este menú.']),
    steps: [
      st('tabs', 'data.tabs', ['Duas visões', 'Two views', 'Dos vistas'], [
        'Tabela / Campos: nomes, permissões, auditoria, acesso por linha e as regras de cada coluna. Relacionamentos: como as tabelas se ligam (a base dos JOINs automáticos).',
        'Table / Fields: names, permissions, audit, row access and the rules of each column. Relationships: how tables connect (the basis of automatic JOINs).',
        'Tabla / Campos: nombres, permisos, auditoría, acceso por fila y las reglas de cada columna. Relaciones: cómo se unen las tablas (la base de los JOIN automáticos).',
      ]),
      st('why', undefined, ['Para que serve esta tela', 'What this screen is for', 'Para qué sirve esta pantalla'], [
        'O banco do cliente nunca é alterado por aqui. Esta tela guarda, no MetaBuilder, a CAMADA DE NEGÓCIO por cima das tabelas: nome amigável, o que o app pode gravar, quem vê quais linhas e como cada campo aparece. Todos os casos de uso herdam isso.',
        'The customer database is never changed from here. This screen stores, in MetaBuilder, the BUSINESS LAYER on top of the tables: friendly name, what the app may write, who sees which rows and how each field appears. Every use case inherits it.',
        'La base del cliente nunca se modifica desde aquí. Esta pantalla guarda, en MetaBuilder, la CAPA DE NEGOCIO sobre las tablas: nombre amigable, qué puede grabar la app, quién ve qué filas y cómo se muestra cada campo. Todos los casos de uso lo heredan.',
      ]),
      st('tables', 'data.tables', ['Suas tabelas', 'Your tables', 'Sus tablas'], [
        'Vêm do banco sincronizado pelo Agente CLI. Se uma tabela nova do banco não aparece aqui, sincronize de novo. Busque pelo nome e clique para editar os detalhes ao lado.',
        'They come from the database synced by the CLI Agent. If a new table of the database does not show here, sync again. Search by name and click one to edit its details on the right.',
        'Vienen de la base sincronizada por el Agente CLI. Si una tabla nueva de la base no aparece aquí, sincronice de nuevo. Busque por nombre y haga clic para editar sus detalles a la derecha.',
      ], { enterClick: 'data.tab_metadata' }),
      st('relations', 'data.tab_relations', ['Relacionamentos', 'Relationships', 'Relaciones'], [
        'O mapa de ligações entre as tabelas (chaves estrangeiras). Quando você monta um caso de uso com mais de uma tabela, o MetaBuilder usa este mapa para montar os JOINs sozinho.',
        'The map of links between tables (foreign keys). When you build a use case with more than one table, MetaBuilder uses this map to build the JOINs by itself.',
        'El mapa de vínculos entre las tablas (claves foráneas). Cuando arma un caso de uso con más de una tabla, MetaBuilder usa este mapa para armar los JOIN solo.',
      ]),
      st('back', 'data.back', ['Voltar ao Studio', 'Back to Studio', 'Volver al Studio'], [
        'Leva de volta ao painel do Studio, onde ficam os casos de uso.',
        'Takes you back to the Studio dashboard, where the use cases are.',
        'Lleva de vuelta al panel del Studio, donde están los casos de uso.',
      ]),
      st('more', undefined, ['Para ir além', 'Going further', 'Para ir más allá'], [
        'Neste menu de ajuda há um tour para cada assunto: Tabela e campos, Auditoria, Acesso por linha e Relacionamentos.',
        'In this help menu there is one tour for each topic: Table and fields, Audit, Row access and Relationships.',
        'En este menú de ayuda hay un recorrido para cada tema: Tabla y campos, Auditoría, Acceso por fila y Relaciones.',
      ]),
    ],
  },

  // ───────────────────────── tabela e campos ─────────────────────────
  {
    id: 'dados-tabela-campos',
    route: DATA,
    title: h(['Tabela e campos: nomes e regras', 'Table and fields: names and rules', 'Tabla y campos: nombres y reglas']),
    summary: h(['Nome amigável, permissões da tabela e as regras de cada coluna (rótulo, ordem, tipo de interface e visibilidade).', 'Friendly name, table permissions and each column rules (label, order, interface type and visibility).', 'Nombre amigable, permisos de la tabla y las reglas de cada columna (etiqueta, orden, tipo de interfaz y visibilidad).']),
    steps: [
      st('search', 'data.table_search', ['Buscar tabela', 'Search a table', 'Buscar tabla'], [
        'Digite parte do nome técnico ou do nome amigável para filtrar a lista. Útil quando o banco tem dezenas de tabelas.',
        'Type part of the technical or friendly name to filter the list. Useful when the database has dozens of tables.',
        'Escriba parte del nombre técnico o amigable para filtrar la lista. Útil cuando la base tiene decenas de tablas.',
      ], { enterClick: 'data.tab_metadata' }),
      pickTable(['Os detalhes dela aparecem ao lado.', 'Its details show on the right.', 'Sus detalles aparecen a la derecha.']),
      st('header', 'data.table_header', ['Cabeçalho da tabela', 'Table header', 'Encabezado de la tabla'], [
        'Mostra o nome técnico e o schema da tabela, e reúne os botões de atualizar e salvar.',
        'Shows the technical name and the schema of the table, and groups the refresh and save buttons.',
        'Muestra el nombre técnico y el esquema de la tabla, y reúne los botones de actualizar y guardar.',
      ]),
      st('migrate', 'data.schema_migrate', ['Migrar schema', 'Migrate schema', 'Migrar esquema'], [
        'Cuidado: renomeia o schema de TODAS as tabelas do projeto que estão neste schema, não só desta. Serve quando o banco do cliente mudou de schema. Depois é preciso rodar o Agente CLI de novo. Este tour não clica aqui.',
        'Careful: it renames the schema of ALL project tables that are in this schema, not only this one. It is for when the customer database moved to another schema. Afterwards the CLI Agent must run again. This tour does not click here.',
        'Cuidado: renombra el esquema de TODAS las tablas del proyecto que están en este esquema, no solo esta. Sirve cuando la base del cliente cambió de esquema. Después hay que ejecutar el Agente CLI de nuevo. Este recorrido no hace clic aquí.',
      ]),
      st('refresh', 'data.refresh', ['Recarregar colunas', 'Reload columns', 'Recargar columnas'], [
        'Busca de novo as colunas desta tabela no MetaBuilder. Use depois de sincronizar o banco para ver colunas novas. Descarta as edições de colunas ainda não salvas.',
        'Fetches this table columns again from MetaBuilder. Use it after syncing the database to see new columns. It discards unsaved column edits.',
        'Vuelve a buscar las columnas de esta tabla en MetaBuilder. Úselo después de sincronizar la base para ver columnas nuevas. Descarta las ediciones de columnas aún no guardadas.',
      ]),
      st('names', 'data.table_names', ['Nome amigável e descrição', 'Friendly name and description', 'Nombre amigable y descripción'], [
        'O nome amigável (ex.: "Pedidos" em vez de "tb_ped_01") aparece em listas de tabelas, títulos e relatórios. A descrição é uma nota para a equipe.',
        'The friendly name (e.g. "Orders" instead of "tb_ord_01") shows in table lists, titles and reports. The description is a note for the team.',
        'El nombre amigable (ej.: "Pedidos" en vez de "tb_ped_01") aparece en listas de tablas, títulos e informes. La descripción es una nota para el equipo.',
      ]),
      st('permissions', 'data.permissions', ['Permissões da tabela', 'Table permissions', 'Permisos de la tabla'], [
        'Três interruptores: permitir criar, editar e excluir registros. Valem para TODOS os casos de uso que usam esta tabela. Desligar "excluir" é a forma mais simples de proteger uma tabela de apagamentos.',
        'Three switches: allow creating, editing and deleting records. They apply to EVERY use case that uses this table. Turning "delete" off is the simplest way to protect a table from deletions.',
        'Tres interruptores: permitir crear, editar y eliminar registros. Valen para TODOS los casos de uso que usan esta tabla. Apagar "eliminar" es la forma más simple de proteger una tabla de borrados.',
      ]),
      st('audit', 'data.audit', ['Auditoria e acesso por linha', 'Audit and row access', 'Auditoría y acceso por fila'], [
        'Estes dois blocos têm um tour próprio cada: "Auditoria" e "Acesso por linha". Aqui basta saber que ficam nesta tabela e também só valem depois de "Salvar Tabela".',
        'These two blocks have their own tour each: "Audit" and "Row access". Here it is enough to know they live in this table and also only apply after "Save Table".',
        'Estos dos bloques tienen cada uno su propio recorrido: "Auditoría" y "Acceso por fila". Aquí basta saber que están en esta tabla y también solo valen después de "Guardar Tabla".',
      ]),
      st('fields', 'data.fields_section', ['Colunas detectadas', 'Detected columns', 'Columnas detectadas'], [
        'Uma ficha por coluna da tabela, na ordem do banco. O número no título é o total. A lista rola dentro do quadro.',
        'One card per column of the table, in database order. The number in the title is the total. The list scrolls inside the frame.',
        'Una ficha por columna de la tabla, en el orden de la base. El número del título es el total. La lista se desplaza dentro del cuadro.',
      ]),
      st('field-head', 'data.field_head', ['Identificação da coluna', 'Column identification', 'Identificación de la columna'], [
        'O nome técnico, o tipo no banco e as marcas: PK é a chave primária e "Obrigatório" indica que o banco não aceita vazio. Isso vem do banco e não se edita aqui.',
        'The technical name, the database type and the badges: PK is the primary key and "Required" means the database does not accept empty. This comes from the database and is not edited here.',
        'El nombre técnico, el tipo en la base y las marcas: PK es la clave primaria y "Obligatorio" indica que la base no acepta vacío. Esto viene de la base y no se edita aquí.',
      ], { skipIfMissing: true }),
      st('field-label', 'data.field_label', ['Rótulo na interface', 'Interface label', 'Etiqueta en la interfaz'], [
        'O nome que o usuário vê (ex.: "Data de nascimento" em vez de "dt_nasc"). É o rótulo padrão em todas as telas; em cada caso de uso dá para trocar só ali.',
        'The name the user sees (e.g. "Birth date" instead of "dt_birth"). It is the default label on every screen; in each use case you can change it just there.',
        'El nombre que ve el usuario (ej.: "Fecha de nacimiento" en vez de "dt_nac"). Es la etiqueta por defecto en todas las pantallas; en cada caso de uso se puede cambiar solo allí.',
      ], { skipIfMissing: true }),
      st('field-order', 'data.field_order', ['Ordem', 'Order', 'Orden'], [
        'A posição padrão do campo nas telas e formulários: números menores aparecem primeiro.',
        'The default position of the field on screens and forms: lower numbers show first.',
        'La posición por defecto del campo en pantallas y formularios: los números menores aparecen primero.',
      ], { skipIfMissing: true }),
      st('field-widget', 'data.field_widget', ['Tipo de interface', 'Interface type', 'Tipo de interfaz'], [
        'Como o campo é preenchido: texto, número, data/hora, interruptor (sim/não) ou envio de imagem, documento e arquivo. Os envios guardam o conteúdo em Base64 dentro do próprio registro, então use com moderação.',
        'How the field is filled in: text, number, date/time, switch (yes/no) or image, document and file upload. Uploads store the content as Base64 inside the record itself, so use them sparingly.',
        'Cómo se completa el campo: texto, número, fecha/hora, interruptor (sí/no) o envío de imagen, documento y archivo. Los envíos guardan el contenido en Base64 dentro del propio registro, así que úselos con moderación.',
      ], { skipIfMissing: true }),
      st('field-flags', 'data.field_flags', ['Onde o campo aparece', 'Where the field shows', 'Dónde aparece el campo'], [
        'Quatro opções: usar como filtro, mostrar na grade, mostrar no formulário e permitir ordenar. Desligar "Visível na grade" desliga também "Ordenável", porque não dá para ordenar o que não aparece.',
        'Four options: use as a filter, show in the grid, show in the form and allow sorting. Turning "Visible in grid" off also turns "Sortable" off, since you cannot sort what is not shown.',
        'Cuatro opciones: usar como filtro, mostrar en la grilla, mostrar en el formulario y permitir ordenar. Apagar "Visible en la grilla" apaga también "Ordenable", porque no se puede ordenar lo que no se muestra.',
      ], { skipIfMissing: true }),
      st('save', 'data.save', ['Salvar Tabela', 'Save Table', 'Guardar Tabla'], SAVE_NOTE),
    ],
  },

  // ───────────────────────── auditoria ─────────────────────────
  {
    id: 'dados-auditoria',
    route: DATA,
    title: h(['Auditoria: quem criou e alterou', 'Audit: who created and changed', 'Auditoría: quién creó y modificó']),
    summary: h(['Colunas que guardam quando e por quem cada registro foi criado e alterado, preenchidas pelo servidor.', 'Columns that store when and by whom each record was created and changed, filled in by the server.', 'Columnas que guardan cuándo y por quién se creó y modificó cada registro, completadas por el servidor.']),
    steps: [
      pickTable(['A auditoria é configurada por tabela.', 'Audit is set up per table.', 'La auditoría se configura por tabla.']),
      st('audit', 'data.audit', ['Auditoria da tabela', 'Table audit', 'Auditoría de la tabla'], [
        'Guarda QUANDO e POR QUEM cada registro foi criado e alterado. Quem preenche é o servidor (o Agente CLI ou o app ejetado), nunca a tela: por isso ninguém consegue falsificar. As colunas não mudam depois de criadas.',
        'Stores WHEN and BY WHOM each record was created and changed. The server fills it in (the CLI Agent or the ejected app), never the screen, so nobody can fake it. The columns do not change once created.',
        'Guarda CUÁNDO y POR QUIÉN se creó y modificó cada registro. Lo completa el servidor (el Agente CLI o la app eyectada), nunca la pantalla, así que nadie puede falsificarlo. Las columnas no cambian una vez creadas.',
      ]),
      st('columns', 'data.audit_columns', ['As quatro colunas', 'The four columns', 'Las cuatro columnas'], [
        'created_at, created_by, updated_at e updated_by: escolha qual coluna da tabela guarda cada informação. Se os nomes forem os usuais, o MetaBuilder já os reconhece e mostra a etiqueta "Reconhecidas pelo nome". Escolher "(nenhuma)" desliga aquela informação.',
        'created_at, created_by, updated_at and updated_by: pick which column of the table stores each piece of information. If the names are the usual ones, MetaBuilder already recognizes them and shows the "Recognized by name" tag. Picking "(none)" turns that piece off.',
        'created_at, created_by, updated_at y updated_by: elija qué columna de la tabla guarda cada dato. Si los nombres son los usuales, MetaBuilder ya los reconoce y muestra la etiqueta "Reconocidas por el nombre". Elegir "(ninguna)" apaga ese dato.',
      ], { skipIfMissing: true }),
      st('by', 'data.audit_by', ['O valor gravado em "por"', 'The value stored in "by"', 'El valor grabado en "por"'], [
        'Aparece quando há coluna de "criado por" ou "alterado por". Define o que vai nela: o identificador do usuário, o e-mail, o nome ou uma coluna da tabela de usuários do login. O identificador é o mais estável, porque e-mail e nome podem mudar.',
        'Shows when there is a "created by" or "changed by" column. It defines what goes in it: the user identifier, the e-mail, the name or a column of the sign-in users table. The identifier is the most stable, because e-mail and name can change.',
        'Aparece cuando hay columna de "creado por" o "modificado por". Define qué va en ella: el identificador del usuario, el correo, el nombre o una columna de la tabla de usuarios del acceso. El identificador es el más estable, porque correo y nombre pueden cambiar.',
      ], { skipIfMissing: true }),
      st('sql', 'data.audit_sql', ['Gerar o SQL das colunas', 'Generate the columns SQL', 'Generar el SQL de las columnas'], [
        'Se a tabela ainda não tem as colunas, este botão mostra o SQL pronto para criá-las. O MetaBuilder NÃO altera o banco do cliente: você copia, aplica no banco e sincroniza de novo. Este tour não abre o SQL.',
        'If the table does not have the columns yet, this button shows ready SQL to create them. MetaBuilder does NOT change the customer database: you copy it, apply it to the database and sync again. This tour does not open the SQL.',
        'Si la tabla aún no tiene las columnas, este botón muestra el SQL listo para crearlas. MetaBuilder NO modifica la base del cliente: usted lo copia, lo aplica en la base y sincroniza de nuevo. Este recorrido no abre el SQL.',
      ], { skipIfMissing: true }),
      st('toggle', 'data.audit_toggle', ['Desativar ou reativar', 'Turn off or on', 'Desactivar o reactivar'], [
        'Desativa a auditoria só desta tabela (ela deixa de ser preenchida). Reativar volta ao reconhecimento pelo nome. Útil para tabelas que não precisam de rastro.',
        'Turns audit off for this table only (it stops being filled in). Turning it on again goes back to recognition by name. Useful for tables that need no trail.',
        'Desactiva la auditoría solo de esta tabla (deja de completarse). Reactivar vuelve al reconocimiento por nombre. Útil para tablas que no necesitan rastro.',
      ]),
      st('save', 'data.save', ['Salvar Tabela', 'Save Table', 'Guardar Tabla'], [
        'A auditoria é gravada junto com a tabela. Clique em "Salvar Tabela" para valer. Com a auditoria ligada, a regra de acesso por linha ganha o atalho "Só os registros que eu criei".',
        'Audit is saved together with the table. Click "Save Table" to apply. With audit on, the row access rule gets the "Only the records I created" shortcut.',
        'La auditoría se guarda junto con la tabla. Haga clic en "Guardar Tabla" para que valga. Con la auditoría activa, la regla de acceso por fila gana el atajo "Solo los registros que yo creé".',
      ]),
    ],
  },

  // ───────────────────────── acesso por linha ─────────────────────────
  {
    id: 'dados-acesso-linha',
    route: DATA,
    title: h(['Acesso por linha: quem vê o quê', 'Row access: who sees what', 'Acceso por fila: quién ve qué']),
    summary: h(['Limita as linhas da tabela que cada usuário do app enxerga e grava (ex.: cada vendedor vê só os próprios pedidos).', 'Limits the table rows each app user can see and write (e.g. each salesperson sees only their own orders).', 'Limita las filas de la tabla que cada usuario de la app ve y graba (ej.: cada vendedor ve solo sus pedidos).']),
    steps: [
      pickTable(['O acesso por linha é configurado por tabela.', 'Row access is set up per table.', 'El acceso por fila se configura por tabla.']),
      st('policy', 'data.row_policy', ['Acesso por linha', 'Row access', 'Acceso por fila'], [
        'Cada regra compara uma COLUNA da tabela com um dado do usuário logado. Vale em TODAS as telas, no BI e nas exportações, e o Agente CLI aplica a regra ao SQL. Sem nenhuma regra, todos veem todas as linhas.',
        'Each rule compares a table COLUMN with a piece of data of the signed-in user. It applies on EVERY screen, in BI and in exports, and the CLI Agent applies the rule to the SQL. With no rule, everybody sees every row.',
        'Cada regla compara una COLUMNA de la tabla con un dato del usuario conectado. Vale en TODAS las pantallas, en el BI y en las exportaciones, y el Agente CLI aplica la regla al SQL. Sin ninguna regla, todos ven todas las filas.',
      ]),
      st('mine', 'data.row_mine', ['Atalho: só os que eu criei', 'Shortcut: only mine', 'Atajo: solo los que creé'], [
        'Aparece quando a auditoria desta tabela tem a coluna de "criado por". Com um clique cria a regra "coluna de criado por igual ao usuário logado": cada pessoa vê só os registros que ela mesma criou.',
        'Shows when this table audit has the "created by" column. With one click it creates the rule "created-by column equals the signed-in user": each person sees only the records they created.',
        'Aparece cuando la auditoría de esta tabla tiene la columna de "creado por". Con un clic crea la regla "columna de creado por igual al usuario conectado": cada persona ve solo los registros que creó.',
      ], { skipIfMissing: true }),
      st('add', 'data.row_add', ['Adicionar uma regra', 'Add a rule', 'Agregar una regla'], [
        'Clique em "Adicionar regra" para ver como ela é. Nada é gravado até "Salvar Tabela", e dá para remover a regra logo em seguida.',
        'Click "Add rule" to see what it looks like. Nothing is saved until "Save Table", and you can remove the rule right after.',
        'Haga clic en "Agregar regla" para ver cómo es. No se graba nada hasta "Guardar Tabla", y se puede quitar la regla enseguida.',
      ], {
        interactive: true,
        completeWhen: exists('data.row_rule'),
        waitingHint: h(['Clique em "Adicionar regra" para continuar. Nada é gravado até você salvar a tabela.', 'Click "Add rule" to continue. Nothing is saved until you save the table.', 'Haga clic en "Agregar regla" para continuar. No se graba nada hasta que guarde la tabla.']),
      }),
      st('rule', 'data.row_rule_main', ['Coluna, condição e valor do usuário', 'Column, condition and user value', 'Columna, condición y valor del usuario'], [
        'Coluna: qual coluna da tabela é comparada. Condição: "igual a", "está em" ou "relacionada" (compara por uma tabela ligada). Valor do usuário: o e-mail, o nome ou uma coluna da tabela de usuários do login. Exemplo: coluna "vendedor_id" igual à coluna "funcionario_id" do usuário.',
        'Column: which table column is compared. Condition: "equals", "is in" or "related" (compares through a linked table). User value: the e-mail, the name or a column of the sign-in users table. Example: column "salesperson_id" equals the user column "employee_id".',
        'Columna: qué columna de la tabla se compara. Condición: "igual a", "está en" o "relacionada" (compara por una tabla vinculada). Valor del usuario: el correo, el nombre o una columna de la tabla de usuarios del acceso. Ejemplo: columna "vendedor_id" igual a la columna "empleado_id" del usuario.',
      ], { skipIfMissing: true }),
      st('bypass', 'data.row_bypass', ['Exceção para quem manda', 'Exception for the boss', 'Excepción para quien manda'], [
        'Marque para liberar certas pessoas da regra, por e-mail, nome, uma coluna do usuário ou GRUPO de acesso (ex.: o grupo "Gerentes" vê todas as linhas). Quem cai na exceção enxerga a tabela inteira.',
        'Check it to release certain people from the rule, by e-mail, name, a user column or access GROUP (e.g. the "Managers" group sees every row). Whoever falls under the exception sees the whole table.',
        'Márquelo para liberar a ciertas personas de la regla, por correo, nombre, una columna del usuario o GRUPO de acceso (ej.: el grupo "Gerentes" ve todas las filas). Quien cae en la excepción ve toda la tabla.',
      ], { skipIfMissing: true }),
      st('closed', 'data.row_failclosed', ['Falha fechada', 'Fail closed', 'Falla cerrada'], [
        'Se o usuário não tem o dado que a regra pede, ele NÃO vê nenhuma linha, em vez de ver tudo. É a escolha segura. Por isso o login do app precisa estar configurado: sem ele ninguém tem dados e a tabela fica vazia para todos (a tela avisa).',
        'If the user does not have the data the rule asks for, they see NO row, instead of seeing everything. It is the safe choice. That is why the app sign-in must be set up: without it nobody has data and the table is empty for everyone (the screen warns).',
        'Si el usuario no tiene el dato que pide la regla, NO ve ninguna fila, en vez de ver todo. Es la opción segura. Por eso el acceso de la app debe estar configurado: sin él nadie tiene datos y la tabla queda vacía para todos (la pantalla avisa).',
      ], { skipIfMissing: true }),
      st('remove', 'data.row_remove', ['Remover a regra', 'Remove the rule', 'Quitar la regla'], [
        'O botão "Remover" tira a regra. Use agora para descartar a de teste que você acabou de criar (ela só estava na tela). Depois de salvar, remover uma regra devolve a visão de todas as linhas.',
        'The "Remove" button takes the rule out. Use it now to discard the test rule you just created (it was only on screen). After saving, removing a rule gives everyone back the view of all rows.',
        'El botón "Quitar" saca la regla. Úselo ahora para descartar la de prueba que acaba de crear (solo estaba en la pantalla). Después de guardar, quitar una regla devuelve la vista de todas las filas.',
      ], { skipIfMissing: true }),
      st('save', 'data.save', ['Salvar Tabela', 'Save Table', 'Guardar Tabla'], [
        'As regras são gravadas junto com a tabela e passam a valer para os usuários na hora. Clique em "Salvar Tabela" só quando tiver certeza: uma regra errada pode esconder linhas de quem precisa vê-las.',
        'The rules are saved together with the table and start applying to users right away. Click "Save Table" only when you are sure: a wrong rule can hide rows from those who need to see them.',
        'Las reglas se guardan junto con la tabla y pasan a valer para los usuarios al instante. Haga clic en "Guardar Tabla" solo cuando esté seguro: una regla equivocada puede ocultar filas a quien necesita verlas.',
      ]),
    ],
  },

  // ───────────────────────── relacionamentos ─────────────────────────
  {
    id: 'dados-relacionamentos',
    route: DATA,
    title: h(['Relacionamentos entre tabelas', 'Relationships between tables', 'Relaciones entre tablas']),
    summary: h(['O mapa de ligações usado nos JOINs automáticos: as do banco, as manuais e como criar uma relação.', 'The links map used by automatic JOINs: the database ones, the manual ones and how to create a relationship.', 'El mapa de vínculos usado en los JOIN automáticos: las de la base, las manuales y cómo crear una relación.']),
    steps: [
      st('title', 'rel.title', ['A fonte única de relacionamentos', 'The single source of relationships', 'La fuente única de relaciones'], [
        'O subtítulo conta quantas relações vêm do banco e quantas são manuais. Todos os casos de uso usam este mesmo grafo para resolver JOINs.',
        'The subtitle counts how many relationships come from the database and how many are manual. Every use case uses this same graph to resolve JOINs.',
        'El subtítulo cuenta cuántas relaciones vienen de la base y cuántas son manuales. Todos los casos de uso usan este mismo grafo para resolver JOIN.',
      ], { enterClick: 'data.tab_relations' }),
      st('banner', 'rel.banner', ['Banco x Manual', 'Database vs Manual', 'Base vs Manual'], [
        'Relações "Banco" vêm das chaves estrangeiras que o Agente CLI lê no banco e não podem ser editadas aqui. As "Manuais" são suas, para quando o banco não declara a chave (muito comum em sistemas legados).',
        '"Database" relationships come from the foreign keys the CLI Agent reads in the database and cannot be edited here. "Manual" ones are yours, for when the database does not declare the key (very common in legacy systems).',
        'Las relaciones "Base" vienen de las claves foráneas que el Agente CLI lee en la base y no se pueden editar aquí. Las "Manuales" son suyas, para cuando la base no declara la clave (muy común en sistemas heredados).',
      ]),
      st('cli', 'rel.cli', ['Do banco de dados', 'From the database', 'De la base de datos'], [
        'A coluna da esquerda: somente leitura, com cadeado. Se estiver vazia, rode a sincronização pelo Agente CLI para importar as chaves do banco.',
        'The left column: read only, with a lock. If it is empty, run the sync through the CLI Agent to import the database keys.',
        'La columna de la izquierda: solo lectura, con candado. Si está vacía, ejecute la sincronización por el Agente CLI para importar las claves de la base.',
      ]),
      st('row', 'rel.row', ['Como ler uma relação', 'How to read a relationship', 'Cómo leer una relación'], [
        'À esquerda a tabela e a coluna de origem (a chave estrangeira); no meio o tipo (N → 1, 1 → N, N → N ou 1 → 1); à direita a tabela e a coluna referenciadas. O selo diz se é do Banco ou Manual.',
        'On the left the source table and column (the foreign key); in the middle the type (N → 1, 1 → N, N → N or 1 → 1); on the right the referenced table and column. The badge says whether it is Database or Manual.',
        'A la izquierda la tabla y columna de origen (la clave foránea); en el medio el tipo (N → 1, 1 → N, N → N o 1 → 1); a la derecha la tabla y columna referenciadas. El sello dice si es de la Base o Manual.',
      ], { skipIfMissing: true }),
      st('manual', 'rel.manual', ['Manuais', 'Manual', 'Manuales'], [
        'A coluna da direita: as relações criadas por você. Só estas podem ser excluídas (a lixeira aparece ao passar o mouse). Excluir uma relação não mexe nos dados, só no mapa de JOINs.',
        'The right column: the relationships you created. Only these can be deleted (the trash appears when you hover). Deleting a relationship does not touch the data, only the JOINs map.',
        'La columna de la derecha: las relaciones creadas por usted. Solo estas se pueden eliminar (la papelera aparece al pasar el mouse). Eliminar una relación no toca los datos, solo el mapa de JOIN.',
      ]),
      st('refresh', 'rel.refresh', ['Atualizar', 'Refresh', 'Actualizar'], [
        'Recarrega a lista de relações, por exemplo depois de sincronizar o banco pelo Agente CLI.',
        'Reloads the relationships list, for example after syncing the database through the CLI Agent.',
        'Recarga la lista de relaciones, por ejemplo después de sincronizar la base por el Agente CLI.',
      ]),
      st('new', 'rel.new', ['Nova relação', 'New relationship', 'Nueva relación'], [
        'Clique em "Nova Relação" para abrir o formulário. Nada é criado até clicar em "Salvar Relação" lá dentro.',
        'Click "New Relationship" to open the form. Nothing is created until you click "Save Relationship" inside it.',
        'Haga clic en "Nueva Relación" para abrir el formulario. No se crea nada hasta hacer clic en "Guardar Relación" dentro de él.',
      ], {
        interactive: true,
        completeWhen: exists('rel.form'),
        waitingHint: h(['Clique em "Nova Relação" para continuar. Abrir o formulário não cria nada.', 'Click "New Relationship" to continue. Opening the form creates nothing.', 'Haga clic en "Nueva Relación" para continuar. Abrir el formulario no crea nada.']),
      }),
      st('from-model', 'rel.form_from_model', ['Tabela de origem', 'Source table', 'Tabla de origen'], [
        'A tabela que TEM a chave estrangeira. Ex.: "Pedidos", que guarda o código do cliente.',
        'The table that HAS the foreign key. E.g. "Orders", which stores the customer code.',
        'La tabla que TIENE la clave foránea. Ej.: "Pedidos", que guarda el código del cliente.',
      ], { noBack: true }),
      st('from-field', 'rel.form_from_field', ['Campo FK', 'FK field', 'Campo FK'], [
        'A coluna da origem que aponta para a outra tabela. Só habilita depois de escolher a tabela de origem. Ex.: "cliente_id".',
        'The source column that points to the other table. It only enables after picking the source table. E.g. "customer_id".',
        'La columna de origen que apunta a la otra tabla. Solo se habilita después de elegir la tabla de origen. Ej.: "cliente_id".',
      ]),
      st('to-model', 'rel.form_to_model', ['Tabela de destino', 'Target table', 'Tabla de destino'], [
        'A tabela referenciada, a "dona" do cadastro. Ex.: "Clientes".',
        'The referenced table, the "owner" of the record. E.g. "Customers".',
        'La tabla referenciada, la "dueña" del registro. Ej.: "Clientes".',
      ]),
      st('to-field', 'rel.form_to_field', ['Campo PK', 'PK field', 'Campo PK'], [
        'A coluna da tabela de destino que identifica cada registro, em geral a chave primária. Ex.: "id". A relação não pode apontar para o mesmo campo dela mesma, e uma relação repetida é recusada.',
        'The column of the target table that identifies each record, usually the primary key. E.g. "id". A relationship cannot point to the same field as itself, and a duplicate is refused.',
        'La columna de la tabla de destino que identifica cada registro, en general la clave primaria. Ej.: "id". La relación no puede apuntar al mismo campo de sí misma, y una repetida se rechaza.',
      ]),
      st('type', 'rel.form_type', ['Tipo de relação', 'Relationship type', 'Tipo de relación'], [
        'N → 1: muitos pedidos para um cliente (o caso mais comum). 1 → N: o contrário. 1 → 1: um para um. N → N: muitos para muitos (via tabela de ligação). O tipo descreve a cardinalidade da ligação.',
        'N → 1: many orders to one customer (the most common case). 1 → N: the opposite. 1 → 1: one to one. N → N: many to many (through a link table). The type describes the cardinality of the link.',
        'N → 1: muchos pedidos para un cliente (el caso más común). 1 → N: lo contrario. 1 → 1: uno a uno. N → N: muchos a muchos (por tabla de enlace). El tipo describe la cardinalidad del vínculo.',
      ]),
      st('save', 'rel.form_save', ['Salvar Relação', 'Save Relationship', 'Guardar Relación'], [
        'Cria a relação manual. O botão só habilita com as quatro escolhas feitas. Este tour não clica aqui para não criar nada sem querer: se quiser criar, preencha o formulário e clique depois.',
        'Creates the manual relationship. The button only enables with the four choices made. This tour does not click here so nothing is created by accident: if you want to create one, fill in the form and click afterwards.',
        'Crea la relación manual. El botón solo se habilita con las cuatro elecciones hechas. Este recorrido no hace clic aquí para no crear nada sin querer: si quiere crear una, complete el formulario y haga clic después.',
      ]),
      st('cancel', 'rel.form_cancel', ['Cancelar', 'Cancel', 'Cancelar'], [
        'Clique em "Cancelar" para fechar o formulário sem criar nada.',
        'Click "Cancel" to close the form without creating anything.',
        'Haga clic en "Cancelar" para cerrar el formulario sin crear nada.',
      ], {
        interactive: true,
        completeWhen: { id: 'rel.new', check: 'attr', attr: 'data-help-state', equals: 'closed' },
        waitingHint: h(['Clique em "Cancelar" para fechar o formulário e continuar.', 'Click "Cancel" to close the form and continue.', 'Haga clic en "Cancelar" para cerrar el formulario y continuar.']),
      }),
      st('done', undefined, ['Pronto', 'Done', 'Listo'], [
        'Agora ao montar um caso de uso com duas tabelas ligadas, o JOIN aparece sozinho. Se a ligação que você precisa não aparece, é porque o banco não declara a chave: crie a relação manual.',
        'Now when you build a use case with two linked tables, the JOIN shows up by itself. If the link you need does not show, it is because the database does not declare the key: create the manual relationship.',
        'Ahora al armar un caso de uso con dos tablas vinculadas, el JOIN aparece solo. Si el vínculo que necesita no aparece, es porque la base no declara la clave: cree la relación manual.',
      ], { noBack: true }),
    ],
  },
]
