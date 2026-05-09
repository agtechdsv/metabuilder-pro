'use client'

import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BreadcrumbsProps {
  workspaceName?: string
  projectName?: string
  viewName?: string
  workspaceSlug?: string
  projectSlug?: string
}

export function Breadcrumbs({ 
  workspaceName, 
  projectName, 
  viewName,
  workspaceSlug,
  projectSlug 
}: BreadcrumbsProps) {
  const pathname = usePathname()

  // Não mostrar breadcrumbs na home
  if (pathname === '/' || pathname === '/login') return null

  return (
    <div className="w-full bg-neutral-50/50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-neutral-900">
      <div className="w-full px-10 py-2 flex items-center gap-3 text-[11px] font-bold tracking-widest text-neutral-500">
        <Link 
          href="/workspace" 
          className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>

        {(workspaceName || workspaceSlug) && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-700" />
            <Link 
              href={`/admin/${workspaceSlug}`}
              className={cn(
                "hover:text-indigo-500 transition-colors",
                !projectName && !projectSlug && !viewName && "text-neutral-900 dark:text-white"
              )}
            >
              {workspaceName || workspaceSlug}
            </Link>
          </>
        )}

        {(projectName || projectSlug) && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-700" />
            <Link 
              href={`/admin/${workspaceSlug}/${projectSlug}/studio`}
              className={cn(
                "hover:text-indigo-500 transition-colors",
                !viewName && "text-neutral-900 dark:text-white"
              )}
            >
              {projectName || projectSlug}
            </Link>
          </>
        )}

        {viewName && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-700" />
            <span className="text-neutral-900 dark:text-white">
              {viewName}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
