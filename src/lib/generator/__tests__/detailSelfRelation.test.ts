import { describe, it, expect } from 'vitest'
import { generateDetailPage } from '../layers/routes/detail-page'

const campo = (col: string, extra: Record<string, unknown> = {}) =>
  ({ id: col, dbColumn: col, sqlExpression: col, label: col, dataType: 'varchar', isPrimaryKey: false, isSortable: true, isVirtual: false, isByoc: false, config: {}, ...extra })

/** Uma rota mínima de tarefas com a relação de uma coluna com a própria tabela (a tarefa antecessora). */
const rota = (colunaAntecessora: string) => ({
  viewSlug: 'kanban-tarefas', path: '/kanban-tarefas', title: 'Tarefas', logicType: 'kanban', displayType: 'kanban',
  modelName: 'Tarefas', modelTable: 'tarefas', primaryKey: 'id',
  formFields: [
    campo('titulo'),
    campo(colunaAntecessora, { dataType: 'uuid', config: { relation: { targetTable: 'tarefas', targetModel: 'Tarefas', displayColumn: 'titulo', valueColumn: 'id' } } }),
  ],
  gridFields: [], filterFields: [], buttons: [], relationTabs: [], customSlots: [],
}) as any

describe('edição: lista da relação de uma coluna com a própria tabela', () => {
  it('Postgres (coluna em minúsculas): a lista de tarefas entra nas opções da tarefa antecessora', () => {
    const src = generateDetailPage(rota('tarefa_antecessora_id'), 'pt', 'edit')
    expect(src).toContain("'tarefa_antecessora_id': (tarefasLookupList || [])")
  })

  it('Oracle (coluna em MAIÚSCULAS): a lista também entra; sem ela a edição apagava a tarefa antecessora ao salvar', () => {
    const src = generateDetailPage(rota('TAREFA_ANTECESSORA_ID'), 'pt', 'edit')
    expect(src).toContain("'TAREFA_ANTECESSORA_ID': (tarefasLookupList || [])")
  })
})
