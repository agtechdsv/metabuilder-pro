import React from 'react'
import { Plus } from 'lucide-react'
import { RuntimeHeader } from '../RuntimeHeader'
import { ExportDropdown } from '../ExportControls'
import { HelpPopover } from '../HelpPopover'
import { InteractiveHelpButton } from '../InteractiveHelp'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

export interface ViewPageHeaderProps {
  viewName: string
  description?: string
  screenHelp?: unknown
  interactiveHelp?: unknown
  /** ajuda atual dos campos (legenda ao vivo da ajuda interativa) */
  interactiveLiveHelp?: Record<string, any>
  icon?: string
  workspace: any
  project: any
  /** obsoleto: o botão "Automações" saiu dos casos de uso (o fluxo é da tabela; a entrada é o card "Automação de processos"). Mantido opcional por causa do app exportado. */
  isAutomationsEnabled?: boolean
  viewId: string
  logicType?: string
  canExport: boolean
  exportFormats: string[]
  modelName: string
  cleanDisplayFields: any[]
  joins: any[]
  globalFilterValues: any
  isPageVisible: boolean
  isModalOpen: boolean
  isDrawerOpen: boolean
  selectedRow: any
  activeRelations: any[]
  masterModelId?: string
  tableDictionary?: any
  primaryKeyName?: string
  canAdd: boolean
  btnAdd: any
  labelAdd: string
  handleOpenAdd: () => void
  getButtonStyles: (btn: any) => React.CSSProperties
}

export function ViewPageHeader({
  viewName,
  description,
  screenHelp,
  interactiveHelp,
  interactiveLiveHelp,
  icon,
  workspace,
  project,
  viewId,
  logicType,
  canExport,
  exportFormats,
  modelName,
  cleanDisplayFields,
  joins,
  globalFilterValues,
  isPageVisible,
  isModalOpen,
  isDrawerOpen,
  selectedRow,
  activeRelations,
  masterModelId,
  tableDictionary,
  primaryKeyName,
  canAdd,
  btnAdd,
  labelAdd,
  handleOpenAdd,
  getButtonStyles
}: ViewPageHeaderProps) {
  const { t } = useI18n()

  return (
    <RuntimeHeader 
      viewName={viewName}
      subtitle={description}
      icon={icon}
      actions={(
        <div className="flex items-center gap-3">
          <InteractiveHelpButton config={interactiveHelp} liveHelp={interactiveLiveHelp} projectId={project.id} viewId={viewId} screenName={viewName} modelName={modelName} primaryKeyName={primaryKeyName} />
          <HelpPopover help={screenHelp} variant="screen" feedback={{ projectId: project.id, screen: viewId, zone: 'screen' }} centralHref={`/${workspace.slug}/${project.slug}/help`} />
          {logicType !== 'analytics' && project.theme_config?.enable_downloads !== false && canExport && (
              <ExportDropdown 
                projectId={project.id}
                workspaceSlug={workspace.slug}
                projectSlug={project.slug}
                viewName={viewName}
                modelName={modelName}
                displayFields={cleanDisplayFields}
                joins={joins || []}
                filters={globalFilterValues}
                exportFormats={exportFormats}
                selectedRecord={(isPageVisible || isModalOpen || isDrawerOpen) ? selectedRow : null}
                projectRelations={activeRelations}
                masterModelId={masterModelId}
                dictionary={tableDictionary}
                primaryKeyName={primaryKeyName}
              />
          )}
          {canAdd && (
            <button 
              data-tour="new"
              onClick={handleOpenAdd}
              style={getButtonStyles(btnAdd)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95",
                (btnAdd?.custom_label !== undefined && btnAdd.custom_label !== '') ? "" : "capitalize tracking-wider"
              )}
            >
              <Plus className="w-4 h-4" />
              {labelAdd}
            </button>
          )}
        </div>
      )}
    />
  )
}
