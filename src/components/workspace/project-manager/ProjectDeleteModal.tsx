'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { formatDuration } from '@/lib/trash/format'

interface ProjectDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  isDeleting: boolean
  /** prazo da lixeira em horas (para dizer por quanto tempo dá para restaurar) */
  hours: number
}

export function ProjectDeleteModal({
  isOpen,
  onClose,
  onDelete,
  isDeleting,
  hours
}: ProjectDeleteModalProps) {
  const { t } = useI18n()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.projects.delete_project')}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-500">{t('workspace_components.entity_trash.confirm_project_title')}</p>
            <p className="text-xs text-neutral-500 mt-1">{t('workspace_components.entity_trash.confirm_project_desc').replace('{duration}', formatDuration(hours, t))}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onDelete}
            data-help-id="portal.pj_delete_yes"
            disabled={isDeleting}
            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
          >
            {isDeleting ? t('common.loading') : t('workspace_components.entity_trash.confirm_project_yes')}
          </button>
          <button
            onClick={onClose}
            data-help-id="portal.pj_delete_cancel"
            className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
