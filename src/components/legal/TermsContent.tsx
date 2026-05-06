'use client'

import { FileText, Gavel, UserCheck, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export function TermsContent() {
  const { t } = useI18n()

  const sections = [
    {
      icon: <FileText className="w-4 h-4" />,
      title: t('terms.item1_title'),
      content: t('terms.item1_desc')
    },
    {
      icon: <Gavel className="w-4 h-4" />,
      title: t('terms.item2_title'),
      content: t('terms.item2_desc')
    },
    {
      icon: <UserCheck className="w-4 h-4" />,
      title: t('terms.item3_title'),
      content: t('terms.item3_desc')
    },
    {
      icon: <AlertTriangle className="w-4 h-4" />,
      title: t('terms.item4_title'),
      content: t('terms.item4_desc')
    }
  ]

  return (
    <div className="space-y-6">
      {sections.map((section, idx) => (
        <div key={idx} className="flex gap-4 group">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
            {idx + 1}
          </div>
          <div className="space-y-1.5">
            <h3 className="text-neutral-900 dark:text-white font-bold text-base tracking-tight flex items-center gap-2 transition-colors">
              <span className="text-blue-500 opacity-70">{section.icon}</span>
              {section.title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed transition-colors">
              {section.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
