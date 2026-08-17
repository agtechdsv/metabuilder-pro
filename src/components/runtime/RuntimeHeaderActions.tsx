'use client'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageSelector } from '@/components/layout/LanguageSelector'
import { EndUserMenu } from '@/components/auth/EndUserMenu'
import { ReleaseNotes } from '@/components/tauri/ReleaseNotes'
import { ContextAutoUpdater } from '@/components/tauri/ContextAutoUpdater'
import { useEffect, useState } from 'react'

interface RuntimeHeaderActionsProps {
  projectId: string
  project?: any
}

export function RuntimeHeaderActions({ projectId, project }: RuntimeHeaderActionsProps) {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const cookieName = `client_session_${projectId}`
    const cookies = document.cookie.split(';')
    const sessionCookie = cookies.find(c => c.trim().startsWith(`${cookieName}=`))
    
    if (sessionCookie) {
      try {
        const value = sessionCookie.split('=')[1]
        const decoded = JSON.parse(decodeURIComponent(value))
        setUser(decoded)
      } catch (e) {
        console.error('Failed to parse client session', e)
      }
    }
  }, [projectId])

  return (
    <div className="flex items-center gap-3 md:gap-4">
      {/* Auto-update banner for project desktop apps (polls Supabase, no signed server needed) */}
      <ContextAutoUpdater
        contextType="project"
        contextId={projectId}
        appName={project?.name}
      />

      <div className="flex items-center gap-2 pr-2 border-r border-neutral-200 dark:border-neutral-800">
        <ReleaseNotes 
          contextType="project"
          contextId={projectId}
          appName={project?.name}
          icon={project?.icon}
        />
        <ThemeToggle />
        <LanguageSelector />
      </div>

      {user && (
        <EndUserMenu user={user} projectId={projectId} />
      )}
    </div>
  )
}
