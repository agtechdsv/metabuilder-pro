'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'

interface WorkspacePortalModalProps {
  isOpen: boolean
  onClose: () => void
  formData: {
    portal_logo_url: string
    portal_banner_url: string
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    portal_logo_url: string
    portal_banner_url: string
  }>>
  onSave: (e: React.FormEvent) => void
  isSaving: boolean
}

export function WorkspacePortalModal({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSave,
  isSaving
}: WorkspacePortalModalProps) {
  const { t } = useI18n()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('workspace_components.portal_modal.title', 'Configurações do Portal')}
    >
      <form onSubmit={onSave} className="space-y-6">
        <div className="space-y-4">
          <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
            <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              {t('workspace_components.portal_modal.appearance_title', 'Aparência do Portal')}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('workspace_components.portal_modal.appearance_desc', 'Personalize as imagens que serão exibidas na tela de login global do Portal de Aplicações.')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('workspace_components.portal_modal.logo_url', 'Logo do Portal (Opcional)')}
            </label>
            <input
              type="url"
              value={formData.portal_logo_url}
              onChange={e => setFormData({ ...formData, portal_logo_url: e.target.value })}
              placeholder="https://sua-empresa.com/logo.png"
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('workspace_components.portal_modal.banner_url', 'Banner do Portal (Opcional)')}
            </label>
            <input
              type="url"
              value={formData.portal_banner_url}
              onChange={e => setFormData({ ...formData, portal_banner_url: e.target.value })}
              placeholder="https://sua-empresa.com/banner.jpg"
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            {isSaving ? t('common.loading') : t('common.save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl font-bold transition-all"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
