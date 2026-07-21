'use client'

import React, { useEffect, useState } from 'react'
import { X, Monitor, Download, ArrowRight, Cpu, Terminal, Database, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DesktopOnlyModalProps {
  isOpen: boolean
  featureName: string
  onClose: () => void
}

const IDE_HIGHLIGHTS = [
  { icon: Terminal, label: 'Terminal PTY nativo', desc: 'Execute comandos diretamente no seu SO' },
  { icon: Database, label: 'SQL Studio integrado', desc: 'Query e gestão visual do banco de dados' },
  { icon: Cpu, label: 'BYOC — Banco Próprio', desc: 'Conecte sua infraestrutura local via CLI' },
  { icon: Zap, label: 'Performance nativa', desc: 'Sem overhead de browser, roda no SO' },
]

// Link para o instalador mais recente — apontando para a Central de Downloads
const DOWNLOAD_URL = 'https://metabuilderpro.com/downloads'

export function DesktopOnlyModal({ isOpen, featureName, onClose }: DesktopOnlyModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-slate-700 to-slate-900 px-6 pt-6 pb-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Exclusivo da IDE</p>
              <h2 className="text-white font-black text-lg leading-tight">{featureName}</h2>
            </div>
          </div>
          <p className="mt-3 text-white/80 text-sm leading-relaxed">
            <span className="font-semibold text-white">{featureName}</span> roda diretamente no seu sistema operacional e está disponível exclusivamente na <span className="font-semibold text-white">IDE Desktop do MetaBuilder PRO</span>.
          </p>
        </div>

        {/* IDE Highlights */}
        <div className="px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-3">
            Por que usar a IDE?
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {IDE_HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                <Icon className="w-4 h-4 text-indigo-500 mb-1.5" />
                <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">{label}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-tight">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className={cn(
              "w-full h-11 rounded-xl font-black text-sm uppercase tracking-widest transition-all",
              "bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white shadow-lg",
              "flex items-center justify-center gap-2"
            )}
          >
            <Download className="w-4 h-4" />
            Baixar IDE Gratuitamente
          </a>
          <a
            href="/features/ide"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full h-10 rounded-xl font-semibold text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center justify-center gap-1.5"
          >
            Saiba mais <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl font-semibold text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
