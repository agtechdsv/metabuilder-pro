import { AppAST } from '../../ast'
import { generateUiPrimitives } from './ui-primitives'
import { generateRelationSectionComponent } from './relation-section'
import { generateMasterFormComponent } from './master-form'
import { generateByocComponents } from './byoc'
import { generateKanbanBoardComponent } from './kanban-board'
import { generateTimelineBoardComponent } from './timeline-board'
import { generateGalleryBoardComponent } from './gallery-board'
import { generateGanttBoardComponent } from './gantt-board'
import { generateMapBoardComponent } from './map-board'

export * from './ui-primitives'
export * from './relation-section'
export * from './master-form'
export * from './byoc'
export * from './kanban-board'
export * from './timeline-board'
export * from './gallery-board'
export * from './gantt-board'
export * from './map-board'

/**
 * generateComponents
 *
 * Ponto de entrada modular para geração dos componentes do projeto ejetado.
 */
export function generateComponents(ast: AppAST, files: Map<string, string>) {
  generateUiPrimitives(files)
  generateRelationSectionComponent(files)
  generateMasterFormComponent(files)
  generateByocComponents(ast, files)
  generateKanbanBoardComponent(files)
  generateTimelineBoardComponent(files)
  generateGalleryBoardComponent(files)
  generateGanttBoardComponent(files)
  generateMapBoardComponent(files)
}
