/**
 * Tour da janela "Configurações Git Enterprise" da IDE Local (ícone da engrenagem do cabeçalho): repositório remoto, branches e zona de perigo.
 * Só explica: o tour troca de aba sozinho, mas nunca clica em "Salvar" nem em "Sim, Apagar Tudo e Reiniciar" (neverClick) e fecha a janela no fim.
 * Alvos: `data-help-id` ide.gitcfg_* de IDEGitSettingsModal.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const IDE = '/ide-local'

export const IDE_GIT_TOURS: readonly PlatformTour[] = [
  {
    id: 'ide-git-config',
    route: IDE,
    neverClick: ['ide.gitcfg_save', 'ide.gitcfg_confirm_yes'],
    cleanupClick: ['ide.gitcfg_confirm_cancel', 'ide.gitcfg_cancel'],
    title: h(['Configurações Git (remoto, branches e reset)', 'Git settings (remote, branches and reset)', 'Configuraciones de Git (remoto, ramas y reset)']),
    summary: h(['A janela da engrenagem: ligar um repositório remoto, renomear as branches do fluxo e a Zona de Perigo.', 'The gear window: connecting a remote repository, renaming the flow branches and the Danger Zone.', 'La ventana del engranaje: conectar un repositorio remoto, renombrar las ramas del flujo y la Zona de Peligro.']),
    steps: [
      st('button', 'ide.btn_gitsettings', ['Configurações Git', 'Git settings', 'Configuraciones de Git'], [
        'A engrenagem abre as configurações do Git deste projeto: o repositório remoto, as branches do fluxo e a Zona de Perigo. Abrimos a janela por você no próximo passo; nada é salvo.',
        'The gear opens the Git settings of this project: the remote repository, the flow branches and the Danger Zone. We open the window for you in the next step; nothing is saved.',
        'El engranaje abre las configuraciones de Git de este proyecto: el repositorio remoto, las ramas del flujo y la Zona de Peligro. Abrimos la ventana por usted en el próximo paso; no se guarda nada.',
      ], { skipIfMissing: true }),
      st('header', 'ide.gitcfg_header', ['A janela de configurações', 'The settings window', 'La ventana de configuraciones'], [
        'Três abas: Autenticação e Repositório Remoto, Pipeline de Triangulação (Branches) e Zona de Perigo. O tour passa por cada uma e fecha a janela no fim, sem salvar nada.',
        'Three tabs: Authentication and Remote Repository, Triangulation Pipeline (Branches) and Danger Zone. The tour goes through each one and closes the window at the end, without saving anything.',
        'Tres pestañas: Autenticación y Repositorio Remoto, Pipeline de Triangulación (Ramas) y Zona de Peligro. El tour recorre cada una y cierra la ventana al final, sin guardar nada.',
      ], { skipIfMissing: true, enterClick: 'ide.btn_gitsettings', backClick: 'ide.gitcfg_cancel' }),
      st('tab-auth', 'ide.gitcfg_tab_auth', ['Aba: Autenticação e Repositório Remoto', 'Tab: Authentication and Remote Repository', 'Pestaña: Autenticación y Repositorio Remoto'], [
        'Aqui você liga o repositório local a um repositório remoto da empresa (GitHub, GitLab, Azure DevOps, Gitea...). É o que permite mesclar o trabalho de vários devs.',
        'Here you connect the local repository to the company remote repository (GitHub, GitLab, Azure DevOps, Gitea...). It is what allows merging the work of several devs.',
        'Aquí conecta el repositorio local con el repositorio remoto de la empresa (GitHub, GitLab, Azure DevOps, Gitea...). Es lo que permite fusionar el trabajo de varios devs.',
      ], { skipIfMissing: true }),
      st('zero-trust', 'ide.gitcfg_zero_trust', ['Suas credenciais ficam com você', 'Your credentials stay with you', 'Sus credenciales quedan con usted'], [
        'O endereço e o token são salvos só no seu computador, no arquivo .metabuilder/git-config.json. Eles nunca vão para a nuvem do MetaBuilder.',
        'The address and the token are saved only on your computer, in the .metabuilder/git-config.json file. They never go to the MetaBuilder cloud.',
        'La dirección y el token se guardan solo en su computador, en el archivo .metabuilder/git-config.json. Nunca van a la nube de MetaBuilder.',
      ], { skipIfMissing: true }),
      st('remote', 'ide.gitcfg_remote', ['URL do repositório (Origin)', 'Repository URL (Origin)', 'URL del repositorio (Origin)'], [
        'O endereço do repositório remoto. Sem ele, o seu repositório é só local: cada dev tem o seu e não há como mesclar o trabalho entre eles.',
        'The address of the remote repository. Without it, your repository is local only: each dev has their own and there is no way to merge work between them.',
        'La dirección del repositorio remoto. Sin ella, su repositorio es solo local: cada dev tiene el suyo y no hay cómo fusionar el trabajo entre ellos.',
      ], { skipIfMissing: true }),
      st('token', 'ide.gitcfg_token', ['Personal Access Token (PAT)', 'Personal Access Token (PAT)', 'Personal Access Token (PAT)'], [
        'O token de acesso que você gera no GitHub, GitLab ou similar. Ele dá à IDE permissão para enviar (Push) e trazer (Pull) código do remoto. O campo mostra pontos para esconder o valor.',
        'The access token you generate on GitHub, GitLab or similar. It gives the IDE permission to send (Push) and bring (Pull) code from the remote. The field shows dots to hide the value.',
        'El token de acceso que usted genera en GitHub, GitLab o similar. Da a la IDE permiso para enviar (Push) y traer (Pull) código del remoto. El campo muestra puntos para ocultar el valor.',
      ], { skipIfMissing: true }),
      st('tab-pipeline', 'ide.gitcfg_tab_pipeline', ['Aba: Pipeline de Triangulação (Branches)', 'Tab: Triangulation Pipeline (Branches)', 'Pestaña: Pipeline de Triangulación (Ramas)'], [
        'A IDE trabalha com três branches: a sua (onde você edita), a da nuvem (que recebe o código gerado pelo Studio) e a de sandbox (onde o merge é revisado). Aqui você dá a elas os nomes do seu Git Flow. Abrimos a aba por você.',
        'The IDE works with three branches: yours (where you edit), the cloud one (which receives the code generated by the Studio) and the sandbox (where the merge is reviewed). Here you give them the names of your Git Flow. We opened the tab for you.',
        'La IDE trabaja con tres ramas: la suya (donde edita), la de la nube (que recibe el código generado por el Studio) y la de sandbox (donde se revisa el merge). Aquí les da los nombres de su Git Flow. Abrimos la pestaña por usted.',
      ], { skipIfMissing: true, enterClick: 'ide.gitcfg_tab_pipeline', backClick: 'ide.gitcfg_tab_auth' }),
      st('pipeline-note', 'ide.gitcfg_pipeline_note', ['Cuidado ao renomear', 'Careful when renaming', 'Cuidado al renombrar'], [
        'Renomear muda o funcionamento da engine da IDE: ela passa a usar os nomes que você definir. Só mexa se a sua equipe já tem uma estrutura de branches.',
        'Renaming changes how the IDE engine works: it starts using the names you set. Only change them if your team already has a branch structure.',
        'Renombrar cambia el funcionamiento del motor de la IDE: pasa a usar los nombres que usted defina. Solo cámbielos si su equipo ya tiene una estructura de ramas.',
      ], { skipIfMissing: true }),
      st('branch-local', 'ide.gitcfg_branch_local', ['Branch Base', 'Base Branch', 'Rama Base'], [
        'A branch principal, onde você trabalha e onde o código gerado é mesclado no final. O padrão é "local"; muitas equipes usam "develop" ou "main".',
        'The main branch, where you work and where the generated code is merged in the end. The default is "local"; many teams use "develop" or "main".',
        'La rama principal, donde usted trabaja y donde el código generado se fusiona al final. El valor por defecto es "local"; muchos equipos usan "develop" o "main".',
      ], { skipIfMissing: true }),
      st('branch-upstream', 'ide.gitcfg_branch_upstream', ['Branch da Nuvem', 'Cloud Branch', 'Rama de la Nube'], [
        'A branch que recebe o código gerado pelo Studio (via Web), antes de ele ser mesclado na sua. O padrão é "upstream".',
        'The branch that receives the code generated by the Studio (via Web), before it is merged into yours. The default is "upstream".',
        'La rama que recibe el código generado por el Studio (vía Web), antes de fusionarse en la suya. El valor por defecto es "upstream".',
      ], { skipIfMissing: true }),
      st('branch-sandbox', 'ide.gitcfg_branch_sandbox', ['Branch Sandbox', 'Sandbox Branch', 'Rama Sandbox'], [
        'A branch de testes descartável onde o merge é preparado e revisado antes de você confirmar. Por isso o "Descartar" desfaz tudo. O padrão é "sync-sandbox".',
        'The disposable test branch where the merge is prepared and reviewed before you confirm. That is why "Discard" undoes everything. The default is "sync-sandbox".',
        'La rama de pruebas descartable donde el merge se prepara y revisa antes de confirmar. Por eso "Descartar" deshace todo. El valor por defecto es "sync-sandbox".',
      ], { skipIfMissing: true }),
      st('save', 'ide.gitcfg_save', ['Salvar Configurações', 'Save Settings', 'Guardar Configuraciones'], [
        'Grava o repositório, o token e os nomes das branches no seu computador e fecha a janela. O tour nunca clica neste botão: nada foi alterado.',
        'Saves the repository, the token and the branch names on your computer and closes the window. The tour never clicks this button: nothing was changed.',
        'Graba el repositorio, el token y los nombres de las ramas en su computador y cierra la ventana. El tour nunca hace clic en este botón: no se cambió nada.',
      ], { skipIfMissing: true }),
      st('tab-danger', 'ide.gitcfg_tab_danger', ['Aba: Zona de Perigo', 'Tab: Danger Zone', 'Pestaña: Zona de Peligro'], [
        'Ações que apagam coisas. Abrimos a aba por você; o tour só mostra e nunca executa o que está nela.',
        'Actions that delete things. We opened the tab for you; the tour only shows and never runs what is in it.',
        'Acciones que borran cosas. Abrimos la pestaña por usted; el tour solo muestra y nunca ejecuta lo que hay en ella.',
      ], { skipIfMissing: true, enterClick: 'ide.gitcfg_tab_danger', backClick: 'ide.gitcfg_tab_pipeline' }),
      st('danger-warning', 'ide.gitcfg_danger_warning', ['Atenção: não tem volta', 'Warning: there is no undo', 'Atención: no hay vuelta atrás'], [
        'O reset de fábrica perde tudo o que não foi commitado nem sincronizado com a nuvem. Antes de usar, faça Commit e Push do que importa.',
        'The factory reset loses everything that was not committed or synced with the cloud. Before using it, Commit and Push what matters.',
        'El reset de fábrica pierde todo lo que no fue commiteado ni sincronizado con la nube. Antes de usarlo, haga Commit y Push de lo que importa.',
      ], { skipIfMissing: true }),
      st('reset', 'ide.gitcfg_reset', ['Reiniciar Projeto Local', 'Reset Local Project', 'Reiniciar Proyecto Local'], [
        'Apaga a pasta local do projeto (arquivos, histórico do Git local, branches temporárias e node_modules) e deixa tudo virgem, pronto para um novo Ejetar & Sincronizar. Não mexe no projeto do Studio nem no banco. Este botão não responde durante o tour.',
        'Deletes the local project folder (files, local Git history, temporary branches and node_modules) and leaves everything clean, ready for a new Eject & Sync. It does not touch the Studio project or the database. This button does not respond during the tour.',
        'Borra la carpeta local del proyecto (archivos, historial de Git local, ramas temporales y node_modules) y deja todo virgen, listo para un nuevo Eyectar y Sincronizar. No toca el proyecto del Studio ni la base. Este botón no responde durante el tour.',
      ], { skipIfMissing: true, readOnly: true }),
      st('confirm', 'ide.gitcfg_confirm_box', ['A confirmação', 'The confirmation', 'La confirmación'], [
        'Antes de apagar, a IDE pede uma confirmação. Abrimos o aviso por você só para mostrar: "Cancelar" volta atrás e "Sim, Apagar Tudo e Reiniciar" é o botão que executa. O tour nunca clica nele.',
        'Before deleting, the IDE asks for confirmation. We opened the notice for you just to show it: "Cancel" goes back and "Yes, Delete Everything and Restart" is the button that runs it. The tour never clicks it.',
        'Antes de borrar, la IDE pide una confirmación. Abrimos el aviso por usted solo para mostrarlo: "Cancelar" vuelve atrás y "Sí, Borrar Todo y Reiniciar" es el botón que ejecuta. El tour nunca hace clic en él.',
      ], { skipIfMissing: true, enterClick: 'ide.gitcfg_reset', backClick: 'ide.gitcfg_confirm_cancel' }),
      st('close', 'ide.gitcfg_cancel', ['Fechar a janela', 'Close the window', 'Cerrar la ventana'], [
        'Fecha sem alterar nada. O tour fecha a janela sozinho ao terminar e fecha também o aviso de confirmação, se ele estiver aberto.',
        'Closes without changing anything. The tour closes the window by itself when it ends and also closes the confirmation notice, if it is open.',
        'Cierra sin cambiar nada. El tour cierra la ventana solo al terminar y también cierra el aviso de confirmación, si está abierto.',
      ], { skipIfMissing: true, enterClick: 'ide.gitcfg_confirm_cancel', backClick: 'ide.gitcfg_reset' }),
    ],
  },
]
