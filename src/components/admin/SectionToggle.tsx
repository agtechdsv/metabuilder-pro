'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

/**
 * Seta de expandir/recolher dos cartões da aba Sistema do painel do SuperAdmin (Gerenciador de e-mails, Avisos de cobrança, Sessões e dispositivos).
 * O estado fica no cartão (só em memória): são telas de uso raro, abrem recolhidas e mostram um resumo de uma linha.
 */
export function SectionToggle({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls?: string }) {
  const { t } = useI18n()
  const label = t(open ? 'admin_section.collapse' : 'admin_section.expand')
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controls} title={label} aria-label={label}
      className="rounded-xl p-2 text-neutral-400 hover:text-indigo-600">
      <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}
