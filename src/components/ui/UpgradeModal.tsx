'use client'

import React, { useEffect, useState } from 'react'
import { X, Lock, Zap, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface UpgradeModalProps {
  isOpen: boolean
  featureName: string
  onClose: () => void
}

const PRO_BENEFITS = [
  'Workspaces e projetos ilimitados',
  'Acesso ao Auth & Segurança',
  'Exportar código-fonte do projeto',
  'Gerar App Desktop Nativo',
  'Logs e monitoramento em tempo real',
  'BYOC — Banco de dados próprio',
  'SQL Studio integrado',
  'Terminal PTY nativo',
  'Túnel Local (CLI) dedicado',
  'Suporte prioritário',
]

export function UpgradeModal({ isOpen, featureName, onClose }: UpgradeModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setIsLoading(false)
    } else {
      document.body.style.overflow = 'unset'
      setIsLoading(false)
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const router = useRouter()

  const handleUpgrade = async () => {
    setIsLoading(true)
    router.push('/checkout')
    // Safety timeout in case navigation fails or is aborted
    setTimeout(() => setIsLoading(false), 8000)
  }

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
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 px-6 pt-6 pb-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Recurso PRO</p>
              <h2 className="text-white font-black text-lg leading-tight">{featureName}</h2>
            </div>
          </div>
          <p className="mt-3 text-white/80 text-sm leading-relaxed">
            Este recurso está disponível no plano PRO. Faça o upgrade para desbloquear e ter acesso completo à plataforma.
          </p>
        </div>

        {/* Benefits */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Incluído no PRO
            </p>
          </div>
          <ul className="space-y-2">
            {PRO_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className={cn(
              "w-full h-11 rounded-xl font-black text-sm uppercase tracking-widest transition-all",
              "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25",
              "flex items-center justify-center gap-2",
              isLoading && "opacity-80 cursor-wait"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Fazer Upgrade para o PRO"
            )}
          </button>
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

// Lazy-loaded wrapper to avoid circular deps and keep bundle small
function CheckoutClientWrapper({ rules, user, profile, onClose }: any) {
  const { CheckoutClient } = require('@/components/checkout/CheckoutClient')
  return (
    <div className="pt-4">
      <CheckoutClient rules={rules} user={user} profile={profile} initialLicenses={1} />
    </div>
  )
}
