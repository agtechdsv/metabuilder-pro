'use client'

import { ChevronRight, Home, Layout } from 'lucide-react'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { DynamicIcon } from './DynamicIcon'

interface Breadcrumb {
  label: string
  href?: string
}

interface RuntimeHeaderProps {
  viewName: string
  subtitle?: string
  icon?: string
  actions?: React.ReactNode
}

export function RuntimeHeader({ viewName, subtitle, icon, actions }: RuntimeHeaderProps) {
  return (
    <div className="px-10 py-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-5">
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
              {subtitle || "Sistema MetaBuilder"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {actions}
      </div>
    </div>
  )
}
