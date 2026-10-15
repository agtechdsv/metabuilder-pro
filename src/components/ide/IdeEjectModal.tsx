'use client'

import React, { useEffect, useRef } from 'react'
import { ProjectExportModal } from '@/components/workspace/project-manager/ProjectExportModal'
import { useProjectExport } from '@/components/workspace/project-manager/useProjectExport'
import { WorkspaceExportModal } from '@/components/workspace/WorkspaceExportModal'
import type { Project, ExportDefaults } from '@/components/workspace/project-manager/types'

interface IdeEjectModalProps {
  isOpen: boolean
  /** finished: a exportação foi concluída (e não apenas cancelada) */
  onClose: (finished?: boolean) => void
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string } | null
  /** escolhas já feitas na tela Ejetar & Sincronizar */
  prefill?: Partial<ExportDefaults>
}

/**
 * Ejetar (botão da IDE Local): gera o código final, UMA vez, na pasta que o dev escolher. O resultado é um projeto independente,
 * sem o vínculo de sincronização. Usa o mesmo motor e a mesma tela de opções (banco, login, gestão de acesso, backend Java...)
 * que o resto da exportação; depois de gerar, cuida do npm install, das tabelas de acesso, de rodar o app e do VS Code.
 */
export function IdeEjectModal({ isOpen, onClose, target, prefill }: IdeEjectModalProps) {
  const { downloadModal, setDownloadModal, exportModels, openExportModal, handleStartExport } = useProjectExport()

  // abre já com o que o projeto tem configurado (banco e login)
  useEffect(() => {
    if (!isOpen || !target || target.type !== 'project' || downloadModal) return
    openExportModal({ id: target.id, name: target.name, slug: target.slug, is_active: true, workspace_id: '' } as Project, prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target?.id])

  // se a modal sumir sem passar pelo onClose (ex.: o usuário cancela a escolha da pasta), avisa o pai: senão ele continua "aberto" e o próximo clique em Ejetar não faz nada
  const wasShown = useRef(false)
  useEffect(() => {
    if (!isOpen) { wasShown.current = false; return }
    if (target?.type !== 'project') return
    if (downloadModal?.open) wasShown.current = true
    else if (wasShown.current) { wasShown.current = false; onClose(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, downloadModal])

  if (!isOpen || !target) return null

  if (target.type === 'workspace') {
    return (
      <div className="relative z-[1000000]">
        <WorkspaceExportModal
          isOpen
          onClose={onClose}
          workspaceSlug={target.slug}
          workspaceId={target.id}
          projectCount={0}
        />
      </div>
    )
  }

  if (!downloadModal?.open) return null
  return (
    <div className="relative z-[1000000]">
      <ProjectExportModal
        modalState={downloadModal}
        onClose={() => { const finished = downloadModal.phase === 'done'; setDownloadModal(null); onClose(finished) }}
        onStartExport={handleStartExport}
        exportModels={exportModels}
      />
    </div>
  )
}
