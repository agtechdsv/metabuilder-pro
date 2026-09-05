import { AppAST } from '../../ast'
import { generateListPage } from './list-page'
import { generateDetailPage, generateDetailTabsClient, generateDetailSchema } from './detail-page'
import { generateNewPage } from './new-page'
import { generateKanbanPage, generateKanbanClient, generateKanbanSchema } from './kanban-page'
import { generateTimelinePage, generateTimelineClient, generateTimelineSchema } from './timeline-page'
import { generateSchedulerPage, generateSchedulerClient, generateSchedulerSchema } from './scheduler-page'
import { generateGalleryPage, generateGalleryClient, generateGallerySchema } from './gallery-page'
import { generateGanttPage, generateGanttClient, generateGanttSchema } from './gantt-page'
import { generateMapPage, generateMapClient, generateMapSchema } from './map-page'
import { generateBlueprintPage, generateBlueprintClient, generateBlueprintSchema } from './blueprint-page'
import { generateMindMapPage, generateMindMapClient, generateMindMapSchema } from './mindmap-page'
import { generateAnalyticsPage, generateAnalyticsClient } from './analytics-page'
import { generateWipPage } from './wip-page'

export * from './helpers'
export * from './list-page'
export * from './detail-page'
export * from './new-page'
export * from './kanban-page'
export * from './timeline-page'
export * from './scheduler-page'
export * from './gallery-page'
export * from './gantt-page'
export * from './map-page'
export * from './blueprint-page'
export * from './mindmap-page'
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
    } else if (route.logicType === 'scheduler') {
      // Scheduler Listagem
      files.set(`${routeDir}/page.tsx`, generateSchedulerPage(route))
      files.set(`${routeDir}/SchedulerClient.tsx`, generateSchedulerClient(route))
      files.set(`${routeDir}/schema.ts`, generateSchedulerSchema(route))
      // Mestre-Detalhe + Edição (ao clicar no evento)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'galeria') {
      // Galeria (Vitrine de Catálogo / Assets)
      files.set(`${routeDir}/page.tsx`, generateGalleryPage(route))
      files.set(`${routeDir}/GalleryClient.tsx`, generateGalleryClient(route))
      files.set(`${routeDir}/schema.ts`, generateGallerySchema(route))
      // Mestre-Detalhe + Edição (ao clicar no card)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'gantt') {
      // Gantt (Cronograma de Projetos)
      files.set(`${routeDir}/page.tsx`, generateGanttPage(route))
      files.set(`${routeDir}/GanttClient.tsx`, generateGanttClient(route))
      files.set(`${routeDir}/schema.ts`, generateGanttSchema(route))
      // Mestre-Detalhe + Edição (ao clicar na tarefa/barra)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'map' || route.logicType === 'mapa') {
      // Mapa (Visão Geoespacial / Marcadores no Mapa)
      files.set(`${routeDir}/page.tsx`, generateMapPage(route))
      files.set(`${routeDir}/MapClient.tsx`, generateMapClient(route))
      files.set(`${routeDir}/schema.ts`, generateMapSchema(route))
      // Mestre-Detalhe + Edição (ao clicar no marcador)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'blueprint') {
      // Blueprint (Fluxograma de Processos / Nós e Predecessores)
      files.set(`${routeDir}/page.tsx`, generateBlueprintPage(route))
      files.set(`${routeDir}/BlueprintClient.tsx`, generateBlueprintClient(route))
      files.set(`${routeDir}/schema.ts`, generateBlueprintSchema(route))
      // Mestre-Detalhe + Edição (ao clicar na etapa/nó)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      files.set(`${routeDir}/[id]/schema.ts`, generateDetailSchema(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else if (route.logicType === 'mapa_mental') {
      // Mapa Mental (Níveis Hierárquicos / Orbitais Radiais)
      files.set(`${routeDir}/page.tsx`, generateMindMapPage(route))
      files.set(`${routeDir}/MindMapClient.tsx`, generateMindMapClient(route))
      files.set(`${routeDir}/schema.ts`, generateMindMapSchema(route))
      // Mestre-Detalhe + Edição (ao clicar no nó)
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
