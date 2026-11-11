/**
 * Tours das janelas da IDE Local que ainda não tinham tour próprio: Entrega, Commit (revisão das alterações), Histórico do Git e Ambiente de Testes.
 * Só explicam: cada um abre a janela por você (`enterClick`), passa pelas partes e fecha no fim (`cleanupClick`). Nunca clicam em "Gerar entrega",
 * "Confirmar Commit" nem em "Executar testes"; as áreas que alterariam algo (editor de diferenças, troca de branch, reverter) ficam só para leitura.
 * Alvos: `data-help-id` ide.deliv_*, ide.commit_*, ide.merge_*, ide.hist_*, ide.test_* e portal.test_close.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const IDE = '/ide-local'
const OPT = { skipIfMissing: true }

export const IDE_WINDOWS_TOURS: readonly PlatformTour[] = [
  // ───────────────────────── Entrega ─────────────────────────
  {
    id: 'ide-entrega',
    route: IDE,
    needs: 'ide.btn_delivery',
    neverClick: ['ide.deliv_generate'],
    cleanupClick: ['ide.deliv_cancel'],
    title: h(['Entrega (cópia limpa para publicar)', 'Delivery (clean copy to publish)', 'Entrega (copia limpia para publicar)']),
    summary: h(['A janela que gera uma cópia limpa do app, sem Git e sem segredos: código-fonte, pacote Docker ou pacote compilado.', 'The window that generates a clean copy of the app, with no Git and no secrets: source code, Docker package or compiled package.', 'La ventana que genera una copia limpia de la app, sin Git y sin secretos: código fuente, paquete Docker o paquete compilado.']),
    steps: [
      st('button', 'ide.btn_delivery', ['O botão Entrega', 'The Delivery button', 'El botón Entrega'], [
        'Gera uma cópia limpa do app para entregar ao cliente ou publicar num servidor. O botão só fica ativo quando o projeto já foi sincronizado (a pasta tem o app) e não há merge pendente. Abrimos a janela por você no próximo passo; nada é gerado.',
        'Generates a clean copy of the app to hand to the customer or publish on a server. The button is only enabled once the project is synced (the folder has the app) and no merge is pending. We open the window for you in the next step; nothing is generated.',
        'Genera una copia limpia de la app para entregar al cliente o publicar en un servidor. El botón solo se activa cuando el proyecto ya fue sincronizado (la carpeta tiene la app) y no hay merge pendiente. Abrimos la ventana por usted en el próximo paso; no se genera nada.',
      ], { ...OPT, readOnly: true }),
      st('header', 'ide.deliv_header', ['A janela de Entrega', 'The Delivery window', 'La ventana de Entrega'], [
        'A Entrega parte da pasta sincronizada do projeto, com as suas edições. Escolha o que gerar, o formato e o destino. Nada vai para o Git nem para o Studio.',
        'Delivery starts from the synced project folder, with your edits. Choose what to generate, the format and the destination. Nothing goes to Git or to the Studio.',
        'La Entrega parte de la carpeta sincronizada del proyecto, con sus ediciones. Elija qué generar, el formato y el destino. Nada va a Git ni al Studio.',
      ], { ...OPT, enterClick: 'ide.btn_delivery', backClick: 'ide.deliv_cancel' }),
      st('source', 'ide.deliv_source', ['De onde vem o código', 'Where the code comes from', 'De dónde viene el código'], [
        'Sempre da pasta do projeto na IDE (em AGTech\\MetaBuilderPRO), no estado atual: vale inclusive o que ainda não foi commitado. Se a pasta ainda não tem o app, a janela avisa para usar Sincronizar primeiro.',
        'Always from the project folder in the IDE (in AGTech\\MetaBuilderPRO), as it is now: it includes what has not been committed yet. If the folder does not have the app yet, the window tells you to use Sync first.',
        'Siempre de la carpeta del proyecto en la IDE (en AGTech\\MetaBuilderPRO), en su estado actual: vale incluso lo que aún no se commiteó. Si la carpeta aún no tiene la app, la ventana avisa que use Sincronizar primero.',
      ], OPT),
      st('kinds', 'ide.deliv_kinds', ['O que gerar', 'What to generate', 'Qué generar'], [
        'Marque um ou mais: Código-fonte limpo (para continuar o desenvolvimento em outro lugar), Pacote Docker (com Dockerfile, compose de produção com HTTPS e o manual DEPLOY.md) e Pacote compilado sem Docker (já compilado, para servidor Windows ou Linux, com scripts de início e o manual LEIA-ME.md; a IDE compila no seu computador e leva alguns minutos). Pode clicar nas opções: nada é gerado.',
        'Tick one or more: Clean source code (to continue development elsewhere), Docker package (with Dockerfile, production compose with HTTPS and the DEPLOY.md manual) and Compiled package without Docker (already compiled, for a Windows or Linux server, with start scripts and the LEIA-ME.md manual; the IDE compiles on your computer and takes a few minutes). You can click the options: nothing is generated.',
        'Marque uno o más: Código fuente limpio (para continuar el desarrollo en otro lugar), Paquete Docker (con Dockerfile, compose de producción con HTTPS y el manual DEPLOY.md) y Paquete compilado sin Docker (ya compilado, para servidor Windows o Linux, con scripts de inicio y el manual LEIA-ME.md; la IDE compila en su computador y tarda unos minutos). Puede hacer clic en las opciones: no se genera nada.',
      ], { ...OPT, interactive: true }),
      st('format', 'ide.deliv_format', ['Formato: pasta ou ZIP', 'Format: folder or ZIP', 'Formato: carpeta o ZIP'], [
        'Pasta: você escolhe a pasta base e a entrega vai para uma subpasta com o mesmo nome da pasta do Sincronizar. ZIP: um arquivo único, sugerido como nome-entrega.zip. Com vários tipos marcados, cada um vai para a sua subpasta (codigo-fonte, docker, pacote-compilado).',
        'Folder: you choose the base folder and the delivery goes to a subfolder with the same name as the Sync folder. ZIP: a single file, suggested as name-entrega.zip. With several kinds ticked, each goes to its own subfolder (codigo-fonte, docker, pacote-compilado).',
        'Carpeta: usted elige la carpeta base y la entrega va a una subcarpeta con el mismo nombre de la carpeta del Sincronizar. ZIP: un archivo único, sugerido como nombre-entrega.zip. Con varios tipos marcados, cada uno va a su subcarpeta (codigo-fonte, docker, pacote-compilado).',
      ], { ...OPT, interactive: true }),
      st('options', 'ide.deliv_options', ['Segredos e limpeza da pasta', 'Secrets and folder cleanup', 'Secretos y limpieza de la carpeta'], [
        'Por padrão os segredos ficam de fora: o .env.local vira um .env.example só com os nomes e, no Java, senhas e chaves viram variáveis de ambiente. Só marque "Levar também os segredos" se a entrega for para você mesmo. "Limpar a pasta antes de exportar" apaga o que já está no destino (mantém node_modules, .git, .next e target) e sempre pede a sua confirmação antes, mostrando o que será apagado.',
        'By default secrets stay out: .env.local becomes a .env.example with names only and, in Java, passwords and keys become environment variables. Only tick "Also include secrets" if the delivery is for yourself. "Clean the folder before exporting" erases what is already in the destination (keeps node_modules, .git, .next and target) and always asks for your confirmation first, showing what will be erased.',
        'Por defecto los secretos quedan fuera: el .env.local pasa a ser un .env.example solo con los nombres y, en Java, contraseñas y claves pasan a variables de entorno. Solo marque "Llevar también los secretos" si la entrega es para usted mismo. "Limpiar la carpeta antes de exportar" borra lo que ya está en el destino (mantiene node_modules, .git, .next y target) y siempre pide su confirmación antes, mostrando lo que se borrará.',
      ], { ...OPT, interactive: true }),
      st('generate', 'ide.deliv_generate', ['Gerar entrega', 'Generate delivery', 'Generar entrega'], [
        'Este botão escolhe o destino e gera a entrega, mostrando o andamento na própria janela e, no fim, um atalho para abrir a pasta. O tour nunca clica nele.',
        'This button picks the destination and generates the delivery, showing progress in the window itself and, at the end, a shortcut to open the folder. The tour never clicks it.',
        'Este botón elige el destino y genera la entrega, mostrando el avance en la propia ventana y, al final, un acceso directo para abrir la carpeta. El tour nunca hace clic en él.',
      ], { ...OPT, readOnly: true }),
      st('close', 'ide.deliv_cancel', ['Fechar sem gerar', 'Close without generating', 'Cerrar sin generar'], [
        'Cancelar fecha a janela sem gerar nada. Ao terminar o tour, fechamos a janela por você.',
        'Cancel closes the window without generating anything. When the tour ends, we close the window for you.',
        'Cancelar cierra la ventana sin generar nada. Al terminar el tour, cerramos la ventana por usted.',
      ], { ...OPT, readOnly: true }),
    ],
  },

  // ───────────────────────── Commit ─────────────────────────
  {
    id: 'ide-git-commit',
    route: IDE,
    needs: 'ide.btn_commit',
    neverClick: ['ide.merge_apply'],
    cleanupClick: ['ide.commit_cancel'],
    title: h(['Commit: revisar e confirmar as alterações', 'Commit: review and confirm changes', 'Commit: revisar y confirmar los cambios']),
    summary: h(['A janela do botão Commit: a mensagem, a lista de arquivos alterados e o comparador de diferenças.', 'The Commit button window: the message, the list of changed files and the difference viewer.', 'La ventana del botón Commit: el mensaje, la lista de archivos cambiados y el comparador de diferencias.']),
    steps: [
      st('button', 'ide.btn_commit', ['O botão Commit', 'The Commit button', 'El botón Commit'], [
        'Guarda no histórico do Git as alterações feitas na pasta do projeto. A janela só abre se houver alterações locais pendentes: se não houver, a IDE avisa com uma mensagem. Quando houver, abrimos a janela por você no próximo passo; nada é commitado.',
        'Saves in the Git history the changes made in the project folder. The window only opens if there are pending local changes: if there are none, the IDE shows a message. When there are, we open the window for you in the next step; nothing is committed.',
        'Guarda en el historial de Git los cambios hechos en la carpeta del proyecto. La ventana solo abre si hay cambios locales pendientes: si no hay, la IDE avisa con un mensaje. Cuando haya, abrimos la ventana por usted en el próximo paso; no se hace ningún commit.',
      ], { ...OPT, readOnly: true }),
      st('header', 'ide.commit_header', ['A janela de Commit', 'The Commit window', 'La ventana de Commit'], [
        'À esquerda ficam a mensagem e os arquivos alterados; à direita, a comparação do arquivo escolhido. Fechar a janela não grava nada.',
        'On the left are the message and the changed files; on the right, the comparison of the chosen file. Closing the window does not save anything.',
        'A la izquierda están el mensaje y los archivos cambiados; a la derecha, la comparación del archivo elegido. Cerrar la ventana no graba nada.',
      ], { ...OPT, enterClick: 'ide.btn_commit', backClick: 'ide.commit_cancel' }),
      st('message', 'ide.commit_msg', ['Mensagem do commit', 'Commit message', 'Mensaje del commit'], [
        'Descreva em uma frase o que mudou: é o que aparece no Histórico. Pode digitar à vontade; nada é gravado enquanto você não confirmar.',
        'Describe in one sentence what changed: it is what shows up in the History. You can type freely; nothing is saved until you confirm.',
        'Describa en una frase qué cambió: es lo que aparece en el Historial. Puede escribir con libertad; nada se graba hasta que confirme.',
      ], { ...OPT, interactive: true }),
      st('files', 'ide.merge_files', ['Arquivos alterados', 'Changed files', 'Archivos cambiados'], [
        'Cada arquivo novo (+), modificado (lápis) ou apagado (lixeira) desde o último commit. Marque quais entram neste commit (Todos ou Nenhum no topo) e clique no nome para ver a diferença à direita. Não use o botão direito: ele oferece reverter o arquivo.',
        'Each file added (+), modified (pencil) or deleted (trash) since the last commit. Tick which ones go into this commit (All or None at the top) and click the name to see the difference on the right. Do not right-click: it offers to revert the file.',
        'Cada archivo nuevo (+), modificado (lápiz) o borrado (papelera) desde el último commit. Marque cuáles entran en este commit (Todos o Ninguno arriba) y haga clic en el nombre para ver la diferencia a la derecha. No use el botón derecho: ofrece revertir el archivo.',
      ], { ...OPT, interactive: true }),
      st('diff', 'ide.commit_diff', ['Comparador de diferenças', 'Difference viewer', 'Comparador de diferencias'], [
        'Mostra o arquivo original (HEAD) ao lado da sua versão local, com as setas para pular entre as alterações. Atenção: o lado direito é editável e salva na hora, então durante o tour esta área fica só para leitura.',
        'Shows the original file (HEAD) next to your local version, with arrows to jump between changes. Careful: the right side is editable and saves right away, so during the tour this area is read-only.',
        'Muestra el archivo original (HEAD) junto a su versión local, con flechas para saltar entre los cambios. Atención: el lado derecho es editable y guarda al instante, por eso durante el tour esta área queda solo de lectura.',
      ], { ...OPT, readOnly: true }),
      st('confirm', 'ide.merge_apply', ['Confirmar Commit', 'Confirm Commit', 'Confirmar Commit'], [
        'Grava o commit com os arquivos marcados e a mensagem. O número entre parênteses é a quantidade de arquivos marcados; sem nenhum marcado o botão fica desativado. O tour nunca clica nele. Depois do commit, use Push para enviar ao repositório remoto.',
        'Records the commit with the ticked files and the message. The number in parentheses is how many files are ticked; with none ticked the button is disabled. The tour never clicks it. After the commit, use Push to send it to the remote repository.',
        'Graba el commit con los archivos marcados y el mensaje. El número entre paréntesis es la cantidad de archivos marcados; sin ninguno marcado el botón queda desactivado. El tour nunca hace clic en él. Después del commit, use Push para enviar al repositorio remoto.',
      ], { ...OPT, readOnly: true }),
      st('close', 'ide.commit_cancel', ['Cancelar', 'Cancel', 'Cancelar'], [
        'Fecha a janela sem commitar. Ao terminar o tour, fechamos a janela por você.',
        'Closes the window without committing. When the tour ends, we close the window for you.',
        'Cierra la ventana sin hacer commit. Al terminar el tour, cerramos la ventana por usted.',
      ], { ...OPT, readOnly: true }),
    ],
  },

  // ───────────────────────── Histórico ─────────────────────────
  {
    id: 'ide-git-historico',
    route: IDE,
    needs: 'ide.btn_history',
    cleanupClick: ['ide.hist_close'],
    title: h(['Histórico do Git', 'Git history', 'Historial de Git']),
    summary: h(['A janela do botão Histórico: a branch, a lista de commits e o botão de voltar no tempo.', 'The History button window: the branch, the list of commits and the go-back-in-time button.', 'La ventana del botón Historial: la rama, la lista de commits y el botón de volver en el tiempo.']),
    steps: [
      st('button', 'ide.btn_history', ['O botão Histórico', 'The History button', 'El botón Historial'], [
        'Mostra os commits da branch atual, do mais novo para o mais antigo. Abrimos a janela por você no próximo passo; nada é alterado.',
        'Shows the commits of the current branch, newest first. We open the window for you in the next step; nothing is changed.',
        'Muestra los commits de la rama actual, del más nuevo al más antiguo. Abrimos la ventana por usted en el próximo paso; no se cambia nada.',
      ], { ...OPT, readOnly: true }),
      st('header', 'ide.hist_header', ['A janela de histórico', 'The history window', 'La ventana de historial'], [
        'O título e a branch que está sendo mostrada. Para fechar, use o X no canto.',
        'The title and the branch being shown. To close, use the X in the corner.',
        'El título y la rama que se está mostrando. Para cerrar, use la X de la esquina.',
      ], { ...OPT, enterClick: 'ide.btn_history', backClick: 'ide.hist_close' }),
      st('branch', 'ide.hist_branch', ['Escolher a branch', 'Choose the branch', 'Elegir la rama'], [
        'A lista traz as branches do projeto (local, as do fluxo e as que você criou). Escolher outra mostra só os commits dela: a branch do projeto e os arquivos da pasta não mudam. Pode experimentar.',
        'The list has the project branches (local, the flow ones and those you created). Choosing another one shows only its commits: the project branch and the files in the folder do not change. Feel free to try it.',
        'La lista trae las ramas del proyecto (local, las del flujo y las que usted creó). Elegir otra muestra solo sus commits: la rama del proyecto y los archivos de la carpeta no cambian. Puede probar.',
      ], { ...OPT, interactive: true }),
      st('list', 'ide.hist_list', ['Os commits', 'The commits', 'Los commits'], [
        'Cada cartão é um commit: a mensagem, quem fez, quando, e o código curto (hash) que o identifica. Ao passar o mouse aparece "Reverter para esta versão": ele devolve a pasta do projeto exatamente àquele commit e apaga o que não foi commitado, por isso pede uma confirmação. O tour nunca usa esse botão.',
        'Each card is a commit: the message, who made it, when, and the short code (hash) that identifies it. When you hover, "Revert to this version" appears: it returns the project folder exactly to that commit and erases what was not committed, so it asks for confirmation. The tour never uses that button.',
        'Cada tarjeta es un commit: el mensaje, quién lo hizo, cuándo y el código corto (hash) que lo identifica. Al pasar el mouse aparece "Volver a esta versión": devuelve la carpeta del proyecto exactamente a ese commit y borra lo que no se commiteó, por eso pide confirmación. El tour nunca usa ese botón.',
      ], { ...OPT, readOnly: true }),
      st('close', 'ide.hist_close', ['Fechar', 'Close', 'Cerrar'], [
        'Fecha o histórico. Ao terminar o tour, fechamos a janela por você.',
        'Closes the history. When the tour ends, we close the window for you.',
        'Cierra el historial. Al terminar el tour, cerramos la ventana por usted.',
      ], { ...OPT, readOnly: true }),
    ],
  },

  // ───────────────────────── Ambiente de Testes ─────────────────────────
  {
    id: 'ide-testes',
    route: IDE,
    needs: 'ide.btn_tests',
    cleanupClick: ['portal.test_close'],
    title: h(['Ambiente de Testes', 'Test Environment', 'Entorno de Pruebas']),
    summary: h(['A janela dos testes automáticos: tipos de teste, casos de uso, onde rodar, como acompanhar e o histórico das execuções.', 'The automatic tests window: test types, use cases, where to run, how to follow and the run history.', 'La ventana de las pruebas automáticas: tipos de prueba, casos de uso, dónde correr, cómo seguir y el historial de ejecuciones.']),
    steps: [
      st('button', 'ide.btn_tests', ['O botão Ambiente de Testes', 'The Test Environment button', 'El botón Entorno de Pruebas'], [
        'Abre o Ambiente de Testes do projeto. Os testes nascem do que você configurou no Studio: um caso de uso novo ou alterado muda o plano, sem escrever teste. Abrimos a janela por você no próximo passo; nada é executado.',
        'Opens the project Test Environment. The tests come from what you configured in the Studio: a new or changed use case changes the plan, with no test writing. We open the window for you in the next step; nothing is run.',
        'Abre el Entorno de Pruebas del proyecto. Las pruebas nacen de lo que usted configuró en el Studio: un caso de uso nuevo o cambiado cambia el plan, sin escribir pruebas. Abrimos la ventana por usted en el próximo paso; no se ejecuta nada.',
      ], { ...OPT, readOnly: true }),
      st('header', 'ide.test_header', ['A janela de testes', 'The tests window', 'La ventana de pruebas'], [
        'Durante o tour a janela só se explora: as abas, os botões Recolher e Expandir e o X respondem; qualquer botão que execute, crie cópia ou apague algo fica desativado.',
        'During the tour the window can only be explored: the tabs, the Collapse and Expand buttons and the X respond; any button that runs, creates a copy or deletes something is disabled.',
        'Durante el tour la ventana solo se explora: las pestañas, los botones Recoger y Expandir y la X responden; cualquier botón que ejecute, cree una copia o borre algo queda desactivado.',
      ], { ...OPT, enterClick: 'ide.btn_tests', backClick: 'portal.test_close' }),
      st('tabs', 'ide.test_tabs', ['Executar e Histórico', 'Run and History', 'Ejecutar e Historial'], [
        'Executar: monta e roda o plano. Histórico: as execuções anteriores, guardadas para consultar e comparar. Você pode alternar entre as abas.',
        'Run: builds and runs the plan. History: previous runs, kept to consult and compare. You can switch between the tabs.',
        'Ejecutar: arma y corre el plan. Historial: las ejecuciones anteriores, guardadas para consultar y comparar. Puede alternar entre las pestañas.',
      ], { ...OPT, interactive: true }),
      st('safety', 'ide.test_safety', ['Segurança dos dados', 'Data safety', 'Seguridad de los datos'], [
        'Os testes rodam em um banco de teste: por padrão, uma cópia do banco, informada por você. Rodar no banco original só com o seu consentimento, e no fim o motor confere que nenhum dado existente foi alterado.',
        'The tests run on a test database: by default, a copy of the database, provided by you. Running on the original database only with your consent, and at the end the engine checks that no existing data was changed.',
        'Las pruebas corren en una base de prueba: por defecto, una copia de la base, informada por usted. Correr en la base original solo con su consentimiento, y al final el motor verifica que ningún dato existente fue alterado.',
      ], OPT),
      st('type', 'ide.test_type', ['1 · Tipo de teste', '1 · Test type', '1 · Tipo de prueba'], [
        'Funcional, Integração, Segurança, Compatibilidade, Carga e Visual podem ser escolhidos; os demais aparecem como "em breve". Cada tipo muda o que o motor verifica. Use Recolher e Expandir para esconder ou mostrar a seção.',
        'Functional, Integration, Security, Compatibility, Load and Visual can be chosen; the others show as "coming soon". Each type changes what the engine checks. Use Collapse and Expand to hide or show the section.',
        'Funcional, Integración, Seguridad, Compatibilidad, Carga y Visual se pueden elegir; los demás aparecen como "próximamente". Cada tipo cambia lo que verifica el motor. Use Recoger y Expandir para ocultar o mostrar la sección.',
      ], OPT),
      st('scope', 'ide.test_scope', ['2 · Casos de uso', '2 · Use cases', '2 · Casos de uso'], [
        'Cada linha é um caso de uso do projeto, com o tipo de lógica e quantos testes ele gera. Marque os que quer testar; o plano de cada um aparece embaixo. "Atualizar plano" gera o plano de novo a partir do projeto. Casos sem gabarito aparecem como "ainda sem teste automático".',
        'Each row is a project use case, with the logic type and how many tests it generates. Tick the ones you want to test; the plan of each appears below. "Reload plan" rebuilds the plan from the project. Cases without a template show as "no automatic test yet".',
        'Cada fila es un caso de uso del proyecto, con el tipo de lógica y cuántas pruebas genera. Marque los que quiere probar; el plan de cada uno aparece abajo. "Actualizar plan" genera el plan de nuevo desde el proyecto. Los casos sin plantilla aparecen como "aún sin prueba automática".',
      ], OPT),
      st('where', 'ide.test_where', ['3 · Onde rodar', '3 · Where to run', '3 · Dónde correr'], [
        'O motor de testes (instalado uma vez nesta máquina), as configurações do banco de teste (com testar conexão, preparar e criar uma cópia) e a pasta do app exportado a testar, que a IDE sugere sozinha: a pasta do Sincronizar ou a da última Entrega.',
        'The test engine (installed once on this machine), the test database settings (with test connection, prepare and create a copy) and the folder of the exported app to test, which the IDE suggests by itself: the Sync folder or the last Delivery.',
        'El motor de pruebas (instalado una vez en esta máquina), la configuración de la base de prueba (con probar conexión, preparar y crear una copia) y la carpeta de la app exportada a probar, que la IDE sugiere sola: la carpeta del Sincronizar o la de la última Entrega.',
      ], OPT),
      st('mode', 'ide.test_mode', ['4 · Como acompanhar', '4 · How to follow', '4 · Cómo seguir'], [
        'Navegador interno (a execução ao vivo aqui no painel), navegador do sistema (abre uma janela) ou segundo plano (mais rápido). Fora do segundo plano dá para escolher a velocidade, e o vídeo das falhas pode ser ativado (baixa o ffmpeg).',
        'Internal browser (live run here in the panel), system browser (opens a window) or background (faster). Outside background you can pick the speed, and the failure video can be turned on (downloads ffmpeg).',
        'Navegador interno (la ejecución en vivo aquí en el panel), navegador del sistema (abre una ventana) o segundo plano (más rápido). Fuera del segundo plano se puede elegir la velocidad, y el video de las fallas se puede activar (descarga ffmpeg).',
      ], OPT),
      st('footer', 'ide.test_footer', ['Executar e ver o resultado', 'Run and see the result', 'Ejecutar y ver el resultado'], [
        'À esquerda o resumo: quantos casos e testes estão marcados e, depois de rodar, quantos passaram, falharam ou foram ignorados. "Executar testes" começa a execução (o tour nunca clica nele); depois dela aparecem Limpar e Abrir relatório (genérico ou técnico do Playwright, com impressão e download em PDF, HTML ou JSON).',
        'On the left is the summary: how many cases and tests are ticked and, after running, how many passed, failed or were ignored. "Run tests" starts the run (the tour never clicks it); after it, Clear and Open report appear (generic or the Playwright technical one, with printing and download as PDF, HTML or JSON).',
        'A la izquierda el resumen: cuántos casos y pruebas están marcados y, después de correr, cuántas pasaron, fallaron o se ignoraron. "Ejecutar pruebas" inicia la ejecución (el tour nunca hace clic en él); después aparecen Limpiar y Abrir informe (genérico o el técnico de Playwright, con impresión y descarga en PDF, HTML o JSON).',
      ], OPT),
      st('history', 'ide.test_history', ['A aba Histórico', 'The History tab', 'La pestaña Historial'], [
        'Cada execução gravada: abrir para ver o que aconteceu, marcar exatamente duas para comparar, ou excluir (com confirmação). Mostra também onde os arquivos ficam guardados. Abrimos a aba por você; os botões de abrir, comparar e excluir ficam desativados durante o tour.',
        'Each recorded run: open it to see what happened, tick exactly two to compare, or delete (with confirmation). It also shows where the files are kept. We opened the tab for you; the open, compare and delete buttons are disabled during the tour.',
        'Cada ejecución grabada: abrirla para ver qué pasó, marcar exactamente dos para comparar, o eliminar (con confirmación). Muestra también dónde se guardan los archivos. Abrimos la pestaña por usted; los botones de abrir, comparar y eliminar quedan desactivados durante el tour.',
      ], { ...OPT, enterClick: 'ide.test_tab_history', backClick: 'ide.test_tab_run' }),
      st('close', 'portal.test_close', ['Fechar a janela', 'Close the window', 'Cerrar la ventana'], [
        'O X fecha o Ambiente de Testes. Ao terminar o tour, fechamos a janela por você.',
        'The X closes the Test Environment. When the tour ends, we close the window for you.',
        'La X cierra el Entorno de Pruebas. Al terminar el tour, cerramos la ventana por usted.',
      ], { ...OPT, readOnly: true }),
    ],
  },
]
