'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AIBuilderSettings } from '@/components/workspace/AIBuilderSettings'

interface AIBuilderConfigTriggerProps {
  workspaceId: string
  isPro: boolean
}

export function AIBuilderConfigTrigger({ workspaceId, isPro }: AIBuilderConfigTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-600/20 transition-all"
      >
        Ir para Configurações →
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Configurações IA"
      >
        <div className="p-2">
          <AIBuilderSettings workspaceId={workspaceId} isPro={isPro} />
        </div>
      </Modal>
    </>
  )
}
