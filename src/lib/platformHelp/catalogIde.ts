/**
 * Tours da IDE Local (exclusiva da IDE Desktop) e do Ejetar & Sincronizar. Abrem pelo ícone de ajuda do cabeçalho da própria IDE
 * (rota "virtual" /ide-local). Só explicam: nada é executado, enviado ao Git nem gravado.
 * Alvos: `data-help-id` ide.* de IDEHeader, IDEFileExplorer, IDEEditorArea e IDEConsolePanel.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const IDE = '/ide-local'
const OPT = { skipIfMissing: true }
const GIT_NEVER = ['ide.btn_commit', 'ide.btn_push', 'ide.btn_pull', 'ide.btn_history', 'ide.btn_gitsettings', 'ide.btn_sync', 'ide.btn_delivery', 'ide.btn_tests', 'ide.btn_close']

export const IDE_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── visão geral da IDE Local ─────────────────────────
  {
    id: 'ide-local-visao-geral',
    route: IDE,
    neverClick: GIT_NEVER,
    title: h(['IDE Local: visão geral', 'Local IDE: overview', 'IDE Local: visión general']),
    summary: h(['O cabeçalho, o explorador de arquivos, o editor e o console, e para que serve cada botão.', 'The header, the file explorer, the editor and the console, and what each button is for.', 'El encabezado, el explorador de archivos, el editor y la consola, y para qué sirve cada botón.']),
    steps: [
      st('title', 'ide.title', ['A IDE Local', 'The Local IDE', 'La IDE Local'], [
        'A IDE Local trabalha com o código do projeto (ou do workspace) em uma pasta do seu computador: você sincroniza o app gerado, edita o código, usa o Git e testa. O nome ao lado mostra com o que você está trabalhando.',
        'The Local IDE works with the code of the project (or workspace) in a folder on your computer: you sync the generated app, edit the code, use Git and test. The name next to it shows what you are working on.',
        'La IDE Local trabaja con el código del proyecto (o del workspace) en una carpeta de su computador: sincroniza la app generada, edita el código, usa Git y prueba. El nombre al lado muestra con qué está trabajando.',
      ]),
      st('folder', 'ide.folder', ['Pasta do projeto', 'Project folder', 'Carpeta del proyecto'], [
        'Mostra e troca a pasta local onde o app fica. Ao trocar para outra pasta, a IDE avisa se ela já tem outro projeto e oferece continuar a sincronização lá.',
        'Shows and switches the local folder where the app lives. When switching to another folder, the IDE warns if it already has another project and offers to continue the sync there.',
        'Muestra y cambia la carpeta local donde vive la app. Al cambiar a otra carpeta, la IDE avisa si ya tiene otro proyecto y ofrece continuar la sincronización allí.',
      ], OPT),
      st('branch', 'ide.branch', ['Branch do Git', 'Git branch', 'Rama de Git'], [
        'A branch em que você está. Escolha outra para trocar, ou "+ Nova Branch..." para criar uma.',
        'The branch you are on. Pick another to switch, or "+ New Branch..." to create one.',
        'La rama en la que está. Elija otra para cambiar, o "+ Nueva Rama..." para crear una.',
      ], OPT),
      st('delivery', 'ide.btn_delivery', ['Entrega', 'Delivery', 'Entrega'], [
        'Gera uma cópia limpa do projeto sincronizado, sem Git nem segredos, em pasta ou ZIP, pronta para entregar ao cliente. Só fica ativo depois de sincronizar.',
        'Generates a clean copy of the synced project, without Git or secrets, in a folder or ZIP, ready to hand to the customer. It is only enabled after syncing.',
        'Genera una copia limpia del proyecto sincronizado, sin Git ni secretos, en carpeta o ZIP, lista para entregar al cliente. Solo se activa después de sincronizar.',
      ], OPT),
      st('sync', 'ide.btn_sync', ['Sincronizar', 'Sync', 'Sincronizar'], [
        'Abre a janela de configuração do Ejetar & Sincronizar: você escolhe a stack (Node.js ou Java Spring) e a IDE gera o app na pasta. Há um tour só para essa janela.',
        'Opens the Eject & Sync configuration window: you pick the stack (Node.js or Java Spring) and the IDE generates the app in the folder. There is a tour just for that window.',
        'Abre la ventana de configuración de Eyectar y Sincronizar: elige el stack (Node.js o Java Spring) y la IDE genera la app en la carpeta. Hay un tour solo para esa ventana.',
      ], OPT),
      st('tests', 'ide.btn_tests', ['Ambiente de Testes', 'Test Environment', 'Entorno de Pruebas'], [
        'Abre o ambiente para testar o app sincronizado. Só libera depois de sincronizar o projeto na IDE (pasta em AGTech\\MetaBuilderPRO).',
        'Opens the environment to test the synced app. It is only enabled after the project is synced in the IDE (folder in AGTech\\MetaBuilderPRO).',
        'Abre el entorno para probar la app sincronizada. Solo se habilita después de sincronizar el proyecto en la IDE (carpeta en AGTech\\MetaBuilderPRO).',
      ], OPT),
      st('theme', 'ide.theme', ['Tema e idioma', 'Theme and language', 'Tema e idioma'], [
        'Claro ou escuro e o idioma da interface. Valem para todas as janelas do aplicativo.',
        'Light or dark and the interface language. They apply to all windows of the application.',
        'Claro u oscuro y el idioma de la interfaz. Valen para todas las ventanas de la aplicación.',
      ], OPT),
      st('console-btn', 'ide.btn_console', ['Console', 'Console', 'Consola'], [
        'Mostra ou oculta o painel de console, na parte de baixo, com o que a IDE está fazendo.',
        'Shows or hides the console panel, at the bottom, with what the IDE is doing.',
        'Muestra u oculta el panel de consola, en la parte de abajo, con lo que hace la IDE.',
      ], OPT),
      st('files-btn', 'ide.btn_files', ['Arquivos', 'Files', 'Archivos'], [
        'Mostra ou oculta o explorador de arquivos, à esquerda.',
        'Shows or hides the file explorer, on the left.',
        'Muestra u oculta el explorador de archivos, a la izquierda.',
      ], OPT),
      st('help', 'ide.help', ['Ajuda', 'Help', 'Ayuda'], [
        'Este ícone abre o menu com os tours da IDE: esta visão geral, o Git e o Ejetar & Sincronizar.',
        'This icon opens the menu with the IDE tours: this overview, Git and Eject & Sync.',
        'Este ícono abre el menú con los tours de la IDE: esta visión general, Git y Eyectar y Sincronizar.',
      ], OPT),
      st('minimize', 'ide.btn_minimize', ['Minimizar', 'Minimize', 'Minimizar'], [
        'Recolhe a IDE para uma barra pequena, sem fechar: o que estava aberto continua como está.',
        'Collapses the IDE to a small bar, without closing: what was open stays as it is.',
        'Recoge la IDE a una barra pequeña, sin cerrar: lo que estaba abierto sigue como está.',
      ], OPT),
      st('close', 'ide.btn_close', ['Fechar', 'Close', 'Cerrar'], [
        'Fecha a IDE Local.',
        'Closes the Local IDE.',
        'Cierra la IDE Local.',
      ], OPT),
      st('explorer', 'ide.explorer', ['Explorador de arquivos', 'File explorer', 'Explorador de archivos'], [
        'A árvore de arquivos do app sincronizado. A aba Lixeira guarda o que você apagou, para recuperar. Projetos Java mostram o selo Spring.',
        'The file tree of the synced app. The Trash tab keeps what you deleted, so you can recover it. Java projects show the Spring badge.',
        'El árbol de archivos de la app sincronizada. La pestaña Papelera guarda lo que borró, para recuperarlo. Los proyectos Java muestran la insignia Spring.',
      ], OPT),
      st('editor', 'ide.editor', ['Editor de código', 'Code editor', 'Editor de código'], [
        'Abas com os arquivos abertos e o editor de código. Mantenha Ctrl pressionado sobre um nome para ir à definição.',
        'Tabs with the open files and the code editor. Hold Ctrl over a name to go to its definition.',
        'Pestañas con los archivos abiertos y el editor de código. Mantenga Ctrl sobre un nombre para ir a su definición.',
      ], OPT),
      st('console', 'ide.console', ['Console da IDE', 'IDE console', 'Consola de la IDE'], [
        'Mostra o que a IDE e o app estão fazendo. O modo Resumido esconde as consultas SQL e conexões internas; o Detalhado mostra consultas, parâmetros e eventos de conexão do banco.',
        'Shows what the IDE and the app are doing. Summary mode hides SQL queries and internal connections; Detailed shows queries, parameters and database connection events.',
        'Muestra lo que hacen la IDE y la app. El modo Resumido oculta las consultas SQL y conexiones internas; el Detallado muestra consultas, parámetros y eventos de conexión de la base.',
      ], OPT),
    ],
  },

  // ───────────────────────── Git na IDE ─────────────────────────
  {
    id: 'ide-local-git',
    route: IDE,
    neverClick: GIT_NEVER,
    title: h(['Git: commit, push, pull e histórico', 'Git: commit, push, pull and history', 'Git: commit, push, pull e historial']),
    summary: h(['Os botões de Git do cabeçalho, para controlar as versões do app sincronizado.', 'The Git buttons in the header, to control the versions of the synced app.', 'Los botones de Git del encabezado, para controlar las versiones de la app sincronizada.']),
    steps: [
      st('branch', 'ide.branch', ['Branch', 'Branch', 'Rama'], [
        'Tudo o que vem a seguir acontece na branch escolhida aqui.',
        'Everything that follows happens on the branch chosen here.',
        'Todo lo que sigue ocurre en la rama elegida aquí.',
      ], OPT),
      st('commit', 'ide.btn_commit', ['Commit', 'Commit', 'Commit'], [
        'Registra no Git local as mudanças feitas nos arquivos, com uma mensagem. Abre uma janela para revisar os arquivos e escrever a mensagem. É local: nada vai para o remoto ainda.',
        'Records in the local Git the changes made to the files, with a message. Opens a window to review the files and write the message. It is local: nothing goes to the remote yet.',
        'Registra en el Git local los cambios hechos en los archivos, con un mensaje. Abre una ventana para revisar los archivos y escribir el mensaje. Es local: nada va al remoto todavía.',
      ], OPT),
      st('push', 'ide.btn_push', ['Push', 'Push', 'Push'], [
        'Envia os commits da branch para o repositório remoto (GitHub). Exige que o remoto esteja configurado na engrenagem ao lado.',
        'Sends the branch commits to the remote repository (GitHub). It requires the remote to be set up in the gear next to it.',
        'Envía los commits de la rama al repositorio remoto (GitHub). Exige que el remoto esté configurado en el engranaje de al lado.',
      ], OPT),
      st('pull', 'ide.btn_pull', ['Pull', 'Pull', 'Pull'], [
        'Traz do repositório remoto o que outras pessoas enviaram para a branch.',
        'Brings from the remote repository what other people sent to the branch.',
        'Trae del repositorio remoto lo que otras personas enviaron a la rama.',
      ], OPT),
      st('history', 'ide.btn_history', ['Histórico', 'History', 'Historial'], [
        'Mostra o histórico de commits (git log) da branch.',
        'Shows the commit history (git log) of the branch.',
        'Muestra el historial de commits (git log) de la rama.',
      ], OPT),
      st('settings', 'ide.btn_gitsettings', ['Configurações Git', 'Git settings', 'Configuraciones de Git'], [
        'Define o remoto (endereço do repositório) e o pipeline. É a primeira coisa a configurar para poder usar Push e Pull.',
        'Defines the remote (repository address) and the pipeline. It is the first thing to set up to be able to use Push and Pull.',
        'Define el remoto (dirección del repositorio) y el pipeline. Es lo primero que se configura para poder usar Push y Pull.',
      ], OPT),
    ],
  },

  // ───────────────────────── Ejetar & Sincronizar ─────────────────────────
  {
    id: 'ide-ejetar',
    route: IDE,
    neverClick: ['ide.eject_confirm'],
    cleanupClick: ['ide.eject_cancel'],
    title: h(['Ejetar & Sincronizar', 'Eject & Sync', 'Eyectar y Sincronizar']),
    summary: h(['Gerar o app (Node.js ou Java Spring) do projeto em uma pasta e mantê-lo sincronizado.', 'Generate the project app (Node.js or Java Spring) in a folder and keep it in sync.', 'Generar la app (Node.js o Java Spring) del proyecto en una carpeta y mantenerla sincronizada.']),
    steps: [
      st('button', 'ide.btn_sync', ['O botão Sincronizar', 'The Sync button', 'El botón Sincronizar'], [
        'Ejetar é transformar a configuração do projeto em código de verdade, que roda sem o MetaBuilder. Este botão abre a janela de configuração. Nada é gerado até confirmar lá.',
        'Ejecting is turning the project configuration into real code, which runs without MetaBuilder. This button opens the configuration window. Nothing is generated until you confirm there.',
        'Eyectar es transformar la configuración del proyecto en código de verdad, que corre sin MetaBuilder. Este botón abre la ventana de configuración. No se genera nada hasta confirmar allí.',
      ], OPT),
      st('header', 'ide.eject_header', ['A janela de configuração', 'The configuration window', 'La ventana de configuración'], [
        'Abrimos a janela por você, sem gerar nada. Aqui você configura a stack, os componentes e a arquitetura do backend.',
        'We opened the window for you, without generating anything. Here you configure the stack, the components and the backend architecture.',
        'Abrimos la ventana por usted, sin generar nada. Aquí configura el stack, los componentes y la arquitectura del backend.',
      ], { ...OPT, enterClick: 'ide.btn_sync', backClick: 'ide.eject_cancel' }),
      st('lang', 'ide.eject_lang', ['Idioma do código gerado', 'Generated code language', 'Idioma del código generado'], [
        'Escolha o idioma em que o app gerado será criado. O padrão segue o idioma da IDE.',
        'Pick the language the generated app will be created in. The default follows the IDE language.',
        'Elija el idioma en que se creará la app generada. El valor por defecto sigue el idioma de la IDE.',
      ], OPT),
      st('tabs', 'ide.eject_tabs', ['Escolha a stack', 'Pick the stack', 'Elija el stack'], [
        'Node.js e Java Spring estão disponíveis (Java em beta). As demais (NestJS, Python, C#, PHP, Go, Rails) aparecem como "em breve" ou roadmap, e dá para pedir aviso quando saírem.',
        'Node.js and Java Spring are available (Java in beta). The others (NestJS, Python, C#, PHP, Go, Rails) show as "coming soon" or roadmap, and you can ask to be notified when they are out.',
        'Node.js y Java Spring están disponibles (Java en beta). Las demás (NestJS, Python, C#, PHP, Go, Rails) aparecen como "próximamente" o roadmap, y se puede pedir aviso cuando salgan.',
      ], OPT),
      st('content', 'ide.eject_content', ['Configuração da stack', 'Stack configuration', 'Configuración del stack'], [
        'Node.js: a autenticação e o banco do projeto entram sozinhos (auto-detectados), mais o nome e o slug. Java Spring: banco e conexão, base (versão do JDK e porta), segurança (JWT e hash da senha), migrations (Flyway), testes automatizados, Docker (Dockerfile, docker-compose, .env.example) e documentação (Swagger e README). Em projetos com login por banco, dá para exportar também a gestão de acesso (usuários, grupos e permissões).',
        'Node.js: the project authentication and database come in by themselves (auto-detected), plus the name and slug. Java Spring: database and connection, base (JDK version and port), security (JWT and password hash), migrations (Flyway), automated tests, Docker (Dockerfile, docker-compose, .env.example) and documentation (Swagger and README). In projects with database login, you can also export access management (users, groups and permissions).',
        'Node.js: la autenticación y la base del proyecto entran solas (autodetectadas), más el nombre y el slug. Java Spring: base y conexión, base (versión del JDK y puerto), seguridad (JWT y hash de la contraseña), migrations (Flyway), pruebas automatizadas, Docker (Dockerfile, docker-compose, .env.example) y documentación (Swagger y README). En proyectos con login por base, también se puede exportar la gestión de acceso (usuarios, grupos y permisos).',
      ], OPT),
      st('confirm', 'ide.eject_confirm', ['Sincronizar Repositório', 'Sync Repository', 'Sincronizar Repositorio'], [
        'Gera o app na pasta local com a configuração escolhida. Depois, o botão Sincronizar do cabeçalho repete a operação para trazer as mudanças do projeto. O tour fecha a janela sozinho ao terminar, sem gerar nada.',
        'Generates the app in the local folder with the chosen configuration. Afterwards, the Sync button in the header repeats the operation to bring the project changes. The tour closes the window by itself when it ends, without generating anything.',
        'Genera la app en la carpeta local con la configuración elegida. Después, el botón Sincronizar del encabezado repite la operación para traer los cambios del proyecto. El tour cierra la ventana solo al terminar, sin generar nada.',
      ], OPT),
    ],
  },
]
