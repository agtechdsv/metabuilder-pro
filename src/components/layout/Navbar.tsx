'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, Plus, LogIn, ChevronDown, Terminal, Briefcase, Server, Sparkles, GitMerge, Check } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthModal } from '@/components/auth/AuthModal'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isTauri } from '@/utils/tauriUtils'
import { cn } from '@/lib/utils'

interface NavbarProps {
  user: any // Supabase user object
  profile?: any // Custom profile data from public.profiles
  showLogin?: boolean
  isStudio?: boolean
}

function ActiveIndicator() {
  return (
    <div className="ml-auto pl-2 flex items-center gap-1.5 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.9)] animate-pulse" />
      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
    </div>
  )
}

export function Navbar({ user, profile, showLogin = true, isStudio = false }: NavbarProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const { t } = useI18n()
  const pathname = usePathname()

  const isItemActive = (href: string, altHrefs?: string[]) => {
    if (!pathname) return false
    if (pathname === href) return true
    if (altHrefs && altHrefs.includes(pathname)) return true
    return false
  }

  const isDevelopersActive = pathname === '/bpm' || (Boolean(pathname?.startsWith('/features/')) && [
    '/features/bpm',
    '/features/ide',
    '/features/git-architecture',
    '/features/ai-studio',
    '/features/desktop',
    '/features/source-code',
    '/features/sync-resolution',
    '/features/logs',
    '/features/speed',
    '/features/integration',
    '/features/use-cases',
  ].includes(pathname || ''))

  const isOwnersActive = Boolean(pathname?.startsWith('/features/')) && [
    '/features/control-center',
    '/features/branding',
    '/features/desktop',
  ].includes(pathname || '')

  const isInfraActive = Boolean(pathname?.startsWith('/features/')) && [
    '/features/zero-trust',
    '/features/security',
  ].includes(pathname || '')

  useEffect(() => {
    if (isTauri()) {
      setIsDesktop(true)
    }

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

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 w-full border-b border-neutral-200 dark:border-neutral-900 bg-white/70 dark:bg-black/70 backdrop-blur-xl z-50 transition-all duration-300 ${isStudio ? 'pl-20' : ''}`}>
        <div className="w-full px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            {isDesktop ? (
              <div className="flex items-center gap-3">
                <img 
                  src="/icon-desktop-square.png" 
                  className="w-12 h-12 object-contain rounded-full" 
                  alt="Logo" 
                />
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white cursor-default">
                  MetaBuilder<span className="text-indigo-500">PRO</span>
                </h1>
              </div>
            ) : (
              <Link href="/" className="flex items-center gap-3 group transition-all">
                <img 
                  src="/icon-desktop-square.png" 
                  className="w-12 h-12 object-contain rounded-full group-hover:scale-105 transition-transform" 
                  alt="Logo" 
                />
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  MetaBuilder<span className="text-indigo-500">PRO</span>
                </h1>
              </Link>
            )}

            {(pathname === '/' || pathname?.startsWith('/features') || pathname?.startsWith('/bpm')) && (
              <nav className="hidden md:flex items-center gap-4 xl:gap-6">
                
                {/* Dropdown Developers */}
                <div className="relative group cursor-pointer" title={t('marketing_v2.navbar.developers', 'Developers')}>
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-black tracking-widest transition-colors py-4 uppercase",
                    isDevelopersActive 
                      ? "text-indigo-600 dark:text-indigo-400" 
                      : "text-neutral-500 hover:text-indigo-600"
                  )}>
                    <div className="relative">
                      <Terminal className="w-5 h-5 xl:hidden" />
                      {isDevelopersActive && (
                        <span className="xl:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.9)]" />
                      )}
                    </div>
                    <span className="hidden xl:flex items-center gap-1.5">
                      {t('marketing_v2.navbar.developers', 'Developers')}
                      {isDevelopersActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.9)] animate-pulse" />
                      )}
                      <ChevronDown className={cn(
                        "w-3 h-3 group-hover:rotate-180 transition-transform",
                        isDevelopersActive ? "text-indigo-600 dark:text-indigo-400" : ""
                      )} />
                    </span>
                  </div>
                  <div className="absolute top-full left-0 w-60 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 flex flex-col p-2">
                    
                    {/* BPM */}
                    <Link 
                      href="/features/bpm" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/bpm', ['/bpm'])
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.bpm')}</span>
                      {isItemActive('/features/bpm', ['/bpm']) && <ActiveIndicator />}
                    </Link>

                    {/* IDE Desktop (Pro) */}
                    <Link 
                      href="/features/ide" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all border flex items-center justify-between my-1",
                        isItemActive('/features/ide')
                          ? "bg-indigo-100/90 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700/60 shadow-sm font-black"
                          : "bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 border-indigo-100 dark:border-indigo-800/30 font-bold"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.ide_desktop', 'IDE Desktop (Pro)')}</span>
                      </div>
                      {isItemActive('/features/ide') && <ActiveIndicator />}
                    </Link>

                    {/* Arquitetura Git */}
                    <Link 
                      href="/features/git-architecture" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between mb-1",
                        isItemActive('/features/git-architecture')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <GitMerge className={cn("w-3.5 h-3.5", isItemActive('/features/git-architecture') ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-500")} />
                        <span className={isItemActive('/features/git-architecture') ? "text-indigo-600 dark:text-indigo-300" : "text-neutral-700 dark:text-neutral-300"}>{t('marketing_v2.navbar.git_architecture', 'Arquitetura Git')}</span>
                      </div>
                      {isItemActive('/features/git-architecture') && <ActiveIndicator />}
                    </Link>

                    {/* AI Studio */}
                    <Link 
                      href="/features/ai-studio" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all border flex items-center justify-between my-1",
                        isItemActive('/features/ai-studio')
                          ? "bg-violet-100/90 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700/60 shadow-sm font-black"
                          : "bg-violet-50/50 hover:bg-violet-100 dark:bg-violet-900/20 dark:hover:bg-violet-900/40 border-violet-100 dark:border-violet-800/30 font-bold"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.ai_studio', 'AI Studio')}</span>
                      </div>
                      {isItemActive('/features/ai-studio') && <ActiveIndicator />}
                    </Link>

                    {/* Compilador Desktop */}
                    <Link 
                      href="/features/desktop" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/desktop')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.desktop')}</span>
                      {isItemActive('/features/desktop') && <ActiveIndicator />}
                    </Link>

                    {/* Código-fonte (export) */}
                    <Link 
                      href="/features/source-code" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/source-code')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.source_code')}</span>
                      {isItemActive('/features/source-code') && <ActiveIndicator />}
                    </Link>

                    {/* Sync Automático */}
                    <Link 
                      href="/features/sync-resolution" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/sync-resolution')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.sync_resolution')}</span>
                      {isItemActive('/features/sync-resolution') && <ActiveIndicator />}
                    </Link>

                    {/* Auditoria & Logs */}
                    <Link 
                      href="/features/logs" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/logs')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.logs')}</span>
                      {isItemActive('/features/logs') && <ActiveIndicator />}
                    </Link>

                    {/* Agilidade */}
                    <Link 
                      href="/features/speed" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/speed')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                          : "font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span>{t('marketing_v2.navbar.speed')}</span>
                      {isItemActive('/features/speed') && <ActiveIndicator />}
                    </Link>

                    {/* Integração */}
                    <Link 
                      href="/features/integration" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/integration')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                          : "font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span>{t('marketing_v2.navbar.integration')}</span>
                      {isItemActive('/features/integration') && <ActiveIndicator />}
                    </Link>

                    {/* Lógica & IA */}
                    <Link 
                      href="/features/use-cases" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/use-cases')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                          : "font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span>{t('marketing_v2.navbar.use_cases')}</span>
                      {isItemActive('/features/use-cases') && <ActiveIndicator />}
                    </Link>
                  </div>
                </div>

                {/* Dropdown Owners */}
                <div className="relative group cursor-pointer" title={t('marketing_v2.navbar.owners', 'Owners')}>
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-black tracking-widest transition-colors py-4 uppercase",
                    isOwnersActive 
                      ? "text-indigo-600 dark:text-indigo-400" 
                      : "text-neutral-500 hover:text-indigo-600"
                  )}>
                    <div className="relative">
                      <Briefcase className="w-5 h-5 xl:hidden" />
                      {isOwnersActive && (
                        <span className="xl:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.9)]" />
                      )}
                    </div>
                    <span className="hidden xl:flex items-center gap-1.5">
                      {t('marketing_v2.navbar.owners', 'Owners')}
                      {isOwnersActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.9)] animate-pulse" />
                      )}
                      <ChevronDown className={cn(
                        "w-3 h-3 group-hover:rotate-180 transition-transform",
                        isOwnersActive ? "text-indigo-600 dark:text-indigo-400" : ""
                      )} />
                    </span>
                  </div>
                  <div className="absolute top-full left-0 w-60 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 flex flex-col p-2">
                    
                    {/* Painel de Controle */}
                    <Link 
                      href="/features/control-center" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/control-center')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.control_center')}</span>
                      {isItemActive('/features/control-center') && <ActiveIndicator />}
                    </Link>

                    {/* White-label */}
                    <Link 
                      href="/features/branding" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/branding')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                          : "font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span>{t('marketing_v2.navbar.branding')}</span>
                      {isItemActive('/features/branding') && <ActiveIndicator />}
                    </Link>

                    {/* Compilador Desktop */}
                    <Link 
                      href="/features/desktop" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/desktop')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                          : "font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span>{t('marketing_v2.navbar.desktop')}</span>
                      {isItemActive('/features/desktop') && <ActiveIndicator />}
                    </Link>

                    {/* Planos */}
                    <Link 
                      href="/#pricing" 
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between"
                    >
                      <span>{t('marketing_v2.navbar.pricing')}</span>
                    </Link>
                  </div>
                </div>

                {/* Dropdown Infra / Sec */}
                <div className="relative group cursor-pointer" title={t('marketing_v2.navbar.infrastructure', 'Infraestrutura')}>
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-black tracking-widest transition-colors py-4 uppercase",
                    isInfraActive 
                      ? "text-indigo-600 dark:text-indigo-400" 
                      : "text-neutral-500 hover:text-indigo-600"
                  )}>
                    <div className="relative">
                      <Server className="w-5 h-5 xl:hidden" />
                      {isInfraActive && (
                        <span className="xl:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.9)]" />
                      )}
                    </div>
                    <span className="hidden xl:flex items-center gap-1.5">
                      {t('marketing_v2.navbar.infrastructure', 'Infraestrutura')}
                      {isInfraActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.9)] animate-pulse" />
                      )}
                      <ChevronDown className={cn(
                        "w-3 h-3 group-hover:rotate-180 transition-transform",
                        isInfraActive ? "text-indigo-600 dark:text-indigo-400" : ""
                      )} />
                    </span>
                  </div>
                  <div className="absolute top-full left-0 w-60 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 flex flex-col p-2">
                    
                    {/* Zero-Trust */}
                    <Link 
                      href="/features/zero-trust" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/zero-trust')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black"
                          : "font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">{t('marketing_v2.navbar.zero_trust')}</span>
                      {isItemActive('/features/zero-trust') && <ActiveIndicator />}
                    </Link>

                    {/* Segurança */}
                    <Link 
                      href="/features/security" 
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between",
                        isItemActive('/features/security')
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                          : "font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <span>{t('marketing_v2.navbar.security')}</span>
                      {isItemActive('/features/security') && <ActiveIndicator />}
                    </Link>
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
