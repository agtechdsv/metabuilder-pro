'use client'

import React from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Pencil,
  Trash2,
  Activity,
  Layers,
  Power,
  PowerOff,
  ArrowUpRight,
  Monitor,
  Download,
  FolderGit2,
  Database,
  Loader2
} from 'lucide-react'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { ProGate } from '@/components/ui/ProGate'
import { Project } from './types'

interface ProjectCardProps {
  project: Project
  workspaceSlug: string
  tier?: string
  isNavigating: boolean
  onNavigate: (slug: string) => void
  onOpenPreview: (url: string, title: string) => void
  onOpenDesktopModal: (project: Project) => void
  onOpenIDE: (project: Project) => void
  onOpenExportModal: (project: Project) => void
  onTogglePortal: (project: Project) => void
  onToggleActive: (project: Project) => void
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectCard({
  project,
  workspaceSlug,
  tier = 'free',
  isNavigating,
  onNavigate,
  onOpenPreview,
  onOpenDesktopModal,
  onOpenIDE,
  onOpenExportModal,
  onTogglePortal,
  onToggleActive,
  onEdit,
  onDelete
}: ProjectCardProps) {
  const { t } = useI18n()

  return (
    <div
      className={cn(
        "group relative p-5 bg-white dark:bg-neutral-950 border rounded-[2rem] transition-all shadow-sm hover:shadow-xl dark:shadow-none",
        isNavigating
          ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-lg scale-[0.98] pointer-events-none"
          : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50"
      )}
    >
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-start justify-between">
          <Link
            href={`/admin/${workspaceSlug}/${project.slug}/studio`}
            onClick={() => onNavigate(project.slug)}
            className="flex flex-col gap-4 flex-1 min-w-0"
          >
            <div className={cn(
              "p-3 rounded-2xl w-fit transition-colors flex items-center justify-center min-w-[48px] min-h-[48px] border shrink-0",
              isNavigating
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-500"
                : "bg-neutral-100 dark:bg-neutral-800 border-transparent group-hover:bg-indigo-500/10"
            )}>
              <div className={cn(
                "transition-colors",
                isNavigating ? "text-indigo-500 animate-spin" : "text-neutral-400 group-hover:text-indigo-500"
              )}>
                {isNavigating ? (
                  <Loader2 className="w-6 h-6" />
                ) : (
                  <DynamicIcon icon={project.icon || 'Box'} size={24} />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 w-full min-w-0 pr-20">
              <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-white transition-colors truncate">{project.name}</h4>
              <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate">/{project.slug}</p>
              {project.description && (
                <p className="text-xs text-neutral-500 dark:text-neutral-600 mt-2 line-clamp-2 leading-relaxed min-w-0">
                  {project.description}
                </p>
              )}
            </div>
          </Link>

          <div className="absolute top-5 right-5 flex flex-col items-end gap-2 z-20 pointer-events-none">
            <div className={`pointer-events-auto px-4 py-1.5 text-[10px] font-bold rounded-full border uppercase tracking-widest transition-all ${project.is_active
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>
              {project.is_active ? t('dashboard.projects.status_active') : t('dashboard.projects.status_inactive')}
            </div>

            {!isNavigating && (
              <div className="pointer-events-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm p-1 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800">
                {/* 1. Acessar versão publicada */}
                <button
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-indigo-500 hover:text-indigo-400"
                  title={t('workspace_components.project_card_tooltips.access_published', 'Acessar versão publicada')}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenPreview(`${window.location.origin}/${workspaceSlug}/${project.slug}`, `Projeto: ${project.name}`)
                  }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                {/* 2. Gerar App Desktop Nativo */}
                <ProGate gateType="desktop" tier={tier || 'free'} featureName="Gerar App Desktop Nativo">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onOpenDesktopModal(project)
                    }}
                    className="p-2 text-indigo-500 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                    title={t('workspace_components.project_card_tooltips.generate_desktop', 'Gerar App Desktop Nativo')}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </ProGate>

                {project.can_edit && (
                  <>
                    {/* 3. IDE Local */}
                    <ProGate gateType="desktop" tier={tier || 'free'} featureName="IDE Local (Ejetar & Sincronizar)">
                      <button
                        className="p-2 text-indigo-500 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                        title={t('workspace_components.project_card_tooltips.ide_local', 'IDE Local (Ejetar & Sincronizar)')}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onOpenIDE(project)
                        }}
                      >
                        <FolderGit2 className="w-4 h-4" />
                      </button>
                    </ProGate>

                    {/* 4. Exportar Código Fonte */}
                    <ProGate gateType="desktop" tier={tier || 'free'} featureName="Exportar Código Fonte">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onOpenExportModal(project)
                        }}
                        className="p-2 text-indigo-500 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                        title={t('workspace_components.project_card_tooltips.export_source', 'Exportar Código Fonte (Next.js)')}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </ProGate>
                  </>
                )}

                {/* 5. Remover/Adicionar do Portal */}
                <button
                  onClick={(e) => { e.preventDefault(); onTogglePortal(project); }}
                  className={`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors ${project.theme_config?.show_in_portal ? 'text-indigo-500 hover:text-indigo-600' : 'text-neutral-400 hover:text-indigo-400'}`}
                  title={project.theme_config?.show_in_portal ? t('workspace_components.portal_modal.remove_from_portal', 'Remover do Portal') : t('workspace_components.portal_modal.add_to_portal', 'Adicionar ao Portal')}
                >
                  <Database className="w-4 h-4" />
                </button>

                {/* 6. Desativar/Ativar */}
                {project.can_deactivate && (
                  <button
                    onClick={() => onToggleActive(project)}
                    className={`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors ${project.is_active ? 'text-neutral-500 hover:text-red-400' : 'text-neutral-500 hover:text-emerald-400'}`}
                    title={project.is_active ? t('dashboard.projects.toggle_inactive') : t('dashboard.projects.toggle_active')}
                  >
                    {project.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                )}

                {/* 7. Editar Projeto */}
                {project.can_edit && (
                  <button
                    onClick={() => onEdit(project)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-400"
                    title={t('dashboard.projects.edit_project')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                {/* 8. Excluir Projeto */}
                {project.can_delete && (
                  <button
                    onClick={() => onDelete(project)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-red-400"
                    title={t('dashboard.projects.delete_project')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-neutral-100 dark:border-neutral-800/50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-bold text-neutral-400 tracking-tighter">
                {project.models?.[0]?.count || 0} {t('dashboard.projects.tables')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-bold text-neutral-400 tracking-tighter">
                {t('dashboard.projects.use_cases')}
              </span>
            </div>
          </div>
          <Link
            href={`/admin/${workspaceSlug}/${project.slug}/studio`}
            onClick={() => onNavigate(project.slug)}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm dark:shadow-none",
              isNavigating
                ? "bg-indigo-600 animate-pulse"
                : "bg-neutral-100 dark:bg-neutral-800 group-hover:bg-indigo-600"
            )}
          >
            {isNavigating ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white" />
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
