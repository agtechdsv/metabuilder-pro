import { AppAST } from '../../ast'
import { generateListPage } from './list-page'
import { generateDetailPage, generateDetailTabsClient, generateDetailSchema } from './detail-page'
import { generateNewPage } from './new-page'
import { generateKanbanPage, generateKanbanClient, generateKanbanSchema } from './kanban-page'
import { generateTimelinePage, generateTimelineClient, generateTimelineSchema } from './timeline-page'
import { generateAnalyticsPage, generateAnalyticsClient } from './analytics-page'
import { generateWipPage } from './wip-page'

export * from './helpers'
export * from './list-page'
export * from './detail-page'
export * from './new-page'
export * from './kanban-page'
export * from './timeline-page'
export * from './analytics-page'
export * from './wip-page'

// ─────────────────────────────────────────────────────────────────────────────
// Entry point para geração de rotas
// ─────────────────────────────────────────────────────────────────────────────

export function generateRoutes(ast: AppAST, files: Map<string, string>) {
  for (const route of ast.routes) {
    const routeDir = `app/(protected)${route.path}`

    if (route.logicType === 'pesquisa_cadastro' || route.logicType === 'personalizado') {
      // Listagem
      files.set(`${routeDir}/page.tsx`, generateListPage(route))
      // Mestre-Detalhe + Edição (formulário + abas de relacionamento)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'kanban') {
      // Kanban Listagem
      files.set(`${routeDir}/page.tsx`, generateKanbanPage(route))
      files.set(`${routeDir}/KanbanClient.tsx`, generateKanbanClient(route))
      files.set(`${routeDir}/schema.ts`, generateKanbanSchema(route))
      // Mestre-Detalhe + Edição (ao clicar no card)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'timeline') {
      // Timeline Listagem
      files.set(`${routeDir}/page.tsx`, generateTimelinePage(route))
      files.set(`${routeDir}/TimelineClient.tsx`, generateTimelineClient(route))
      files.set(`${routeDir}/schema.ts`, generateTimelineSchema(route))
      // Mestre-Detalhe + Edição (ao clicar no nó/card)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'analytics' || route.logicType === 'dashboard_bi') {
      // Dashboard BI / Analytics (Server-Side Aggregation)
      files.set(`${routeDir}/page.tsx`, generateAnalyticsPage(route, ast))
      files.set(`${routeDir}/AnalyticsClient.tsx`, generateAnalyticsClient(route, ast))
      if (route.gridFields.length > 0) {
        files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
        files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
        files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
        files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
      }
    } else {
      // Placeholder "Em desenvolvimento" para outros tipos
      files.set(`${routeDir}/page.tsx`, generateWipPage(route))
    }
  }
}
