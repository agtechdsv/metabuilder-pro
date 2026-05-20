import { LoginForm } from '@/components/auth/LoginForm'
import { Layers } from 'lucide-react'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-50 to-neutral-200 dark:from-neutral-900 dark:to-black text-neutral-900 dark:text-white transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-md transition-all">
          <LoginForm 
            error={resolvedSearchParams?.error} 
          />
        </div>

        <p className="text-center text-xs text-neutral-500 font-medium">
          Secure enterprise authentication powered by MetaBuilderPRO
        </p>
      </div>
    </main>
  )
}
