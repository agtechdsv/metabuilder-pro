'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LockedActionProps {
  icon: LucideIcon
  /** nome da ação (o mesmo do botão ativo) */
  label: string
  /** por que a pessoa não pode usar: aparece no tooltip */
  reason: string
  /** marca do tour guiado (o destaque cai no ícone desativado, igual ao ativo) */
  helpId?: string
  className?: string
}

/**
 * Ícone de ação desativado: a pessoa vê que a ação existe, mas o papel dela não permite.
 * O botão fica dentro de um `span` porque botão desativado não dispara tooltip em todo navegador.
 */
export function LockedAction({ icon: Icon, label, reason, helpId, className }: LockedActionProps) {
  const text = `${label}: ${reason}`
  return (
    <span data-help-id={helpId} title={text} className="inline-flex cursor-not-allowed rounded-lg">
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={text}
        className={cn('p-2 rounded-lg text-neutral-400 opacity-40 pointer-events-none', className)}
      >
        <Icon className="w-4 h-4" />
      </button>
    </span>
  )
}
