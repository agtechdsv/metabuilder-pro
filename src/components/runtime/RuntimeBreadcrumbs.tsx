'use client'

import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

interface Breadcrumb {
  label: string
  href: string
}

interface RuntimeBreadcrumbsProps {
  breadcrumbs: Breadcrumb[]
  baseUrl: string
}

export function RuntimeBreadcrumbs({ breadcrumbs, baseUrl }: RuntimeBreadcrumbsProps) {
  const { t } = useI18n()

  return (
    <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 py-3 mb-2 animate-in fade-in slide-in-from-left-2 duration-500">
      <Link 
        href={baseUrl} 
        className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"
      >
        <Home className="w-3 h-3" />
        {t('runtime.dashboard', 'Dashboard')}
      </Link>

      
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1
        
        return (
          <div key={i} className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3 opacity-30" />
            {isLast ? (
              <span className="text-neutral-900 dark:text-white">{crumb.label}</span>
            ) : (
              <Link 
                href={crumb.href}
                className="hover:text-indigo-600 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
