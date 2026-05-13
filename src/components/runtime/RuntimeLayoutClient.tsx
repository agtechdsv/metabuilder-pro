'use client'

import { usePathname } from 'next/navigation'
import { DynamicSidebar } from './DynamicSidebar'

interface RuntimeLayoutClientProps {
  children: React.ReactNode
  project: any
  workspaceSlug: string
  projectSlug: string
  navigation: any[]
}

export function RuntimeLayoutClient({ 
  children, 
  project, 
  workspaceSlug, 
  projectSlug, 
  navigation 
}: RuntimeLayoutClientProps) {
  const pathname = usePathname()
  const isLoginPage = pathname?.endsWith('/login')

  if (isLoginPage) {
    return (
      <div className="flex-1 min-h-screen overflow-x-hidden">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#050505]">
      <DynamicSidebar 
        project={project}
        workspaceSlug={workspaceSlug}
        projectSlug={projectSlug}
        navigation={navigation}
      />

      <main className="flex-1 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
