'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Loader2, QrCode, ShieldCheck, X, Trash2, KeyRound, Fingerprint, Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { startRegistration } from '@simplewebauthn/browser'
import { EndUserMfaModal } from '@/components/auth/EndUserMfaModal'

interface EndUserSecurityDrawerProps {
  isOpen: boolean
  onClose: () => void
  user: any
  projectId: string
}

export function EndUserSecurityDrawer({ isOpen, onClose, user, projectId }: EndUserSecurityDrawerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [securityData, setSecurityData] = useState<any>(null)
  const [showMfaModal, setShowMfaModal] = useState(false)
  
  const supabase = createClient()
  const userEmail = user?.email || user?.Email || user?.mail || ''
  const externalUserId = user?.id || user?.ID || user?.Id || userEmail

  const fetchSecurityData = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('project_users_security')
      .select('*')
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)
      .single()
      
    if (data) {
      setSecurityData(data)
    } else {
      setSecurityData({ mfa_enabled: false, passkeys: [] })
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      fetchSecurityData()
    }
  }, [isOpen])

  const handleRegisterPasskey = async () => {
    try {
      setIsLoading(true)

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

      fetchSecurityData()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Erro ao registrar biometria.')
      setIsLoading(false)
    }
  }

  const handleDeletePasskey = async (credentialID: string) => {
    if (!confirm('Tem certeza que deseja remover esta biometria?')) return

    try {
      setIsLoading(true)
      const updatedPasskeys = securityData.passkeys.filter((pk: any) => pk.credentialID !== credentialID)
      
      const { error } = await supabase
        .from('project_users_security')
        .update({ passkeys: updatedPasskeys })
        .eq('id', securityData.id)

      if (error) throw error
      fetchSecurityData()
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  const handleRemoveMfa = async () => {
    if (!confirm('Atenção: Remover o MFA deixará sua conta menos segura. Continuar?')) return

    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('project_users_security')
        .update({ mfa_enabled: false, totp_secret: null })
        .eq('id', securityData.id)

      if (error) throw error
      fetchSecurityData()
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] flex justify-end">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col border-l border-neutral-200 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Segurança
              </h2>
              <p className="text-sm text-neutral-500">Gerencie sua proteção</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <>
                {/* Seção Passkeys */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-emerald-500" />
                        Login por Biometria
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">Use FaceID ou TouchID para entrar sem senha.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {securityData?.passkeys?.map((pk: any) => (
                      <div key={pk.credentialID} className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">Dispositivo Registrado</p>
                            <p className="text-[10px] text-neutral-500">
                              {new Date(pk.registered_at || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeletePasskey(pk.credentialID)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <button 
                      onClick={handleRegisterPasskey}
                      className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Novo Aparelho
                    </button>
                  </div>
                </div>

                <hr className="border-neutral-200 dark:border-neutral-800" />

                {/* Seção MFA */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-500" />
                        Autenticador 2FA
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">Código de 6 dígitos via aplicativo.</p>
                    </div>
                  </div>

                  {securityData?.mfa_enabled ? (
                    <div className="flex items-center justify-between p-4 border border-emerald-200 dark:border-emerald-500/30 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Ativo</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-500">Conta protegida por MFA</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleRemoveMfa}
                        className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                      >
                        Desativar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowMfaModal(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                      Configurar Authenticator
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <EndUserMfaModal 
        isOpen={showMfaModal}
        user={user}
        projectId={projectId}
        mfaRequired={true}
        passkeyEnabled={false}
        onSuccess={() => {
          setShowMfaModal(false)
          fetchSecurityData()
        }}
        onCancel={() => setShowMfaModal(false)}
      />
    </>
  )
}
