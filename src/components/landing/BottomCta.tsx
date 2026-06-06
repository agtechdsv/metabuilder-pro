'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, ArrowRight, LogIn } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { LoginForm } from '@/components/auth/LoginForm'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BottomCtaProps {
  className?: string
  buttonClassName?: string
}

export function BottomCta({ className, buttonClassName }: BottomCtaProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const { t } = useI18n()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <>
      <div className="flex flex-col items-center gap-3 w-full">
        <p className="text-xs font-medium italic text-center max-w-xl leading-relaxed opacity-70">
          {t('hero.demo_subtext')}
        </p>
        <div className={cn("flex flex-col sm:flex-row gap-4 justify-center items-center w-full", className)}>
          {user ? (
            <Link
              href="/workspace"
              className={cn(
                "bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-900/40 active:scale-95 border border-blue-400/20 group w-full sm:w-auto text-sm uppercase tracking-widest",
                buttonClassName
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{t('common.dashboard')}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className={cn(
                "flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all active:scale-95 group w-full sm:w-auto text-sm uppercase tracking-widest bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm",
                buttonClassName
              )}
            >
              <LogIn className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t('common.login')}</span>
            </button>
          )}
          <Link
            href="/agendamento"
            className={cn(
              "bg-neutral-800/40 hover:bg-neutral-800 text-neutral-200 px-8 py-4 rounded-2xl font-bold transition-all border border-neutral-700/50 backdrop-blur-md active:scale-95 hover:border-neutral-600 flex items-center justify-center w-full sm:w-auto text-sm uppercase tracking-widest",
              buttonClassName
            )}
          >
            {t('hero.cta_demo')}
          </Link>
        </div>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
        <LoginForm />
      </AuthModal>
    </>
  )
}
