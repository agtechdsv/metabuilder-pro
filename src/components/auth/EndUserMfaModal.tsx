'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Loader2, QrCode, ArrowRight, ShieldCheck, CheckCircle2, Fingerprint } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'
import { useI18n } from '@/i18n/I18nContext'

interface EndUserMfaModalProps {
  isOpen: boolean
  user: any
  projectId: string
  mfaRequired?: boolean
  passkeyEnabled?: boolean
  onSuccess: () => void
  onCancel: () => void
}

export function EndUserMfaModal({ isOpen, user, projectId, mfaRequired, passkeyEnabled, onSuccess, onCancel }: EndUserMfaModalProps) {
  const [step, setStep] = useState<'loading' | 'setup' | 'verify' | 'passkey_setup'>('loading')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userEmail = user?.email || user?.Email || user?.mail || ''
  const externalUserId = user?.id || user?.ID || user?.Id || userEmail // Fallback to email if no ID
  const { t } = useI18n()

  useEffect(() => {
    if (isOpen && user) {
      if (!mfaRequired && passkeyEnabled) {
        setStep('passkey_setup')
      } else if (mfaRequired) {
        checkAndSetupMfa()
      } else {
        onSuccess() // Failsafe
      }
    } else {
      // Reset state when closed
      setStep('loading')
      setCode('')
      setError(null)
    }
  }, [isOpen, user, mfaRequired, passkeyEnabled])

  const checkAndSetupMfa = async () => {
    try {
      setStep('loading')
      setError(null)

      // Chama a rota de setup. Se o usuário já tiver MFA, a rota retorna o secret (e qrCode).
      // Mas wait, se ele já tem MFA_ENABLED = true, não deveríamos mostrar o QR code.
      // A rota de setup atualmente sempre retorna o qrCode. Vamos ajustar isso no front.
      const res = await fetch('/api/auth/end-user/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, externalUserId, userEmail })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSecret(data.secret)
      setQrCodeUrl(data.qrCodeDataUrl)

      // Se data.alreadyEnabled for true, vai direto pro verify
      if (data.mfaEnabled) {
        setStep('verify')
      } else {
        setStep('setup')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configurações de segurança.')
      setStep('verify') // Fallback
    }
  }

  const handleVerify = async () => {
    if (!code || code.length < 6) return

    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/auth/end-user/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          externalUserId, 
          code, 
          isSetup: step === 'setup' 
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Sucesso no MFA! Verifica se precisa de Passkey
      if (passkeyEnabled) {
        setStep('passkey_setup')
      } else {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Código inválido.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterPasskey = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const optionsRes = await fetch('/api/auth/end-user/passkeys/register/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, externalUserId, userEmail })
      })

      const options = await optionsRes.json()
      if (options.error) throw new Error(options.error)

      let attResp;
      try {
        attResp = await startRegistration(options)
      } catch (e: any) {
        if (e.name === 'NotAllowedError') {
          setIsLoading(false)
          return
        }
        throw e
      }

      const verifyRes = await fetch('/api/auth/end-user/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...attResp,
          projectId,
          externalUserId
        })
      })

      const verification = await verifyRes.json()
      if (verification.error) throw new Error(verification.error)

      onSuccess()
    } catch (err: any) {
      setError(err.message || t('security.error_register_biometrics', 'Erro ao registrar biometria.'))
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
      >
        <div className="p-8">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
            <ShieldCheck className="w-6 h-6" />
          </div>
          
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            {t('security.verification', 'Verificação de Segurança')}
          </h2>
          {mfaRequired && step !== 'passkey_setup' && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
              {t('security.mfa_required', 'Este aplicativo exige Autenticação de Dois Fatores (MFA).')}
            </p>
          )}

          <AnimatePresence mode="wait">
            {step === 'loading' && (
              <motion.div key="loading" className="flex flex-col items-center justify-center py-12" exit={{ opacity: 0 }}>
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                <p className="text-sm text-neutral-500">{t('security.preparing_env', 'Preparando ambiente seguro...')}</p>
              </motion.div>
            )}

            {step === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-white dark:bg-neutral-900 rounded-xl flex items-center justify-center shadow-sm border border-neutral-200 dark:border-neutral-800 mb-4">
                    <QrCode className="w-5 h-5 text-neutral-900 dark:text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">{t('security.configure_authenticator', 'Configure seu Authenticator')}</h3>
                  <p className="text-xs text-neutral-500 mb-6">
                    {t('security.scan_qr', 'Escaneie o QR Code abaixo usando o Google Authenticator ou Authy.')}
                  </p>
                  
                  {qrCodeUrl ? (
                    <div className="p-3 bg-white rounded-xl shadow-sm border border-neutral-200">
                      <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider ml-1">
                    {t('security.six_digit_code', 'Código de 6 dígitos')}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-14 text-center text-2xl tracking-[0.5em] font-bold rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 font-medium text-center bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={onCancel} className="flex-1 h-12 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    {t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={isLoading || code.length < 6}
                    className="flex-[2] h-12 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('security.verify_and_enter', 'Verificar e Entrar')}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div key="verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider ml-1">
                    {t('security.authenticator_code', 'Código do Authenticator')}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="w-full h-14 text-center text-2xl tracking-[0.5em] font-bold rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 font-medium text-center bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={onCancel} className="flex-1 h-12 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    {t('common.back', 'Voltar')}
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={isLoading || code.length < 6}
                    className="flex-[2] h-12 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.access', 'Acessar')}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'passkey_setup' && (
              <motion.div key="passkey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-center">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Fingerprint className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t('security.enable_biometrics_prompt', 'Deseja habilitar Login por Biometria?')}</h3>
                <p className="text-sm text-neutral-500">
                  {t('security.biometrics_prompt_desc', 'Na próxima vez que você fizer login neste aparelho, poderá usar FaceID, TouchID ou a biometria do seu sistema em vez de digitar sua senha.')}
                </p>

                {error && (
                  <p className="text-xs text-red-500 font-medium bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={handleRegisterPasskey}
                    disabled={isLoading}
                    className="w-full h-14 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Fingerprint className="w-5 h-5" /> {t('security.register_biometrics', 'Registrar Biometria (Recomendado)')}</>}
                  </button>
                  <button 
                    onClick={onSuccess} 
                    disabled={isLoading}
                    className="w-full h-12 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t('security.skip_for_now', 'Pular por agora')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
