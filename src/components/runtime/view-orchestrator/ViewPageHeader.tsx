import React from 'react'
import { Plus, Workflow } from 'lucide-react'
import { RuntimeHeader } from '../RuntimeHeader'
import { ExportDropdown } from '../ExportControls'
import { useI18n } from '@/i18n/I18nContext'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface ViewPageHeaderProps {
  viewName: string
  description?: string
  icon?: string
  workspace: any
  project: any
  isAutomationsEnabled: boolean
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
  icon,
  workspace,
  project,
  isAutomationsEnabled,
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
  const router = useRouter()

  return (
    <RuntimeHeader 
      viewName={viewName}
      subtitle={description}
      icon={icon}
      actions={(
        <div className="flex items-center gap-3">
          {isAutomationsEnabled && (
            <button
              onClick={() => router.push(`/${workspace.slug}/${project.slug}/automations?use_case=${viewId}`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full transition-all text-xs font-bold shadow-sm active:scale-95"
              title={t('runtime.automations')}
            >
              <Workflow className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">{t('runtime.automations')}</span>
            </button>
          )}
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
