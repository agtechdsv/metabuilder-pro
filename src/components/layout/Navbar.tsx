'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const handleOpenAuth = (e: Event) => {
      const customEvent = e as CustomEvent
      const redirectTo = customEvent.detail?.redirectTo
      if (redirectTo && typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('redirect_to', redirectTo)
        window.history.pushState(null, '', url.toString())
      }
      setIsAuthOpen(true)
    }

    window.addEventListener('open-auth-modal', handleOpenAuth)
    return () => window.removeEventListener('open-auth-modal', handleOpenAuth)
  }, [])

  const handleClose = () => {
    setIsAuthOpen(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('redirect_to')) {
        url.searchParams.delete('redirect_to')
        window.history.pushState(null, '', url.toString())
      }
    }
  }

  // No header transparente para a landing page? 
  // O usuário disse que o de /workspace deve ser o padrão em TODAS, incluindo /
  
  return (
    <>
      <header className={`fixed top-0 left-0 right-0 w-full border-b border-neutral-200 dark:border-neutral-900 bg-white/70 dark:bg-black/70 backdrop-blur-xl z-50 transition-all duration-300 ${isStudio ? 'pl-20' : ''}`}>
        <div className="w-full px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group transition-all">
              <img 
                src="/logo-crystal.png" 
                className="w-12 h-12 object-contain rounded-full group-hover:scale-105 transition-transform" 
                alt="Logo" 
              />
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                MetaBuilder<span className="text-indigo-500">PRO</span>
              </h1>
            </Link>

            {(pathname === '/' || pathname?.startsWith('/features') || pathname?.startsWith('/bpm')) && (
              <nav className="hidden lg:flex items-center gap-6">
                <Link href="/bpm" className="text-xs font-black tracking-widest text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors uppercase">{t('marketing_v2.navbar.bpm')}</Link>
                <Link href="/features/sync-resolution" className="text-xs font-black tracking-widest text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors uppercase">{t('marketing_v2.navbar.sync_resolution')}</Link>
                <Link href="/features/speed" className="text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors">{t('marketing_v2.navbar.speed')}</Link>
                <Link href="/features/integration" className="text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors">{t('marketing_v2.navbar.integration')}</Link>
                <Link href="/features/branding" className="text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors">{t('marketing_v2.navbar.branding')}</Link>
                <Link href="/features/security" className="text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors">{t('marketing_v2.navbar.security')}</Link>
                <Link href="/features/use-cases" className="text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors">{t('marketing_v2.navbar.use_cases')}</Link>
                <Link href="/#pricing" className="text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors">{t('marketing_v2.navbar.pricing')}</Link>
                <div className="flex items-center gap-4 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                  <Link href="/features/zero-trust" className="text-xs font-black tracking-widest text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors uppercase">{t('marketing_v2.navbar.zero_trust')}</Link>
                  <Link href="/features/control-center" className="text-xs font-black tracking-widest text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors uppercase">{t('marketing_v2.navbar.control_center')}</Link>
                </div>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-3 md:gap-4">
            <HeaderActions user={user} profile={profile} />
            {showLogin && !user && (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all active:scale-95 group"
              >
                <LogIn className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>{t('common.login')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={handleClose}>
        <LoginForm />
      </AuthModal>
    </>
  )
}
