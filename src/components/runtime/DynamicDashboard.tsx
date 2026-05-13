'use client'

import { 
  Layout, 
  Layers, 
  Box, 
  Settings, 
  Database, 
  Search, 
  Globe,
  Link as LinkIcon,
  ChevronRight,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import { RuntimeHeader } from './RuntimeHeader'

interface MenuItem {
  id: string
  label: string
  icon: string
  type: 'view' | 'link' | 'folder'
  target: string
  show_dashboard?: boolean
  children?: MenuItem[]
}

interface DynamicDashboardProps {
  items: MenuItem[]
  workspaceSlug: string
  projectSlug: string
  title: string
  subtitle?: string
}

const ICON_MAP: Record<string, any> = {
  Layout,
  Layers,
  Box,
  Settings,
  Database,
  Search,
  Globe,
  Link: LinkIcon
}

export function DynamicDashboard({ items, workspaceSlug, projectSlug, title, subtitle }: DynamicDashboardProps) {
  const isSubFolder = subtitle?.includes('Explorando')

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-[#050505]">
      <RuntimeHeader 
        viewName={title}
        breadcrumbs={isSubFolder ? [{ label: title }] : []}
        baseUrl={`/${workspaceSlug}/${projectSlug}/dashboard`}
      />

      <div className="p-10 space-y-10 animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || Layout
          const isFolder = item.type === 'folder'
          const href = isFolder 
            ? `/${workspaceSlug}/${projectSlug}/dashboard/${item.id}`
            : item.type === 'view' 
              ? `/${workspaceSlug}/${projectSlug}/${item.target}`
              : item.target

          return (
            <Link
              key={item.id}
              href={href}
              target={item.type === 'link' ? '_blank' : undefined}
              className="group relative p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] hover:border-indigo-500 transition-all shadow-sm hover:shadow-2xl dark:shadow-none overflow-hidden"
            >
              {/* Glow Effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-all duration-500" />
              
              <div className="relative z-10 flex flex-col h-full gap-6">
                <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm">
                  <Icon className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 font-medium uppercase tracking-widest">
                    {isFolder ? 'Menu / Pasta' : item.type === 'view' ? 'Caso de Uso' : 'Link Externo'}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                   <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-indigo-500 transition-colors">
                     {isFolder ? 'Explorar' : 'Acessar'}
                   </span>
                   <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                     <ArrowRight className="w-4 h-4" />
                   </div>
                </div>
              </div>
            </Link>
          )
        })}
        </div>
      </div>
    </div>
  )
}
