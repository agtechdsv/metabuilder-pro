/**
 * Tours extras da lista do Studio: hoje, "Excluir um caso de uso". O tour só MOSTRA o caminho: o botão "Sim, excluir" não aceita clique.
 * Textos em pt, en e es; cada alvo é um `data-help-id` que existe em StudioDashboardClient.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const STUDIO = '/admin/:workspace/:project/studio'

export const STUDIO_EXTRA_TOURS: readonly PlatformTour[] = [
  {
    id: 'studio-excluir-caso-de-uso',
    route: STUDIO,
    freeClicks: true,
    neverClick: ['studio.delete_yes'],
    cleanupClick: ['studio.delete_cancel'],
    needs: 'studio.cards',
    needsHint: h(['Disponível na lista do Studio: saia do assistente (seta ao lado do título) para ver este tour.', 'Available on the Studio list: leave the wizard (arrow next to the title) to see this tour.', 'Disponible en la lista del Studio: salga del asistente (flecha junto al título) para ver este recorrido.']),
    recover: ['studio.tab_list', 'wizard.back', 'ai.back'],
    title: h(['Excluir um caso de uso', 'Delete a use case', 'Eliminar un caso de uso']),
    summary: h(['Onde fica a lixeira, o que a confirmação avisa e a diferença entre excluir e descartar rascunho. O tour nunca exclui.', 'Where the trash is, what the confirmation warns and the difference between deleting and discarding a draft. The tour never deletes.', 'Dónde está la papelera, qué avisa la confirmación y la diferencia entre eliminar y descartar borrador. El recorrido nunca elimina.']),
    steps: [
      st('cards', 'studio.cards', ['Os cartões', 'The cards', 'Las tarjetas'], [
        'Cada cartão é um caso de uso do projeto. A lixeira fica no canto do cartão e só aparece para quem tem permissão de excluir.',
        'Each card is a use case of the project. The trash is in the card corner and only shows for those with permission to delete.',
        'Cada tarjeta es un caso de uso del proyecto. La papelera está en la esquina de la tarjeta y solo aparece para quien tiene permiso de eliminar.',
      ]),
      st('discard', 'studio.card_discard', ['Atenção: descartar rascunho é outra coisa', 'Careful: discarding a draft is different', 'Atención: descartar borrador es otra cosa'], [
        'A lixeira vermelha ao lado de "Publicar" (só aparece em casos de uso já publicados com alterações pendentes) descarta só o RASCUNHO e volta para a versão publicada. O caso de uso continua existindo. Não confunda com a exclusão.',
        'The red trash next to "Publish" (only shown on published use cases with pending changes) discards only the DRAFT and goes back to the published version. The use case keeps existing. Do not mix it up with deleting.',
        'La papelera roja junto a "Publicar" (solo aparece en casos de uso ya publicados con cambios pendientes) descarta solo el BORRADOR y vuelve a la versión publicada. El caso de uso sigue existiendo. No lo confunda con eliminar.',
      ], { skipIfMissing: true, readOnly: true }),
      st('trash', 'studio.card_delete', ['A lixeira do cartão', 'The card trash', 'La papelera de la tarjeta'], [
        'Clique na lixeira para abrir a confirmação. Abrir não exclui nada: a exclusão só acontece no botão "Sim, excluir" da janela seguinte, e o tour não deixa clicar nele.',
        'Click the trash to open the confirmation. Opening deletes nothing: deleting only happens on the "Yes, delete" button of the next window, and the tour does not let you click it.',
        'Haga clic en la papelera para abrir la confirmación. Abrir no elimina nada: la eliminación solo ocurre en el botón "Sí, eliminar" de la ventana siguiente, y el recorrido no deja hacer clic en él.',
      ], {
        skipIfMissing: true,
        interactive: true,
        completeWhen: { id: 'studio.delete_warning', check: 'attr', attr: 'data-help-id', equals: 'studio.delete_warning' },
        waitingHint: h(['Clique na lixeira de um cartão para abrir a confirmação. Abrir não exclui nada.', 'Click the trash of a card to open the confirmation. Opening deletes nothing.', 'Haga clic en la papelera de una tarjeta para abrir la confirmación. Abrir no elimina nada.']),
      }),
      st('warning', 'studio.delete_warning', ['O aviso', 'The warning', 'El aviso'], [
        'A janela cita o nome do caso de uso e o prazo da lixeira. Excluir manda o caso de uso para a lixeira e tira dos menus do projeto os itens que apontavam para ele. Os usuários perdem a tela na hora. Dentro do prazo você restaura tudo (menus inclusive); depois dele, é apagado de vez.',
        'The window names the use case and the trash period. Deleting sends the use case to the trash and removes from the project menus the items that pointed to it. Users lose the screen right away. Within the period you can restore everything (menus included); after it, it is permanently erased.',
        'La ventana cita el nombre del caso de uso y el plazo de la papelera. Eliminar envía el caso de uso a la papelera y quita de los menús del proyecto los elementos que apuntaban a él. Los usuarios pierden la pantalla al instante. Dentro del plazo se restaura todo (menús incluidos); después se borra definitivamente.',
      ], { skipIfMissing: true, readOnly: true }),
      st('yes', 'studio.delete_yes', ['Mover para a lixeira', 'Move to trash', 'Mover a la papelera'], [
        'Este é o botão que exclui: ele manda o caso de uso para a lixeira. Neste tour ele não responde a clique, de propósito. Fora do tour, confira o nome na janela antes de confirmar.',
        'This is the button that deletes: it sends the use case to the trash. In this tour it does not respond to clicks, on purpose. Outside the tour, check the name in the window before confirming.',
        'Este es el botón que elimina: envía el caso de uso a la papelera. En este recorrido no responde a clics, a propósito. Fuera del recorrido, compruebe el nombre en la ventana antes de confirmar.',
      ], { skipIfMissing: true, readOnly: true }),
      st('cancel', 'studio.delete_cancel', ['Cancelar', 'Cancel', 'Cancelar'], [
        'Clique em "Cancelar" para fechar a janela sem excluir nada.',
        'Click "Cancel" to close the window without deleting anything.',
        'Haga clic en "Cancelar" para cerrar la ventana sin eliminar nada.',
      ], { skipIfMissing: true }),
      st('bin', 'studio.trash', ['A lixeira', 'The trash', 'La papelera'], [
        'Este botão abre a lixeira do projeto: lá ficam os casos de uso excluídos, com o tempo que falta para cada um. "Restaurar" traz de volta a tela, os componentes, as permissões por perfil e os itens de menu. O prazo é definido pela plataforma (não por você nem pelo dono do workspace).',
        'This button opens the project trash: deleted use cases stay there, with the time left for each. "Restore" brings back the screen, components, permissions per role and menu items. The period is set by the platform (not by you or the workspace owner).',
        'Este botón abre la papelera del proyecto: allí quedan los casos de uso eliminados, con el tiempo que falta para cada uno. "Restaurar" devuelve la pantalla, los componentes, los permisos por perfil y los elementos de menú. El plazo lo define la plataforma (no usted ni el dueño del workspace).',
      ], { skipIfMissing: true, readOnly: true, enterClick: 'studio.delete_cancel' }),
      st('end', undefined, ['Dica final', 'Final tip', 'Consejo final'], [
        'Para testar a exclusão sem risco, crie um caso de uso de teste (tour "Criar: Pesquisa + Cadastro") e use ele aqui, fora do tour.',
        'To test deleting without risk, create a test use case (tour "Create: Search + Form") and use it here, outside the tour.',
        'Para probar la eliminación sin riesgo, cree un caso de uso de prueba (recorrido "Crear: Búsqueda + Registro") y úselo aquí, fuera del recorrido.',
      ]),
    ],
  },
]
