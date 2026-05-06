'use client'

import { useState } from 'react'
import { Layers, LogOut, ShieldCheck, User } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthDrawer } from '@/components/auth/AuthDrawer'
import { UserMenu } from '@/components/auth/UserMenu'
import Link from 'next/link'
interface NavbarProps {
  user: any // Supabase user object
}

export function Navbar({ user }: NavbarProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  return (
    <>
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50 bg-transparent">
        <Link href="/" className="flex items-center gap-2 group transition-all">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-all">
            <Layers className="w-6 h-6 text-blue-500" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            MetaBuilder<span className="text-blue-500">PRO</span>
          </span>
        </Link>
        
        {user ? (
          <div className="flex items-center gap-4">
            <UserMenu user={user} />
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl shadow-blue-900/30 active:scale-95 border border-blue-400/20"
          >
            Get Started
          </button>
        )}
      </div>

      <AuthDrawer isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
        <LoginForm />
      </AuthDrawer>
    </>
  )
}
