'use client'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageSelector } from '@/components/layout/LanguageSelector'
import { EndUserMenu } from '@/components/auth/EndUserMenu'
import { ReleaseNotes } from '@/components/tauri/ReleaseNotes'
import { ContextAutoUpdater } from '@/components/tauri/ContextAutoUpdater'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserCheck } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { approvalsCall } from '@/lib/approvalsClient'

interface RuntimeHeaderActionsProps {
  projectId: string
  project?: any
}

export function RuntimeHeaderActions({ projectId, project }: RuntimeHeaderActionsProps) {
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [pending, setPending] = useState(0)
  const hasTasksLink = !!user && !!project?.approvalsHref

  // contador de aprovações a decidir: só nos apps com o bloco "Aguardar aprovação" (os demais nem fazem a chamada);
  // atualiza ao abrir, a cada 2 minutos e ao voltar para a aba. Falha (CLI desligado) só deixa o número como está.
  useEffect(() => {
    if (!hasTasksLink) return
    let alive = true
    const load = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const d = await approvalsCall<{ count: number }>(projectId, { op: 'list', view: 'pending', countOnly: true })
        if (alive) setPending(Number(d?.count) || 0)
      } catch { /* sem contador */ }
    }
    void load()
    const timer = setInterval(load, 120_000)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', load) }
  }, [hasTasksLink, projectId])

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

      {user && project?.approvalsHref && (
        <Link
          href={project.approvalsHref}
          title={t('approvals.title', 'Minhas tarefas')}
          className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
        >
          <UserCheck className="w-4 h-4" />
          <span className="hidden md:inline">{t('approvals.title', 'Minhas tarefas')}</span>
          {pending > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center" aria-label={`${pending}`}>
              {pending > 99 ? '99+' : pending}
            </span>
          )}
        </Link>
      )}

      {user && (
        <EndUserMenu user={user} projectId={projectId} />
      )}
    </div>
  )
}
