'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'

interface ResetMfaModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isResetting: boolean
}

export function ResetMfaModal({
  isOpen,
  onClose,
  onConfirm,
  isResetting
}: ResetMfaModalProps) {
  const { t } = useI18n()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('team_drawer.reset_mfa_modal_title', 'Resetar MFA do Usuário')}
      description={t(
        'team_drawer.reset_mfa_modal_desc',
        'Tem certeza que deseja desvincular o Authenticator deste usuário? Ele precisará configurar novamente no próximo login caso a política de MFA esteja ativa no Workspace.'
      )}
      size="sm"
    >
      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={onClose}
          disabled={isResetting}
          className="flex-1 h-11 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-sm transition-colors"
        >
          {t('team_drawer.cancel', 'Cancelar')}
        </button>
        <button
          onClick={onConfirm}
          disabled={isResetting}
          className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
        >
          {isResetting ? t('team_drawer.resetting', 'Resetando...') : t('team_drawer.confirm_reset_mfa', 'Sim, Resetar MFA')}
        </button>
      </div>
    </Modal>
  )
}
