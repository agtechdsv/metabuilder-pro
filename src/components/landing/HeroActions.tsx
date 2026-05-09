'use client'

import { useState } from 'react'
import { LayoutDashboard, ArrowRight, LogIn } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { LoginForm } from '@/components/auth/LoginForm'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'

interface HeroActionsProps {
  user: any
}

export function HeroActions({ user }: HeroActionsProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const { t } = useI18n()

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center md:justify-start">
        {user ? (
          <Link href="/workspace" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-900/40 active:scale-95 border border-blue-400/20 group">
            <LayoutDashboard className="w-5 h-5" />
            {t('common.dashboard')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <button 
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all active:scale-95 group"
          >
            <LogIn className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Entrar</span>
          </button>
        )}
        <button className="bg-neutral-800/40 hover:bg-neutral-800 text-neutral-200 px-8 py-4 rounded-2xl font-bold transition-all border border-neutral-700/50 backdrop-blur-md active:scale-95 hover:border-neutral-600">
          {t('hero.cta_demo')}
        </button>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
        <LoginForm />
      </AuthModal>
    </>
  )
}
