'use client'

import { 
  Box, 
  LayoutDashboard,
  Database, 
  ShieldCheck, 
  Settings2 
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'

interface StudioSidebarProps {
  workspaceSlug: string
  projectSlug: string
}

export function StudioSidebar({ workspaceSlug, projectSlug }: StudioSidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  const links = [
    {
      href: `/admin/${workspaceSlug}/${projectSlug}/studio`,
      icon: LayoutDashboard,
      label: t('dashboard.projects.studio.sidebar.dashboard'),
      active: pathname === `/admin/${workspaceSlug}/${projectSlug}/studio`
    },
    {
      href: `#`, // placeholder
      icon: Database,
      label: t('dashboard.projects.studio.sidebar.data'),
      active: pathname.includes('/studio/data')
    },
    {
      href: `/admin/${workspaceSlug}/${projectSlug}/studio/auth`,
      icon: ShieldCheck,
      label: t('dashboard.projects.studio.sidebar.auth'),
      active: pathname.includes('/studio/auth')
    },
    {
      href: `#`, // placeholder
      icon: Settings2,
      label: t('dashboard.projects.studio.sidebar.settings'),
      active: pathname.includes('/studio/settings')
    }
  ]

  return (
    <aside className="fixed left-0 top-20 h-[calc(100vh-80px)] w-20 bg-white dark:bg-neutral-900/50 border-r border-neutral-200 dark:border-neutral-800 flex flex-col items-center py-8 gap-8 z-20 backdrop-blur-xl transition-colors">
      <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
        <Box className="text-white w-6 h-6" />
      </div>
      <nav className="flex flex-col gap-4">
        {links.map((link, idx) => {
          const Icon = link.icon
          const isActive = link.active
          
          return (
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
        })}
      </nav>
    </aside>
  )
}
