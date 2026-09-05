'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

interface RemoveGuestModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export function RemoveGuestModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}: RemoveGuestModalProps) {
  const { t } = useI18n()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('team_drawer.remove_modal_title', 'Confirmar Remoção de Convidado')}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-500">
              {t('team_drawer.remove_modal_warning', 'Deseja remover este convidado?')}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {t(
                'team_drawer.remove_modal_desc',
                'O acesso deste membro ao Studio e a todos os workspaces e projetos atribuídos será revogado imediatamente.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
          >
            {isDeleting ? t('team_drawer.removing', 'Removendo...') : t('team_drawer.confirm_remove', 'Sim, Remover')}
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
          >
            {t('team_drawer.cancel', 'Cancelar')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
