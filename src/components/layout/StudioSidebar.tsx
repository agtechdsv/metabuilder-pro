'use client'

import { 
  Box, 
  LayoutDashboard,
  Database, 
  ShieldCheck, 
  Settings2,
  ScrollText,
  Code2,
  Network,
  Terminal,
  Server,
  FolderGit2
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri } from '@/utils/tauriUtils'
import { useState, useEffect } from 'react'
import { ProGate } from '@/components/ui/ProGate'

interface StudioSidebarProps {
  workspaceSlug: string
  projectSlug: string
  tier?: 'pro' | 'free' | string
}

export function StudioSidebar({ workspaceSlug, projectSlug, tier }: StudioSidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    setIsDesktop(isTauri())
  }, [])

  const base = `/admin/${workspaceSlug}/${projectSlug}/studio`

  const freeLinks = [
    {
      href: `${base}`,
      icon: LayoutDashboard,
      label: t('dashboard.projects.studio.sidebar.dashboard', 'Dashboard'),
      active: pathname === base,
      gate: null
    },
    {
      href: `${base}/data`,
      icon: Database,
      label: t('dashboard.projects.studio.sidebar.data', 'Dados & Schemas'),
      active: pathname.includes('/studio/data'),
      gate: null
    },
    {
      href: `${base}/auth`,
      icon: ShieldCheck,
      label: t('dashboard.projects.studio.sidebar.auth', 'Autenticação'),
      active: pathname.includes('/studio/auth'),
      gate: 'pro'
    },
    {
      href: `${base}/byoc`,
      icon: Code2,
      label: t('dashboard.projects.studio.sidebar.byoc', 'BYOC'),
      active: pathname.includes('/studio/byoc'),
      gate: 'desktop'
    },
    {
      href: `${base}/settings`,
      icon: Settings2,
      label: t('dashboard.projects.studio.sidebar.settings', 'Configurações'),
      active: pathname.includes('/studio/settings'),
      gate: null
    },
    {
      href: `${base}/tunnel`,
      icon: Network,
      label: t('dashboard.projects.studio.sidebar.tunnel_db_config', 'Configurações de Bancos (JSON)'),
      active: pathname.includes('/studio/tunnel'),
      gate: 'desktop'
    },
    {
      href: `${base}/terminal`,
      icon: Terminal,
      label: t('dashboard.projects.studio.sidebar.terminal', 'Terminal (PTY)'),
      active: pathname.includes('/studio/terminal'),
      gate: 'desktop'
    },
    {
      href: `${base}/logs`,
      icon: ScrollText,
      label: t('dashboard.projects.studio.sidebar.logs', 'Logs do Sistema'),
      active: pathname.includes('/studio/logs'),
      gate: 'pro'
    },
    {
      href: `${base}/sql`,
      icon: Server,
      label: t('dashboard.projects.studio.sidebar.sql_studio', 'SQL Studio'),
      active: pathname.includes('/studio/sql'),
      gate: 'desktop'
    }
  ]

  return (
    <aside className="fixed left-0 top-20 h-[calc(100vh-80px)] w-20 bg-white dark:bg-neutral-900/50 border-r border-neutral-200 dark:border-neutral-800 flex flex-col items-center py-8 gap-8 z-20 backdrop-blur-xl transition-colors">
      <Link
        href={base}
        className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] group relative"
      >
        <Box className="text-white w-6 h-6" />
        <span className="absolute left-16 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
          {t('dashboard.projects.studio.title', 'MetaBuilder Studio')}
        </span>
      </Link>
      <nav className="flex flex-col gap-4">
        {freeLinks.map((link, idx) => {
          const Icon = link.icon
          const isActive = link.active

          const linkEl = (
            <Link 
              key={idx}
              href={link.href}
              className={`p-3 rounded-xl transition-all border group relative flex justify-center ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 border-indigo-500' 
                  : 'text-neutral-400 hover:text-indigo-600 dark:hover:text-white border-transparent'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="absolute left-16 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {link.label}
              </span>
            </Link>
          )

          if (link.gate === 'pro') {
            return (
              <ProGate key={idx} featureName={link.label} gateType="pro" tier={tier}>
                {linkEl}
              </ProGate>
            )
          }
          if (link.gate === 'desktop') {
            return (
              <ProGate key={idx} featureName={link.label} gateType="desktop" tier={tier}>
                {linkEl}
              </ProGate>
            )
          }

          return linkEl
        })}
      </nav>
    </aside>
  )
}
