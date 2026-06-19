'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

function ChallengeFormInner() {
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const factorId = searchParams.get('factorId')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || verifyCode.length !== 6) return

    setIsVerifying(true)
    setError(null)
    const supabase = createClient()

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode
      })

      if (verify.error) throw verify.error

      const { data: { user } } = await supabase.auth.getUser()
      let redirectTo = '/workspace'
      if (user) {
        const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
        redirectTo = await getPostLoginRedirectPath(user.id)
      }
      window.location.href = redirectTo
    } catch (err: any) {
      setError('Código inválido ou expirado. Tente novamente.')
      setIsVerifying(false)
      setVerifyCode('')
      inputRef.current?.focus()
    }
  }

  if (!factorId) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-sm text-neutral-500">Fator de autenticação não encontrado.</p>
        <button onClick={() => router.push('/login')} className="mt-4 text-indigo-500 font-bold text-xs">Voltar ao Login</button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex relative group mb-6">
          <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full" />
          <div className="relative p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight mb-2">
          Verificação de 2 Fatores
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium px-4 leading-relaxed">
          Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-500/80 font-bold leading-relaxed">{error}</p>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-2">Código de 6 Dígitos</label>
          <div className="relative group">
            <input
              type="text"
              required
              maxLength={6}
              ref={inputRef}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 rounded-2xl py-4 text-center text-2xl tracking-[0.5em] font-mono text-neutral-900 dark:text-white placeholder:text-neutral-300 transition-all outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isVerifying || verifyCode.length !== 6}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-8 shadow-lg shadow-indigo-500/20"
        >
          {isVerifying ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Autenticar <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
      
      <div className="mt-8 text-center">
        <button onClick={() => {
          const supabase = createClient()
          supabase.auth.signOut().then(() => {
            window.location.href = '/login'
          })
        }} className="text-[10px] font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 uppercase tracking-widest">
          Fazer login com outra conta
        </button>
      </div>
    </div>
  )
}

export function MfaChallengeForm() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>}>
      <ChallengeFormInner />
    </Suspense>
  )
}
