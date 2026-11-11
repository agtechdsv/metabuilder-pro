/**
 * Tour da tela "Aviso de Sincronização" (/admin/:workspace/:project/sync-resolution): aparece quando a sincronização do banco do cliente
 * encontrou tabelas ou colunas que sumiram, e o projeto fica com "Sincronização pendente". A tela só existe nesse estado.
 * Só explica: o tour nunca clica em "Aplicar Resoluções e Sincronizar". Escolher uma ação nas listas é livre, porque nada vale antes de aplicar.
 * Alvos: `data-help-id` sync.* de SyncResolutionClient.
 */

import type { HelpText } from '../helpText'
import type { PlatformStep, PlatformTour } from './types'

type T3 = readonly [string, string, string]
const h = (t: T3): HelpText => ({ pt: t[0], en: t[1], es: t[2] })
const st = (id: string, target: string | undefined, title: T3 | undefined, body: T3, extra: Partial<PlatformStep> = {}): PlatformStep =>
  ({ id, ...(target ? { target } : {}), ...(title ? { title: h(title) } : {}), body: h(body), ...extra })

const ROUTE = '/admin/:workspace/:project/sync-resolution'
const OPT = { skipIfMissing: true }

export const SYNC_RESOLUTION_TOURS: readonly PlatformTour[] = [
  {
    id: 'studio-sync-resolucao',
    route: ROUTE,
    neverClick: ['sync.apply'],
    title: h(['Sincronização pendente: resolver as diferenças', 'Pending sync: resolve the differences', 'Sincronización pendiente: resolver las diferencias']),
    summary: h(['Quando a sincronização acha tabelas ou colunas que sumiram do banco, esta tela deixa você renomear ou excluir, sem perder fluxos e casos de uso.', 'When the sync finds tables or columns that disappeared from the database, this screen lets you rename or delete them, without losing flows and use cases.', 'Cuando la sincronización encuentra tablas o columnas que desaparecieron de la base, esta pantalla permite renombrar o eliminar, sin perder flujos y casos de uso.']),
    steps: [
      st('header', 'sync.header', ['Por que esta tela apareceu', 'Why this screen showed up', 'Por qué apareció esta pantalla'], [
        'A última sincronização com o banco do cliente não encontrou tabelas ou colunas que o projeto conhecia. Isso costuma ser um nome mudado no banco legado. Se o projeto apagasse tudo sozinho, os casos de uso e os fluxos ligados a elas seriam perdidos; por isso o MetaBuilder para e pergunta o que fazer com cada item.',
        'The last sync with the customer database did not find tables or columns that the project knew. This is usually a name changed in the legacy database. If the project erased everything by itself, the use cases and flows tied to them would be lost; that is why MetaBuilder stops and asks what to do with each item.',
        'La última sincronización con la base del cliente no encontró tablas o columnas que el proyecto conocía. Suele ser un nombre cambiado en la base legada. Si el proyecto borrara todo solo, se perderían los casos de uso y flujos ligados a ellas; por eso MetaBuilder se detiene y pregunta qué hacer con cada elemento.',
      ]),
      st('tables', 'sync.tables', ['Tabelas ausentes', 'Missing tables', 'Tablas ausentes'], [
        'Cada linha é uma tabela que sumiu (riscada, em vermelho). Escolha na lista: "Renomear para" uma das tabelas novas do banco (os fluxos e casos de uso passam a apontar para ela) ou "Confirmar Exclusão Definitiva" (perde os fluxos ligados a essa tabela). Pode escolher à vontade: nada vale até aplicar.',
        'Each row is a table that disappeared (struck through, in red). Choose from the list: "Rename to" one of the new tables of the database (the flows and use cases then point to it) or "Confirm Permanent Deletion" (loses the flows tied to that table). Feel free to choose: nothing applies until you apply.',
        'Cada fila es una tabla que desapareció (tachada, en rojo). Elija en la lista: "Renombrar a" una de las tablas nuevas de la base (los flujos y casos de uso pasan a apuntar a ella) o "Confirmar Eliminación Definitiva" (pierde los flujos ligados a esa tabla). Puede elegir con libertad: nada vale hasta aplicar.',
      ], { ...OPT, interactive: true }),
      st('fields', 'sync.fields', ['Colunas ausentes', 'Missing columns', 'Columnas ausentes'], [
        'O mesmo para as colunas, agrupadas por tabela. Elas só aparecem depois que a tabela delas foi resolvida; se a tabela foi renomeada, a lista oferece as colunas da tabela nova, e as que existem com o mesmo nome são ligadas sozinhas. Excluir uma coluna perde as lógicas de formulário que a usam.',
        'The same for the columns, grouped by table. They only appear after their table has been resolved; if the table was renamed, the list offers the columns of the new table, and those that exist with the same name are linked automatically. Deleting a column loses the form logic that uses it.',
        'Lo mismo para las columnas, agrupadas por tabla. Solo aparecen después de resolver su tabla; si la tabla fue renombrada, la lista ofrece las columnas de la tabla nueva, y las que existen con el mismo nombre se vinculan solas. Eliminar una columna pierde las lógicas de formulario que la usan.',
      ], { ...OPT, interactive: true }),
      st('apply', 'sync.apply', ['Aplicar Resoluções e Sincronizar', 'Apply Resolutions and Sync', 'Aplicar Resoluciones y Sincronizar'], [
        'O botão só habilita quando todos os itens têm uma ação escolhida. Ao clicar, as escolhas valem de uma vez e você volta ao Studio. As exclusões não voltam, então confira antes. O tour nunca clica neste botão.',
        'The button is only enabled when every item has an action chosen. When you click, the choices apply at once and you go back to the Studio. Deletions cannot be undone, so check first. The tour never clicks this button.',
        'El botón solo se habilita cuando todos los elementos tienen una acción elegida. Al hacer clic, las elecciones valen de una vez y vuelve al Studio. Las eliminaciones no se deshacen, así que revise antes. El tour nunca hace clic en este botón.',
      ], { readOnly: true }),
    ],
  },
]
