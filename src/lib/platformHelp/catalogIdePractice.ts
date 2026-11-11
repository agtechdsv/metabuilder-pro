/**
 * Tour PRÁTICO da IDE Local: "Ejetar na prática". Diferente dos outros tours da IDE (que só mostram), este deixa a pessoa fazer de verdade:
 * abrir a janela, escolher a stack, gerar o código (cai num sandbox), revisar e efetivar o merge. No fim o fonte do projeto está na pasta local.
 * O sandbox é a rede de segurança: nada entra na pasta até "Efetivar Merge", e "Descartar" desfaz.
 * Alvos: `data-help-id` ide.* de IDEHeader (botões e janela de ejetar), IDECommitModal (revisão do merge) e do explorador.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const IDE = '/ide-local'
const OPT = { skipIfMissing: true }

export const IDE_PRACTICE_TOURS: readonly PlatformTour[] = [
  {
    id: 'ide-ejetar-pratica',
    route: IDE,
    // sem o botão Sincronizar a IDE está com uma sincronização pendente (barra Descartar / Confirmar Merge): primeiro termine ou descarte
    needs: 'ide.btn_sync',
    needsHint: h(['Há uma sincronização pendente: confirme o merge ou descarte antes de usar este tour.', 'A sync is pending: confirm the merge or discard it before using this tour.', 'Hay una sincronización pendiente: confirme el merge o descártela antes de usar este tour.']),
    cleanupClick: ['ide.eject_cancel'],
    title: h(['Ejetar na prática (gera o código)', 'Eject hands-on (generates the code)', 'Eyectar en la práctica (genera el código)']),
    summary: h(['Faça de verdade: escolha a stack, gere o app do projeto e efetive o merge. No fim o fonte está na pasta da IDE Local.', 'Do it for real: pick the stack, generate the project app and apply the merge. At the end the source is in the Local IDE folder.', 'Hágalo de verdad: elija el stack, genere la app del proyecto y efectúe el merge. Al final el fuente está en la carpeta de la IDE Local.']),
    steps: [
      st('intro', undefined, ['Vamos gerar o código de verdade', 'Let us generate the code for real', 'Vamos a generar el código de verdad'], [
        'Neste tour você faz a ejeção de verdade: a IDE gera o app do projeto (Node.js ou Java Spring) e, no fim, o código fica na pasta da IDE Local. Nada entra na pasta antes de você revisar e confirmar o merge, e dá para descartar tudo antes disso. Para só conhecer as telas sem gerar nada, use o tour "Ejetar & Sincronizar".',
        'In this tour you really eject: the IDE generates the project app (Node.js or Java Spring) and, at the end, the code is in the Local IDE folder. Nothing enters the folder before you review and confirm the merge, and you can discard everything before that. To just see the screens without generating anything, use the "Eject & Sync" tour.',
        'En este tour eyecta de verdad: la IDE genera la app del proyecto (Node.js o Java Spring) y, al final, el código queda en la carpeta de la IDE Local. Nada entra en la carpeta antes de revisar y confirmar el merge, y se puede descartar todo antes. Para solo conocer las pantallas sin generar nada, use el tour "Eyectar y Sincronizar".',
      ]),
      st('button', 'ide.btn_sync', ['Abra a janela: clique em Sincronizar', 'Open the window: click Sync', 'Abra la ventana: haga clic en Sincronizar'], [
        'Clique no botão destacado. Ele abre a janela de configuração; ainda não gera nada.',
        'Click the highlighted button. It opens the configuration window; it does not generate anything yet.',
        'Haga clic en el botón resaltado. Abre la ventana de configuración; todavía no genera nada.',
      ], { advanceOnClick: true }),
      st('header', 'ide.eject_header', ['A janela de configuração', 'The configuration window', 'La ventana de configuración'], [
        'Aqui você escolhe como o app será gerado: a stack, os componentes e a arquitetura do backend.',
        'Here you choose how the app will be generated: the stack, the components and the backend architecture.',
        'Aquí elige cómo se generará la app: el stack, los componentes y la arquitectura del backend.',
      ]),
      st('lang', 'ide.eject_lang', ['Idioma do código gerado', 'Generated code language', 'Idioma del código generado'], [
        'O idioma dos nomes e comentários do app gerado. O padrão segue o idioma da IDE: pode deixar como está ou trocar.',
        'The language of the names and comments of the generated app. The default follows the IDE language: you can keep it or change it.',
        'El idioma de los nombres y comentarios de la app generada. El valor por defecto sigue el idioma de la IDE: puede dejarlo o cambiarlo.',
      ], { ...OPT, interactive: true }),
      st('tabs', 'ide.eject_tabs', ['Escolha a stack', 'Pick the stack', 'Elija el stack'], [
        'Escolha Node.js ou Java Spring (Java em beta). As outras aparecem como "em breve". Clique na aba que você quer gerar.',
        'Pick Node.js or Java Spring (Java in beta). The others show as "coming soon". Click the tab you want to generate.',
        'Elija Node.js o Java Spring (Java en beta). Las otras aparecen como "próximamente". Haga clic en la pestaña que quiere generar.',
      ], { ...OPT, interactive: true }),
      st('content', 'ide.eject_content', ['Configure a stack', 'Configure the stack', 'Configure el stack'], [
        'Node.js: autenticação e banco entram sozinhos (auto-detectados). Java Spring: banco, base (JDK e porta), segurança, migrations, testes, Docker e documentação. Pode usar os valores padrão: eles servem para começar.',
        'Node.js: authentication and database come in by themselves (auto-detected). Java Spring: database, base (JDK and port), security, migrations, tests, Docker and documentation. You can use the default values: they are good to start.',
        'Node.js: autenticación y base entran solas (autodetectadas). Java Spring: base, base (JDK y puerto), seguridad, migrations, pruebas, Docker y documentación. Puede usar los valores por defecto: sirven para empezar.',
      ], { ...OPT, interactive: true }),
      st('confirm', 'ide.eject_confirm', ['Gere o código: clique em Sincronizar Repositório', 'Generate the code: click Sync Repository', 'Genere el código: haga clic en Sincronizar Repositorio'], [
        'Este clique gera o app de verdade. O código vai para um sandbox, não para a sua pasta, então ainda dá para descartar. Pode levar um minuto.',
        'This click really generates the app. The code goes to a sandbox, not to your folder, so you can still discard it. It may take a minute.',
        'Este clic genera la app de verdad. El código va a un sandbox, no a su carpeta, así que todavía se puede descartar. Puede tardar un minuto.',
      ], {
        advanceOnClick: true,
        advanceWaitMs: 300000,
        advancingHint: h(['Gerando o código... Pode levar um minuto. Se a IDE pedir um nome de pasta ou perguntar algo, responda na tela: o tour espera.', 'Generating the code... It may take a minute. If the IDE asks for a folder name or anything else, answer on screen: the tour waits.', 'Generando el código... Puede tardar un minuto. Si la IDE pide un nombre de carpeta o pregunta algo, responda en pantalla: el tour espera.']),
      }),
      st('sandbox', 'ide.btn_merge', ['O código está no sandbox', 'The code is in the sandbox', 'El código está en el sandbox'], [
        'Pronto: o app foi gerado e está separado da sua pasta. "Descartar" desfaz tudo; "Confirmar Merge" abre a revisão. Clique em Confirmar Merge para ver o que foi gerado.',
        'Done: the app was generated and is kept apart from your folder. "Discard" undoes everything; "Confirm Merge" opens the review. Click Confirm Merge to see what was generated.',
        'Listo: la app se generó y está separada de su carpeta. "Descartar" deshace todo; "Confirmar Merge" abre la revisión. Haga clic en Confirmar Merge para ver lo que se generó.',
      ], { alsoTarget: 'ide.btn_discard', advanceOnClick: true, advanceWaitMs: 20000 }),
      st('review', 'ide.merge_files', ['Arquivos gerados', 'Generated files', 'Archivos generados'], [
        'A lista mostra cada arquivo novo ou alterado em relação à sua pasta. Ao selecionar um, o painel ao lado mostra a diferença. Se você já tinha mexido nos arquivos, é aqui que você vê o que muda.',
        'The list shows each new or changed file compared to your folder. Selecting one shows the difference in the side panel. If you had already edited the files, this is where you see what changes.',
        'La lista muestra cada archivo nuevo o cambiado respecto a su carpeta. Al seleccionar uno, el panel lateral muestra la diferencia. Si ya había editado los archivos, aquí ve lo que cambia.',
      ], { ...OPT }),
      st('apply', 'ide.merge_apply', ['Efetive o merge', 'Apply the merge', 'Efectúe el merge'], [
        'Este clique grava os arquivos na sua pasta local: é o passo que coloca o fonte na IDE. Se preferir não gravar, feche o tour e use Cancelar (o sandbox continua, e você descarta ou confirma depois).',
        'This click writes the files to your local folder: it is the step that puts the source in the IDE. If you prefer not to write, close the tour and use Cancel (the sandbox stays, and you discard or confirm later).',
        'Este clic graba los archivos en su carpeta local: es el paso que pone el fuente en la IDE. Si prefiere no grabar, cierre el tour y use Cancelar (el sandbox continúa y descarta o confirma después).',
      ], { advanceOnClick: true, advanceWaitMs: 120000, advancingHint: h(['Aplicando os arquivos na pasta local...', 'Applying the files to the local folder...', 'Aplicando los archivos en la carpeta local...']) }),
      st('done', 'ide.btn_sync', ['Pronto: o fonte está na pasta', 'Done: the source is in the folder', 'Listo: el fuente está en la carpeta'], [
        'O código foi aplicado na sua pasta. Sempre que o projeto mudar no Studio, use este botão de novo: ele gera outra vez e mostra só o que mudou, no mesmo fluxo de sandbox e revisão.',
        'The code was applied to your folder. Whenever the project changes in the Studio, use this button again: it generates again and shows only what changed, in the same sandbox and review flow.',
        'El código se aplicó en su carpeta. Siempre que el proyecto cambie en el Studio, use este botón de nuevo: genera otra vez y muestra solo lo que cambió, en el mismo flujo de sandbox y revisión.',
      ], OPT),
      st('explorer', 'ide.explorer', ['Os arquivos gerados', 'The generated files', 'Los archivos generados'], [
        'O explorador já mostra o app gerado. Abra um arquivo para ver o código no editor.',
        'The explorer already shows the generated app. Open a file to see the code in the editor.',
        'El explorador ya muestra la app generada. Abra un archivo para ver el código en el editor.',
      ], OPT),
      st('commit', 'ide.btn_commit', ['Versionar no Git', 'Version in Git', 'Versionar en Git'], [
        'O merge fica na sua branch. Para guardar esta versão no histórico do Git, use Commit. O tour "IDE Local: Git" explica cada botão do Git.',
        'The merge stays in your branch. To keep this version in the Git history, use Commit. The "Local IDE: Git" tour explains each Git button.',
        'El merge queda en su rama. Para guardar esta versión en el historial de Git, use Commit. El tour "IDE Local: Git" explica cada botón de Git.',
      ], OPT),
    ],
  },
]
