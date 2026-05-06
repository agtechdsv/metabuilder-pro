'use client'

import { useState } from 'react'
import { Layers, LogOut, ShieldCheck, User } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthModal } from '@/components/auth/AuthModal'
import { UserMenu } from '@/components/auth/UserMenu'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageSelector } from '@/components/layout/LanguageSelector'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
interface NavbarProps {
  user: any // Supabase user object
  profile?: any // Custom profile data from public.profiles
}

export function Navbar({ user, profile }: NavbarProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const { t } = useI18n()

  return (
    <>
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50 bg-transparent">
        <Link href="/" className="flex items-center gap-2 group transition-all">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-all">
            <Layers className="w-6 h-6 text-blue-500" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white dark:text-white">
            MetaBuilder<span className="text-blue-500">PRO</span>
          </span>
        </Link>
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 pr-2 border-r border-neutral-200 dark:border-neutral-800">
            <ThemeToggle />
            <LanguageSelector />
          </div>

          {user ? (
            <UserMenu user={user} profile={profile} />
          ) : (
            <button 
              onClick={() => setIsAuthOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl shadow-blue-900/30 active:scale-95 border border-blue-400/20"
            >
              {t('common.signup')}
            </button>
          )}
        </div>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
        <LoginForm />
      </AuthModal>
    </>
  )
}
