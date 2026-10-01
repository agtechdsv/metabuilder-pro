'use client'

import React, { useEffect, useState } from 'react'
import { X, FolderOpen, Save, Loader2, Settings } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { getProjectDownloadPath, setProjectDownloadPath } from '@/utils/tunnelConfigFile'

interface DownloadPathModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
}

/**
 * Define o downloadPath DESTE projeto dentro do metabuilder.config.json local da IDE
 * (connections[].downloadPath). Vale a partir do próximo início do túnel.
 */
export function DownloadPathModal({ isOpen, onClose, projectId, projectName }: DownloadPathModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [path, setPath] = useState('')
  const [globalPath, setGlobalPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsLoading(true)
    getProjectDownloadPath(projectId)
      .then(res => {
        if (cancelled) return
        setPath(res.projectPath)
        setGlobalPath(res.globalPath)
      })
      .catch(err => toast((err?.message as string) || t('studio_downloads_path.load_error', 'Erro ao ler o metabuilder.config.json.'), 'error'))
      .finally(() => !cancelled && setIsLoading(false))
    return () => { cancelled = true }
  }, [isOpen, projectId])

  if (!isOpen) return null

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, defaultPath: path || globalPath || undefined })
      if (selected && typeof selected === 'string') setPath(selected)
    } catch (e) {
      console.error('Erro ao abrir seletor de pasta', e)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await setProjectDownloadPath(projectId, path)
      if (result === 'not_found') {
        toast(t('studio_downloads_path.project_not_found', 'Este projeto ainda não existe no metabuilder.config.json. Adicione-o em "Configurar (metabuilder.config.json)" na tela de projetos.'), 'error')
        return
      }
      toast(t('studio_downloads_path.saved', 'Pasta de downloads salva. Vale a partir do próximo início do túnel.'), 'success')
      onClose()
    } catch (e: any) {
      toast((t('studio_downloads_path.save_error', 'Erro ao salvar: ')) + (e?.message || ''), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><Settings className="w-5 h-5" /></div>
            <div>
              <h3 className="font-black text-lg text-neutral-900 dark:text-white">
                {t('studio_downloads_path.title', 'Pasta de Downloads')}
              </h3>
              <p className="text-xs text-neutral-500">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t('studio_downloads_path.desc', 'Pasta da máquina do agente onde os arquivos exportados deste projeto são gravados. Fica salva no metabuilder.config.json, dentro deste projeto.')}
          </p>
          <label className="block text-[10px] uppercase font-bold text-neutral-400">
            {t('studio_downloads_path.label', 'Caminho da pasta')}
          </label>
          <div className="flex gap-2">
            <input
              value={path}
              disabled={isLoading}
              onChange={e => setPath(e.target.value)}
              placeholder={globalPath || 'C:\\AgTech\\DownloadsMetaBuilder'}
              className="flex-1 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              type="button"
              onClick={handleBrowse}
              className="px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-blue-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              title={t('studio_downloads_path.browse', 'Procurar pasta')}
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
          {globalPath && (
            <p className="text-[11px] text-neutral-400">
              {t('studio_downloads_path.global_hint', 'Se ficar vazio, será usado o padrão global:')} <span className="font-mono">{globalPath}</span>
            </p>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            {t('studio_downloads_path.cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('studio_downloads_path.save', 'Salvar')}
          </button>
        </div>
      </div>
    </div>
  )
}
