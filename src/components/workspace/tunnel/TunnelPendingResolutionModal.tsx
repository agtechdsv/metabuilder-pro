'use client'

import React from 'react'
import Link from 'next/link'

interface TunnelPendingResolutionModalProps {
  pendingResolution: {
    workspaceSlug: string
    projectSlug: string
  } | null
  pathname: string
  onClose: () => void
}

export function TunnelPendingResolutionModal({
  pendingResolution,
  pathname,
  onClose
}: TunnelPendingResolutionModalProps) {
  if (!pendingResolution) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Sincronização Pendente</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Foram detectadas alterações estruturais nos metadados que dependem da sua revisão. Deseja mapear essas alterações e finalizar a sincronização agora?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Agora não
          </button>
          <Link
            href={`/admin/${pendingResolution.workspaceSlug}/${pendingResolution.projectSlug}/sync-resolution?returnUrl=${encodeURIComponent(pathname)}`}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            Sim, revisar agora
          </Link>
        </div>
      </div>
    </div>
  )
}
