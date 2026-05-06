'use client'

import { useState } from 'react'
import { LayoutDashboard, ArrowRight } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { LoginForm } from '@/components/auth/LoginForm'
import Link from 'next/link'

interface HeroActionsProps {
  user: any
}

export function HeroActions({ user }: HeroActionsProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center md:justify-start">
        {user ? (
          <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-900/40 active:scale-95 border border-blue-400/20 group">
            <LayoutDashboard className="w-5 h-5" />
            Go to Dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <button 
            onClick={() => setIsAuthOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-900/40 active:scale-95 border border-blue-400/20 group"
          >
            Start Building Now
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
        <button className="bg-neutral-800/40 hover:bg-neutral-800 text-neutral-200 px-8 py-4 rounded-2xl font-bold transition-all border border-neutral-700/50 backdrop-blur-md active:scale-95 hover:border-neutral-600">
          Watch Demo
        </button>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
        <LoginForm />
      </AuthModal>
    </>
  )
}
