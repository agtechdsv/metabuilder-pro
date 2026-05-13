'use client'

import { ChevronRight, Home, Layout } from 'lucide-react'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'

interface Breadcrumb {
  label: string
  href?: string
}

interface RuntimeHeaderProps {
  viewName: string
  icon?: React.ReactNode
  breadcrumbs: Breadcrumb[]
  actions?: React.ReactNode
  baseUrl?: string
}

export function RuntimeHeader({ viewName, icon, breadcrumbs, actions, baseUrl }: RuntimeHeaderProps) {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Icon & View Name */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              {icon || <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            </div>
            <h1 className="text-xl font-black text-neutral-900 dark:text-white capitalize tracking-tight">
              {viewName}
            </h1>
          </div>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
            <Link 
              href={baseUrl || '/'} 
              className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"
            >
              <Home className="w-3 h-3" />
              Dashboard
            </Link>
            
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 opacity-30" />
                {crumb.href ? (
                  <Link 
                    href={crumb.href}
                    className="hover:text-indigo-600 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-neutral-900 dark:text-white">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <HeaderActions />
          {actions}
        </div>
      </div>
    </header>
  )
}
