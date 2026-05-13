'use client'

import { useParams, usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, Box, Home, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
import { findBreadcrumbPath } from '@/lib/navigation-utils'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'

interface RuntimeGlobalHeaderProps {
  project: any
  isCollapsed: boolean
  setIsCollapsed: (val: boolean) => void
  navigation: any[]
  workspaceSlug: string
  projectSlug: string
}

import { motion, AnimatePresence } from 'framer-motion'

export function RuntimeGlobalHeader({ 
  project, 
  isCollapsed, 
  setIsCollapsed, 
  navigation,
  workspaceSlug,
  projectSlug 
}: RuntimeGlobalHeaderProps) {
  const { t } = useI18n()
  const params = useParams()
  const pathname = usePathname()
  
  const viewSlug = params?.view_slug as string
  const folderId = params?.folder_id?.[0] as string
  const targetId = viewSlug || folderId
  
  const baseUrl = `/${workspaceSlug}/${projectSlug}`
  const breadcrumbs = findBreadcrumbPath(navigation, targetId, [], baseUrl) || []
  const dashboardHomeUrl = `${baseUrl}/dashboard`

  return (
    <header className="h-16 border-b border-neutral-200/50 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl sticky top-0 z-[90] flex items-center px-6 gap-4">
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-all hover:scale-105 active:scale-95"
      >
        {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-2" />

      {/* Dynamic Breadcrumbs */}
      <nav className="flex-1 flex items-center gap-2 text-[10px] font-bold capitalize tracking-widest text-neutral-400 overflow-hidden">
        <Link 
          href={dashboardHomeUrl} 
          className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Home className="w-3 h-3" />
          <span className="hidden sm:inline">{t('runtime.dashboard', 'Dashboard')}</span>
        </Link>

        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1

          return (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <ChevronRight className="w-3 h-3 opacity-30 shrink-0" />
              {isLast ? (
                <span className="text-neutral-900 dark:text-white truncate capitalize flex items-center gap-1.5">
                  {crumb.icon && <DynamicIcon icon={crumb.icon} size={14} className="opacity-60" />}
                  {crumb.label}
                </span>
              ) : (
                <Link 
                  href={crumb.href}
                  className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors truncate"
                >
                  {crumb.icon && <DynamicIcon icon={crumb.icon} size={14} className="opacity-60" />}
                  <span className="truncate">{crumb.label}</span>
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <HeaderActions />
      </div>
    </header>
  )
}
