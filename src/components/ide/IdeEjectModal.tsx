'use client'

import React, { useEffect } from 'react'
import { ProjectExportModal } from '@/components/workspace/project-manager/ProjectExportModal'
import { useProjectExport } from '@/components/workspace/project-manager/useProjectExport'
import { WorkspaceExportModal } from '@/components/workspace/WorkspaceExportModal'
import type { Project, ExportDefaults } from '@/components/workspace/project-manager/types'

interface IdeEjectModalProps {
  isOpen: boolean
  onClose: () => void
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

  if (!isOpen || !target) return null

  if (target.type === 'workspace') {
    return (
      <div className="relative z-[100000]">
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
    <div className="relative z-[100000]">
      <ProjectExportModal
        modalState={downloadModal}
        onClose={() => { setDownloadModal(null); onClose() }}
        onStartExport={handleStartExport}
        exportModels={exportModels}
      />
    </div>
  )
}
