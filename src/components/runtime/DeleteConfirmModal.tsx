'use client'

import { Modal } from '@/components/ui/Modal'
import { AlertCircle, Trash2, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  isLoading?: boolean
  recordName?: string
  /** exclusão em cascata: o que será apagado junto (items null = não foi possível contar; undefined = sem cascata) */
  cascade?: { loading: boolean; items: Array<{ name: string; count: number }> | null }
  /** Camada da modal: deve ficar ACIMA de qualquer modal aberta que a originou (padrão da Modal: 200) */
  zIndex?: number
}

export default function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading = false,
  recordName,
  cascade,
  zIndex
}: DeleteConfirmModalProps) {
  const { t } = useI18n()
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      zIndex={zIndex}
      title={t('runtime.delete_confirm.title')}
      description={t('runtime.delete_confirm.desc')}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold">{t('runtime.delete_confirm.are_you_sure')}</p>
            <p className="text-xs opacity-80">{t('runtime.delete_confirm.delete_record_desc').replace('{name}', recordName ? `"${recordName}"` : t('runtime.delete_confirm.title'))}</p>
          </div>
        </div>

        {cascade?.loading && (
          <p className="flex items-center gap-2 text-xs text-neutral-500"><Loader2 className="w-4 h-4 animate-spin" /> {t('runtime.delete_confirm.cascade_loading')}</p>
        )}
        {cascade && !cascade.loading && cascade.items === null && (
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{t('runtime.delete_confirm.cascade_unknown')}</p>
        )}
        {cascade && !cascade.loading && cascade.items && cascade.items.length > 0 && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-2">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{t('runtime.delete_confirm.cascade_title')}</p>
            <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
              {cascade.items.map(i => (
                <li key={i.name} className="flex justify-between gap-4"><span>{i.name}</span><span className="font-black">{i.count}</span></li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            {t('common.cancel')}
          </button>
          
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isLoading ? t('runtime.delete_confirm.deleting') : t('runtime.delete_confirm.confirm_delete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
