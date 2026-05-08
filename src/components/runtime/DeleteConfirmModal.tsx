'use client'

import { Modal } from '@/components/ui/Modal'
import { AlertCircle, Trash2, Loader2 } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  isLoading?: boolean
  recordName?: string
}

export default function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading = false,
  recordName 
}: DeleteConfirmModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Excluir Registro"
      description="Esta ação não pode ser desfeita e removerá permanentemente os dados do banco."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold">Você tem certeza?</p>
            <p className="text-xs opacity-80">Você está prestes a excluir {recordName ? <strong>"{recordName}"</strong> : 'este registro'}.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            Cancelar
          </button>
          
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
