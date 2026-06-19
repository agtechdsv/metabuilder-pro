'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldAlert, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

export function MfaSetupForm() {
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [secretStr, setSecretStr] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const setupMfa = async () => {
      try {
        const supabase = createClient()
        // Verificar se usuário está logado em AAL1 (password)
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push('/login')
          return
        }

        const { data: existingFactors } = await supabase.auth.mfa.listFactors()
        if (existingFactors && existingFactors.totp) {
          const unverifiedFactors = existingFactors.totp.filter((f: any) => f.status === 'unverified')
          for (const f of unverifiedFactors) {
            await supabase.auth.mfa.unenroll({ factorId: f.id })
          }
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'MetaBuilderPRO',
          friendlyName: user.email || 'Conta Corporativa',
        })

        if (error) throw error

        setFactorId(data.id)
        setTotpUri(data.totp.uri)
        setSecretStr(data.totp.secret)
        setIsLoading(false)
      } catch (err: any) {
        setError(err.message || 'Erro ao iniciar configuração do MFA')
        setIsLoading(false)
      }
    }

    setupMfa()
  }, [router])

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

      // Setup concluído e validado com sucesso.
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
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Preparando Autenticador...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex relative group mb-6">
          <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full" />
          <div className="relative p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight mb-2">
          Segurança Obrigatória
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium px-4 leading-relaxed">
          A política da empresa exige a configuração do Autenticador em 2 Fatores (Google Authenticator ou Authy).
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-500/80 font-bold leading-relaxed">{error}</p>
        </div>
      )}

      {totpUri && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-3xl flex flex-col items-center justify-center shadow-inner">
            <div className="w-48 h-48 rounded-xl overflow-hidden flex items-center justify-center bg-white p-2">
              <QRCodeSVG value={totpUri} size={180} level="M" />
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Ou digite o código manualmente:</p>
            <p className="font-mono text-sm font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 py-2 rounded-lg break-all px-2">{secretStr}</p>
          </div>

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
                  Verificar e Concluir <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
