'use client'

import React from 'react'
import { Lock, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpgradeModal } from '@/context/UpgradeModalContext'
import { isTauri } from '@/utils/tauriUtils'
import { useI18n } from '@/i18n/I18nContext'

type GateType = 'pro' | 'desktop'

interface ProGateProps {
  /** Tier do usuário logado: 'pro' | 'free' */
  tier?: 'pro' | 'free' | string
  /** Nome legível da feature — usado no título do modal */
  featureName: string
  /** 
   * 'pro' → bloqueia usuários free (mostra UpgradeModal)
   * 'desktop' → bloqueia na web (mostra DesktopOnlyModal) + bloqueia free na IDE (mostra UpgradeModal)
   */
  gateType: GateType
  children: React.ReactNode
  className?: string
}

/**
 * ProGate — Wrapper universal para features bloqueadas.
 *
 * Não esconde o conteúdo. Renderiza sempre, mas sobrepõe
 * um overlay clicável com o ícone correto quando bloqueado.
 *
 * Combinações:
 * | gateType   | Contexto          | Ação ao clicar    |
 * |------------|-------------------|-------------------|
 * | 'pro'      | free              | UpgradeModal      |
 * | 'pro'      | pro               | Livre (passthrough)|
 * | 'desktop'  | web               | DesktopOnlyModal  |
 * | 'desktop'  | IDE + free        | UpgradeModal      |
 * | 'desktop'  | IDE + pro         | Livre (passthrough)|
 */
export function ProGate({ tier, featureName, gateType, children, className }: ProGateProps) {
  const { openUpgrade, openDesktopOnly } = useUpgradeModal()
  const { t } = useI18n()
  const isDesktop = isTauri()

  // Determina se está bloqueado e qual modal deve abrir
  let isBlocked = false
  let icon: 'lock' | 'monitor' = 'lock'
  let handleClick: () => void = () => {}

  if (gateType === 'pro') {
    if (tier === 'free' || !tier) {
      isBlocked = true
      icon = 'lock'
      handleClick = () => openUpgrade(featureName)
    }
  } else if (gateType === 'desktop') {
    if (!isDesktop) {
      // Na web: bloqueio de plataforma, independente do tier
      isBlocked = true
      icon = 'monitor'
      handleClick = () => openDesktopOnly(featureName)
    } else if (tier === 'free' || !tier) {
      // Na IDE: bloqueio de plano
      isBlocked = true
      icon = 'lock'
      handleClick = () => openUpgrade(featureName)
    }
  }

  if (!isBlocked) {
    return <>{children}</>
  }

  const tooltipText = icon === 'monitor' 
    ? `${featureName} — ${t('progate.desktop_exclusive', 'Exclusivo da IDE Desktop')}` 
    : `${featureName} — ${t('progate.pro_available', 'Disponível no plano PRO')}`

  return (
    <div
      className={cn('relative group cursor-not-allowed', className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleClick()
      }}
      title={tooltipText}
    >
      {/* Conteúdo acinzentado */}
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>

      {/* Badge de bloqueio no canto superior direito */}
      <div className={cn(
        'absolute top-1 right-1 rounded-md p-1 shadow-sm transition-transform group-hover:scale-110',
        icon === 'lock'
          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300'
      )}>
        {icon === 'lock'
          ? <Lock className="w-3 h-3" />
          : <Monitor className="w-3 h-3" />
        }
      </div>
    </div>
  )
}
