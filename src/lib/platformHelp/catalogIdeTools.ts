/**
 * Tours da barra lateral do Studio e das ferramentas exclusivas da IDE Desktop: BYOC, Configurações de Bancos (JSON),
 * Terminal (PTY) e SQL Studio. Só explicam: nada é executado nem gravado.
 * Alvos: `data-help-id` de StudioSidebar (studio.rail_*) e das páginas de cada ferramenta (ide.*).
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const BASE = '/admin/:workspace/:project/studio'
const OPT = { skipIfMissing: true }

export const IDE_TOOLS_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── barra lateral ─────────────────────────
  {
    id: 'studio-barra-lateral',
    route: BASE,
    needs: 'studio.rail',
    title: h(['Barra lateral: cada área do Studio', 'Sidebar: each Studio area', 'Barra lateral: cada área del Studio']),
    summary: h(['Para que serve cada ícone, e quais são exclusivos da IDE Desktop.', 'What each icon is for, and which ones are exclusive to the Desktop IDE.', 'Para qué sirve cada ícono y cuáles son exclusivos de la IDE Desktop.']),
    steps: [
      st('rail', 'studio.rail', ['A barra lateral', 'The sidebar', 'La barra lateral'], [
        'Cada ícone abre uma área do projeto. Passe o mouse para ver o nome. Os que aparecem com o sinal de proibido estão desativados neste site porque pertencem à IDE Desktop; os de cadeado exigem o plano PRO.',
        'Each icon opens an area of the project. Hover to see the name. The ones with the prohibited sign are disabled on this site because they belong to the Desktop IDE; the ones with a lock require the PRO plan.',
        'Cada ícono abre un área del proyecto. Pase el mouse para ver el nombre. Los que tienen la señal de prohibido están desactivados en este sitio porque pertenecen a la IDE Desktop; los de candado exigen el plan PRO.',
      ]),
      st('dashboard', 'studio.rail_dashboard', ['Dashboard', 'Dashboard', 'Dashboard'], [
        'O painel do Studio: casos de uso, navegação, enums, túnel, bancos sincronizados e a Central de Ajuda.',
        'The Studio panel: use cases, navigation, enums, tunnel, synced databases and the Help Center.',
        'El panel del Studio: casos de uso, navegación, enums, túnel, bases sincronizadas y el Centro de Ayuda.',
      ], OPT),
      st('data', 'studio.rail_data', ['Dados & Schemas', 'Data & Schemas', 'Datos y Esquemas'], [
        'A camada de negócio sobre as tabelas do banco: nomes, permissões, auditoria, acesso por linha e relacionamentos.',
        'The business layer over the database tables: names, permissions, audit, row access and relationships.',
        'La capa de negocio sobre las tablas de la base: nombres, permisos, auditoría, acceso por fila y relaciones.',
      ], OPT),
      st('auth', 'studio.rail_auth', ['Autenticação', 'Authentication', 'Autenticación'], [
        'Como os usuários do app entram: estratégia de login, usuários, grupos e permissões por tela. Plano PRO.',
        'How the app users sign in: login strategy, users, groups and per-screen permissions. PRO plan.',
        'Cómo entran los usuarios de la app: estrategia de login, usuarios, grupos y permisos por pantalla. Plan PRO.',
      ], OPT),
      st('byoc', 'studio.rail_byoc', ['BYOC', 'BYOC', 'BYOC'], [
        'Traga seu próprio componente: código React escrito à mão, que entra na exportação final. Exclusivo da IDE Desktop.',
        'Bring your own component: hand-written React code that goes into the final export. Exclusive to the Desktop IDE.',
        'Traiga su propio componente: código React escrito a mano, que entra en la exportación final. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('settings', 'studio.rail_settings', ['Configurações', 'Settings', 'Configuraciones'], [
        'Padrões dos campos do projeto, propagação dos padrões e campos calculados.',
        'Project field defaults, defaults propagation and calculated fields.',
        'Valores por defecto de los campos del proyecto, propagación de los valores y campos calculados.',
      ], OPT),
      st('json', 'studio.rail_json', ['Configurações de Bancos (JSON)', 'Database Settings (JSON)', 'Configuraciones de Bases (JSON)'], [
        'Gera o arquivo metabuilder.config.json com as conexões dos bancos do cliente e os dados do túnel. Exclusivo da IDE Desktop.',
        'Generates the metabuilder.config.json file with the customer database connections and the tunnel data. Exclusive to the Desktop IDE.',
        'Genera el archivo metabuilder.config.json con las conexiones de las bases del cliente y los datos del túnel. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('terminal', 'studio.rail_terminal', ['Terminal (PTY)', 'Terminal (PTY)', 'Terminal (PTY)'], [
        'Um terminal real dentro do Studio, para rodar comandos no seu computador. Exclusivo da IDE Desktop.',
        'A real terminal inside the Studio, to run commands on your computer. Exclusive to the Desktop IDE.',
        'Un terminal real dentro del Studio, para ejecutar comandos en su computador. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
      st('logs', 'studio.rail_logs', ['Logs do Sistema', 'System Logs', 'Logs del Sistema'], [
        'O registro do que acontece nos apps do projeto: configurar, filtrar e ler cada registro. Plano PRO.',
        'The record of what happens in the project apps: configure, filter and read each record. PRO plan.',
        'El registro de lo que ocurre en las apps del proyecto: configurar, filtrar y leer cada registro. Plan PRO.',
      ], OPT),
      st('sql', 'studio.rail_sql', ['SQL Studio', 'SQL Studio', 'SQL Studio'], [
        'Execute consultas SQL direto no banco do cliente, pelo túnel. Exclusivo da IDE Desktop.',
        'Run SQL queries directly on the customer database, through the tunnel. Exclusive to the Desktop IDE.',
        'Ejecute consultas SQL directo en la base del cliente, por el túnel. Exclusivo de la IDE Desktop.',
      ], { ...OPT, ideOnly: true }),
    ],
  },

  // ───────────────────────── BYOC ─────────────────────────
  {
    id: 'ide-byoc',
    route: `${BASE}/byoc`,
    title: h(['BYOC: seus componentes', 'BYOC: your components', 'BYOC: sus componentes']),
    summary: h(['Criar, editar e excluir componentes React próprios que entram na exportação.', 'Create, edit and delete your own React components that go into the export.', 'Crear, editar y eliminar componentes React propios que entran en la exportación.']),
    neverClick: ['ide.byoc_delete'],
    steps: [
      st('new', 'ide.byoc_new', ['Novo componente', 'New component', 'Nuevo componente'], [
        'BYOC é "traga seu próprio componente": você escreve código React livremente e o MetaBuilder o injeta no app na exportação final. Este botão abre o editor de código em tela cheia, com nome, descrição e o código; nada é gravado até salvar.',
        'BYOC is "bring your own component": you write React code freely and MetaBuilder injects it into the app on the final export. This button opens the full-screen code editor, with name, description and the code; nothing is saved until you save.',
        'BYOC es "traiga su propio componente": usted escribe código React libremente y MetaBuilder lo inyecta en la app en la exportación final. Este botón abre el editor de código a pantalla completa, con nombre, descripción y el código; no se graba nada hasta guardar.',
      ], OPT),
      st('list', 'ide.byoc_list', ['Seus componentes', 'Your components', 'Sus componentes'], [
        'Cada cartão é um componente, com nome e descrição. Quando não há nenhum, a tela convida a criar o primeiro.',
        'Each card is a component, with name and description. When there is none, the screen invites you to create the first one.',
        'Cada tarjeta es un componente, con nombre y descripción. Cuando no hay ninguno, la pantalla invita a crear el primero.',
      ]),
      st('edit', 'ide.byoc_edit', ['Editar código', 'Edit code', 'Editar código'], [
        'Abre o componente no editor. Dentro dele, "Salvar Componente" compila e grava, "Cancelar" fecha sem gravar e, na IDE, "Vincular Arquivo" liga o componente a um arquivo do seu computador: o que você salva lá é sincronizado e compilado sozinho.',
        'Opens the component in the editor. Inside it, "Save Component" compiles and stores, "Cancel" closes without saving and, in the IDE, "Link File" ties the component to a file on your computer: what you save there is synced and compiled by itself.',
        'Abre el componente en el editor. Dentro, "Guardar Componente" compila y graba, "Cancelar" cierra sin grabar y, en la IDE, "Vincular Archivo" liga el componente a un archivo de su computador: lo que guarde allí se sincroniza y compila solo.',
      ], OPT),
      st('delete', 'ide.byoc_delete', ['Excluir', 'Delete', 'Eliminar'], [
        'Exclui o componente. Confira antes: casos de uso que o usam deixam de funcionar.',
        'Deletes the component. Check first: use cases that use it stop working.',
        'Elimina el componente. Verifique antes: los casos de uso que lo usan dejan de funcionar.',
      ], OPT),
    ],
  },

  // ───────────────────────── Configurações de Bancos (JSON) ─────────────────────────
  {
    id: 'ide-json',
    route: `${BASE}/tunnel`,
    title: h(['Configurações de Bancos (JSON)', 'Database Settings (JSON)', 'Configuraciones de Bases (JSON)']),
    summary: h(['O metabuilder.config.json: projeto, conexões dos bancos, LDAP e pastas do túnel.', 'The metabuilder.config.json: project, database connections, LDAP and tunnel folders.', 'El metabuilder.config.json: proyecto, conexiones de las bases, LDAP y carpetas del túnel.']),
    steps: [
      st('header', 'ide.json_header', ['O arquivo de configuração', 'The configuration file', 'El archivo de configuración'], [
        'Esta tela monta o metabuilder.config.json, que o túnel lê para saber a quais bancos se conectar. Ele guarda dados sensíveis do ambiente, por isso fica no seu computador, nunca no site.',
        'This screen builds the metabuilder.config.json, which the tunnel reads to know which databases to connect to. It holds sensitive environment data, so it stays on your computer, never on the site.',
        'Esta pantalla arma el metabuilder.config.json, que el túnel lee para saber a qué bases conectarse. Guarda datos sensibles del entorno, por eso queda en su computador, nunca en el sitio.',
      ], OPT),
      st('auth', 'ide.json_auth', ['Autenticação do projeto', 'Project authentication', 'Autenticación del proyecto'], [
        'O Project ID e o Secret Token identificam qual projeto o túnel atende. Vêm preenchidos sozinhos. Trate o token como uma senha: não o cole em chats nem em repositórios.',
        'The Project ID and the Secret Token identify which project the tunnel serves. They come filled in by themselves. Treat the token as a password: do not paste it in chats or repositories.',
        'El Project ID y el Secret Token identifican qué proyecto atiende el túnel. Vienen completados solos. Trate el token como una contraseña: no lo pegue en chats ni en repositorios.',
      ], OPT),
      st('conns', 'ide.json_conns', ['Conexões de banco de dados', 'Database connections', 'Conexiones de base de datos'], [
        'Cadastre os bancos ligados a este projeto (por exemplo, o principal e o financeiro). Cada conexão tem o tipo de banco (PostgreSQL ou Oracle), o endereço e as credenciais. "Adicionar Banco" cria uma conexão nova.',
        'Register the databases tied to this project (for example, the main one and the financial one). Each connection has the database type (PostgreSQL or Oracle), the address and the credentials. "Add Database" creates a new connection.',
        'Registre las bases ligadas a este proyecto (por ejemplo, la principal y la financiera). Cada conexión tiene el tipo de base (PostgreSQL u Oracle), la dirección y las credenciales. "Agregar Base" crea una conexión nueva.',
      ], OPT),
      st('ldap', 'ide.json_ldap', ['Autenticação corporativa (LDAP)', 'Corporate authentication (LDAP)', 'Autenticación corporativa (LDAP)'], [
        'Integração opcional com o Active Directory, para que os usuários da empresa entrem com o login corporativo.',
        'Optional integration with Active Directory, so company users sign in with their corporate login.',
        'Integración opcional con Active Directory, para que los usuarios de la empresa entren con su login corporativo.',
      ], OPT),
      st('dirs', 'ide.json_dirs', ['Diretórios do sistema', 'System directories', 'Directorios del sistema'], [
        'Caminhos no seu computador usados pelo túnel, como a pasta de downloads.',
        'Paths on your computer used by the tunnel, such as the downloads folder.',
        'Rutas en su computador usadas por el túnel, como la carpeta de descargas.',
      ], OPT),
      st('save', 'ide.json_save', ['Salvar configurações', 'Save settings', 'Guardar configuraciones'], [
        'Grava o arquivo no seu computador. Depois, reinicie o túnel (aba Gerenciador do Túnel do Studio) para ele ler a configuração nova.',
        'Stores the file on your computer. Then restart the tunnel (Tunnel Manager tab of the Studio) so it reads the new configuration.',
        'Graba el archivo en su computador. Después, reinicie el túnel (pestaña Gestor del Túnel del Studio) para que lea la configuración nueva.',
      ], OPT),
    ],
  },

  // ───────────────────────── Terminal ─────────────────────────
  {
    id: 'ide-terminal',
    route: `${BASE}/terminal`,
    title: h(['Terminal integrado (PTY)', 'Integrated terminal (PTY)', 'Terminal integrado (PTY)']),
    summary: h(['Um terminal real dentro do Studio, para o dia a dia de comandos do projeto.', 'A real terminal inside the Studio, for the day-to-day commands of the project.', 'Un terminal real dentro del Studio, para los comandos del día a día del proyecto.']),
    steps: [
      st('header', 'ide.term_header', ['O terminal', 'The terminal', 'El terminal'], [
        'É um terminal de verdade (PTY nativo) rodando no seu computador, dentro do Studio. Serve para comandos como git, npm ou rodar o app ejetado, sem sair da IDE.',
        'It is a real terminal (native PTY) running on your computer, inside the Studio. It serves commands like git, npm or running the ejected app, without leaving the IDE.',
        'Es un terminal de verdad (PTY nativo) corriendo en su computador, dentro del Studio. Sirve para comandos como git, npm o ejecutar la app eyectada, sin salir de la IDE.',
      ], OPT),
      st('area', 'ide.term_area', ['A área de comandos', 'The command area', 'El área de comandos'], [
        'Clique aqui e digite. Tudo o que você executa vale de verdade na sua máquina, com as suas permissões: tenha o mesmo cuidado que teria em um terminal comum.',
        'Click here and type. Everything you run is real on your machine, with your permissions: take the same care you would in a regular terminal.',
        'Haga clic aquí y escriba. Todo lo que ejecute vale de verdad en su máquina, con sus permisos: tenga el mismo cuidado que tendría en un terminal común.',
      ], OPT),
    ],
  },

  // ───────────────────────── SQL Studio ─────────────────────────
  {
    id: 'ide-sql',
    route: `${BASE}/sql`,
    title: h(['SQL Studio', 'SQL Studio', 'SQL Studio']),
    summary: h(['Escrever e executar SQL no banco do cliente pelo túnel e ler o resultado.', 'Write and run SQL on the customer database through the tunnel and read the result.', 'Escribir y ejecutar SQL en la base del cliente por el túnel y leer el resultado.']),
    neverClick: ['ide.sql_run'],
    steps: [
      st('header', 'ide.sql_header', ['O SQL Studio', 'The SQL Studio', 'El SQL Studio'], [
        'Executa SQL direto no banco do cliente, de forma nativa pelo túnel. O túnel (Agente CLI) precisa estar rodando; se não responder, aparece um aviso de tempo esgotado.',
        'Runs SQL directly on the customer database, natively through the tunnel. The tunnel (CLI Agent) must be running; if it does not answer, a timeout notice shows.',
        'Ejecuta SQL directo en la base del cliente, de forma nativa por el túnel. El túnel (Agente CLI) debe estar corriendo; si no responde, aparece un aviso de tiempo agotado.',
      ], OPT),
      st('editor', 'ide.sql_editor', ['O editor', 'The editor', 'El editor'], [
        'Escreva a consulta aqui, com destaque de sintaxe. Comandos que alteram dados (INSERT, UPDATE, DELETE) valem de verdade no banco do cliente: confira antes de executar.',
        'Write the query here, with syntax highlighting. Commands that change data (INSERT, UPDATE, DELETE) are real on the customer database: check before running.',
        'Escriba la consulta aquí, con resaltado de sintaxis. Los comandos que cambian datos (INSERT, UPDATE, DELETE) valen de verdad en la base del cliente: verifique antes de ejecutar.',
      ], OPT),
      st('run', 'ide.sql_run', ['Executar', 'Run', 'Ejecutar'], [
        'Roda a consulta (atalho: Ctrl + Enter). Durante a execução o botão mostra um indicador de carregamento.',
        'Runs the query (shortcut: Ctrl + Enter). While running, the button shows a loading indicator.',
        'Ejecuta la consulta (atajo: Ctrl + Enter). Durante la ejecución el botón muestra un indicador de carga.',
      ], OPT),
      st('results', 'ide.sql_results', ['Resultados', 'Results', 'Resultados'], [
        'Em consultas de leitura, mostra a tabela com a contagem de linhas; em comandos que alteram dados, as linhas afetadas. Valores vazios aparecem como null. Em caso de erro, a mensagem do banco aparece aqui.',
        'On read queries, shows the table with the row count; on commands that change data, the affected rows. Empty values show as null. On error, the database message shows here.',
        'En consultas de lectura, muestra la tabla con el conteo de filas; en comandos que cambian datos, las filas afectadas. Los valores vacíos aparecen como null. En caso de error, el mensaje de la base aparece aquí.',
      ], OPT),
      st('back', 'ide.sql_back', ['Voltar ao Studio', 'Back to Studio', 'Volver al Studio'], [
        'Leva de volta ao painel do Studio.',
        'Takes you back to the Studio panel.',
        'Lleva de vuelta al panel del Studio.',
      ], OPT),
    ],
  },
]
