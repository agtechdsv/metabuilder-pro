'use client'

import { ChevronRight, Home, Layout, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useSearchParams, useRouter } from 'next/navigation'
import DynamicIcon from './DynamicIcon'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface Breadcrumb {
  label: string
  href?: string
}

interface RuntimeHeaderProps {
  viewName: string
  subtitle?: string
  icon?: any
  actions?: React.ReactNode
}

export function RuntimeHeader({ viewName, subtitle, icon, actions }: RuntimeHeaderProps) {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isEmbedded = searchParams?.get('embedded') === 'true'
  const returnTo = searchParams?.get('return_to')

  return (
    <div className={`px-10 py-8 flex items-center justify-between ${!isEmbedded ? 'animate-in fade-in slide-in-from-top-4 duration-700' : 'sticky top-0 z-50 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-800 shadow-sm'}`}>
      <div className="flex items-center gap-5">
        {returnTo && !isEmbedded && (
          <button 
            onClick={() => router.push(decodeURIComponent(returnTo))}
            className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-600 dark:hover:border-indigo-500 transition-all hover:-translate-x-1"
            title={t('common.back', 'Voltar para anterior')}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
          <DynamicIcon icon={icon || 'Layout'} size={24} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight capitalize">
            {viewName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-8 h-1 bg-indigo-600 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              {subtitle || t('runtime.system_name')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {actions}
        
        {isEmbedded && (
          <button 
            onClick={() => window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')}
            className="p-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 rounded-xl transition-all text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0 ml-2"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
