'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, Plus, LogIn, ChevronDown, Terminal, Briefcase, Server } from 'lucide-react'
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
              <nav className="hidden md:flex items-center gap-4 xl:gap-6">
                
                {/* Dropdown Developers */}
                <div className="relative group cursor-pointer" title="Developers">
                  <div className="flex items-center gap-1 text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors py-4 uppercase">
                    <Terminal className="w-5 h-5 xl:hidden" />
                    <span className="hidden xl:flex items-center gap-1">Developers <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" /></span>
                  </div>
                  <div className="absolute top-full left-0 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 flex flex-col p-2">
                    <Link href="/bpm" className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.bpm')}</span>
                    </Link>
                    <Link href="/features/sync-resolution" className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.sync_resolution')}</span>
                    </Link>
                    <Link href="/features/speed" className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">{t('marketing_v2.navbar.speed')}</Link>
                    <Link href="/features/integration" className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">{t('marketing_v2.navbar.integration')}</Link>
                    <Link href="/features/use-cases" className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">{t('marketing_v2.navbar.use_cases')}</Link>
                  </div>
                </div>

                {/* Dropdown Owners */}
                <div className="relative group cursor-pointer" title="Owners">
                  <div className="flex items-center gap-1 text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors py-4 uppercase">
                    <Briefcase className="w-5 h-5 xl:hidden" />
                    <span className="hidden xl:flex items-center gap-1">Owners <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" /></span>
                  </div>
                  <div className="absolute top-full left-0 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 flex flex-col p-2">
                    <Link href="/features/control-center" className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.control_center')}</span>
                    </Link>
                    <Link href="/features/branding" className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">{t('marketing_v2.navbar.branding')}</Link>
                    <Link href="/#pricing" className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">{t('marketing_v2.navbar.pricing')}</Link>
                  </div>
                </div>

                {/* Dropdown Infra / Sec */}
                <div className="relative group cursor-pointer" title="Infraestrutura">
                  <div className="flex items-center gap-1 text-xs font-black tracking-widest text-neutral-500 hover:text-indigo-600 transition-colors py-4 uppercase">
                    <Server className="w-5 h-5 xl:hidden" />
                    <span className="hidden xl:flex items-center gap-1">Infraestrutura <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" /></span>
                  </div>
                  <div className="absolute top-full left-0 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 flex flex-col p-2">
                    <Link href="/features/zero-trust" className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.zero_trust')}</span>
                    </Link>
                    <Link href="/features/security" className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">{t('marketing_v2.navbar.security')}</Link>
                  </div>
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
