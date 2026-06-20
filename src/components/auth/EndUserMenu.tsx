'use client'

import { useState, useRef } from 'react'
import { LogOut, ChevronDown, ShieldCheck, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EndUserSecurityDrawer } from '@/components/auth/EndUserSecurityDrawer'
import { useI18n } from '@/i18n/I18nContext'

interface EndUserMenuProps {
  user: any
  projectId: string
}

export function EndUserMenu({ user, projectId }: EndUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSecurityDrawerOpen, setIsSecurityDrawerOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  const getDisplayName = () => {
    if (user?.full_name && user.full_name.trim()) return user.full_name
    if (user?.name && user.name.trim()) return user.name

    const email = user?.email || user?.Email || user?.mail
    if (email && email.includes('@')) {
      const localPart = email.split('@')[0]
      return localPart.charAt(0).toUpperCase() + localPart.slice(1)
    }

    return 'Usuário'
  }

  const fullName = getDisplayName()
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()

  const handleSignOut = () => {
    // Apagar o cookie de sessão local
    const cookieName = `client_session_${projectId}`
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`
    
    // Atualiza a página para o middleware ou cliente redirecionar para login
    window.location.reload()
  }

  return (
    <>
      <div
        className="relative"
        ref={menuRef}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div
          className="flex items-center gap-3 p-1 pr-3 rounded-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500/30 transition-all group cursor-default shadow-sm"
        >
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-200 dark:border-blue-500/30">
            {initials}
          </div>
          <div className="flex flex-col max-w-[120px]">
            <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
              {fullName}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-[110%] w-64 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-[100]"
            >
              <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {fullName}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {user?.email || user?.Email || user?.mail}
                </p>
              </div>

              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setIsSecurityDrawerOpen(true)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Segurança da Conta
                </button>
              </div>

              <div className="p-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <EndUserSecurityDrawer 
        isOpen={isSecurityDrawerOpen}
        onClose={() => setIsSecurityDrawerOpen(false)}
        user={user}
        projectId={projectId}
      />
    </>
  )
}
