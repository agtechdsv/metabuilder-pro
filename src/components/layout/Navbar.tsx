'use client'

import { useState } from 'react'
import { LayoutDashboard, Plus, LogIn } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthModal } from '@/components/auth/AuthModal'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavbarProps {
  user: any // Supabase user object
  profile?: any // Custom profile data from public.profiles
  showLogin?: boolean
  isStudio?: boolean
}

export function Navbar({ user, profile, showLogin = true, isStudio = false }: NavbarProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const { t } = useI18n()
  const pathname = usePathname()

  // No header transparente para a landing page? 
  // O usuário disse que o de /workspace deve ser o padrão em TODAS, incluindo /
  
  return (
    <>
      <header className={`fixed top-0 left-0 right-0 w-full border-b border-neutral-200 dark:border-neutral-900 bg-white/70 dark:bg-black/70 backdrop-blur-xl z-50 transition-all duration-300 ${isStudio ? 'pl-20' : ''}`}>
        <div className="w-full px-10 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group transition-all">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
              <LayoutDashboard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              MetaBuilder<span className="text-indigo-500">PRO</span>
            </h1>
          </Link>
          
          <div className="flex items-center gap-3 md:gap-4">
            <HeaderActions user={user} profile={profile} />
            {showLogin && !user && (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all active:scale-95 group"
              >
                <LogIn className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
        <LoginForm />
      </AuthModal>
    </>
  )
}
