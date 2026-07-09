'use client'

import React, { useEffect, useState } from 'react'
import { CliFilesClientView } from '@/components/client/CliFilesClientView'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { createClient } from '@/utils/supabase/client'

export default function DownloadsPopoutPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('is_guest').eq('id', user.id).single()
      if (profile) {
        setIsGuest(profile.is_guest)
      }

      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)

      const memberWorkspaceIds = memberships?.map(m => m.workspace_id) || []

      let workspacesQuery = supabase
        .from('workspaces')
        .select('id')

      if (memberWorkspaceIds.length > 0) {
        workspacesQuery = workspacesQuery.or(`owner_id.eq.${user.id},id.in.(${memberWorkspaceIds.join(',')})`)
      } else {
        workspacesQuery = workspacesQuery.eq('owner_id', user.id)
      }

      const { data: workspaces } = await workspacesQuery
      if (workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map(w => w.id)
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .in('workspace_id', workspaceIds)
        if (projectsData) setProjects(projectsData)
      }
    }
    fetchProjects()
  }, [])

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black p-4 md:p-8 relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-7xl mx-auto mt-12 md:mt-0 pt-12 md:pt-4">
        <CliFilesClientView projects={projects} devOnly={isGuest} isPopout={true} />
      </div>
    </div>
  )
}
