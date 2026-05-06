import { LoginForm } from '@/components/auth/LoginForm'
import { Layers } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900 to-black text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[2rem] shadow-2xl backdrop-blur-sm">
          <LoginForm 
            error={searchParams?.error} 
            message={searchParams?.message} 
          />
        </div>

        <p className="text-center text-xs text-neutral-500">
          Secure enterprise authentication powered by Supabase
        </p>
      </div>
    </main>
  )
}
