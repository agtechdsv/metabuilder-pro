'use client'

import React, { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { IconPicker } from '@/components/studio/IconPicker'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { useI18n } from '@/i18n/I18nContext'
import { Project } from './types'

export interface ProjectFormData {
  name: string
  slug: string
  description: string
  icon: string
  is_active: boolean
  show_in_portal: boolean
  login_logo_url: string
  login_banner_url: string
}

interface ProjectFormDrawerProps {
  isOpen: boolean
  onClose: () => void
  selectedProject: Project | null
  formData: ProjectFormData
  setFormData: React.Dispatch<React.SetStateAction<ProjectFormData>>
  onSave: (e: React.FormEvent) => void
  isSaving: boolean
}

export function ProjectFormDrawer({
  isOpen,
  onClose,
  selectedProject,
  formData,
  setFormData,
  onSave,
  isSaving
}: ProjectFormDrawerProps) {
  const { t } = useI18n()
  const [showIconPicker, setShowIconPicker] = useState(false)

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={selectedProject ? t('dashboard.projects.edit_project') : t('dashboard.projects.new_project')}
    >
      <form onSubmit={onSave} className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('dashboard.projects.project_name')}
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: selectedProject ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-')
                })
              }
              placeholder={t('dashboard.projects.name_placeholder')}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('dashboard.projects.project_slug')}
            </label>
            <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
              <span className="text-neutral-400 dark:text-neutral-600 text-sm">/</span>
              <input
                required
                type="text"
                value={formData.slug}
                onChange={e =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-')
                  })
                }
                placeholder="crm-vendas"
                className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none text-neutral-900 dark:text-white"
              />
            </div>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-600">{t('dashboard.slug_hint')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('dashboard.projects.project_description')}
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('dashboard.projects.desc_placeholder')}
              rows={3}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white resize-none"
            />
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('dashboard.projects.project_icon')}
            </label>
            <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                <DynamicIcon icon={formData.icon || 'Box'} size={24} />
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
                >
                  {t('dashboard.projects.change_icon')}
                </button>
              </div>
            </div>

            {showIconPicker && (
              <IconPicker
                currentIcon={formData.icon || 'Box'}
                onSelect={(icon) => {
                  setShowIconPicker(false)
                  setFormData({ ...formData, icon })
                }}
                onClose={() => setShowIconPicker(false)}
              />
            )}
          </div>

          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                {t('workspace_components.portal_modal.portal_branding', 'Portal & Branding')}
              </h4>
              <p className="text-xs text-neutral-500">
                {t('workspace_components.portal_modal.portal_branding_desc', 'Configure a exibição deste projeto no Portal de Aplicações e a personalização da tela de login.')}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl">
              <input
                type="checkbox"
                id="showInPortal"
                checked={formData.show_in_portal}
                onChange={(e) => setFormData({ ...formData, show_in_portal: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="showInPortal" className="text-sm font-medium text-neutral-900 dark:text-white cursor-pointer select-none">
                {t('workspace_components.portal_modal.show_in_portal', 'Exibir no Portal de Aplicações')}
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                {t('workspace_components.portal_modal.logo_url', 'Logo do Portal (Opcional)')}
              </label>
              <input
                type="url"
                value={formData.login_logo_url}
                onChange={e => setFormData({ ...formData, login_logo_url: e.target.value })}
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
                value={formData.login_banner_url}
                onChange={e => setFormData({ ...formData, login_banner_url: e.target.value })}
                placeholder="https://sua-empresa.com/banner.jpg"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
              <p className="text-[10px] text-neutral-500 dark:text-neutral-600">
                {t('workspace_components.portal_modal.banner_hint', 'Recomendado: Imagem vertical ou padrão geométrico.')}
              </p>
            </div>
          </div>

          {selectedProject && (
            <div className="pt-4 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('dashboard.projects.status_title')}</p>
                <p className="text-xs text-neutral-500">{t('dashboard.projects.status_desc')}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`w-12 h-6 rounded-full transition-all relative ${formData.is_active ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-800'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_active ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-neutral-900">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            {isSaving ? t('common.loading') : selectedProject ? t('common.save') : t('dashboard.projects.new_project')}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
