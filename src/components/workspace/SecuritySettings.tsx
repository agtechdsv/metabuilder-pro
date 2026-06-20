'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Smartphone, KeyRound, AlertCircle, Fingerprint } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { startRegistration } from '@simplewebauthn/browser'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface SecuritySettingsProps {
  profile: any
  isOwner: boolean
  isPersonalOnly?: boolean
}

export default function SecuritySettings({ profile, isOwner, isPersonalOnly = false }: SecuritySettingsProps) {
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const [mfaRequired, setMfaRequired] = useState(profile?.enforce_mfa || false)
  const [passkeyEnabled, setPasskeyEnabled] = useState(profile?.passkey_enabled || false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  
  const [hasMfaSetup, setHasMfaSetup] = useState(false)
  const [isRemovingMfa, setIsRemovingMfa] = useState(false)
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false)

  const [hasPasskeySetup, setHasPasskeySetup] = useState(false)
  const [isRemovingPasskey, setIsRemovingPasskey] = useState(false)
  const [isConfirmingPasskeyRemoval, setIsConfirmingPasskeyRemoval] = useState(false)

  useEffect(() => {
    setMfaRequired(profile?.enforce_mfa || false)
    setPasskeyEnabled(profile?.passkey_enabled || false)

    // Check if the user personally has an MFA setup
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totpFactors = data?.totp || []
      setHasMfaSetup(totpFactors.some(f => f.status === 'verified'))
    })

    // Check if the user has a Passkey setup
    supabase.from('passkey_credentials').select('credential_id').eq('user_id', profile.id).limit(1).then(({ data }) => {
      setHasPasskeySetup(Boolean(data && data.length > 0))
    })
  }, [profile?.enforce_mfa, profile?.passkey_enabled, profile.id, supabase])

  const handleRegisterDevice = async () => {
    setIsRegistering(true)
    try {
      // 1. Pega opções do backend
      const resp = await fetch('/api/auth/passkeys/register/generate-options', { method: 'POST' })
      if (!resp.ok) throw new Error('Falha ao gerar desafio')
      const options = await resp.json()

      // 2. Chama a API do browser
      const attResp = await startRegistration(options)

      // 3. Envia o resultado para o backend validar e salvar
      const verificationResp = await fetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      })

      if (!verificationResp.ok) throw new Error('Falha na verificação')

      const verificationJSON = await verificationResp.json()
      if (verificationJSON.verified) {
        toast('Aparelho registrado com sucesso!', 'success')
      } else {
        throw new Error('Falha ao registrar')
      }
    } catch (error: any) {
      console.error(error)
      if (error.name === 'NotAllowedError' || error.message?.includes('timed out or was not allowed')) {
        toast('Operação cancelada ou aparelho incompatível.', 'error')
      } else {
        toast(error.message || 'Erro ao registrar biometria no aparelho.', 'error')
      }
    } finally {
      setIsRegistering(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          enforce_mfa: mfaRequired,
          passkey_enabled: passkeyEnabled
        })
        .eq('id', profile.id)

      if (error) throw error

      toast('Configurações de segurança atualizadas com sucesso', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao atualizar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemovePersonalMfa = async () => {
    if (!isConfirmingRemoval) {
      setIsConfirmingRemoval(true)
      return
    }

    setIsRemovingMfa(true)
    try {
      const { unenrollPersonalMfa } = await import('@/app/auth/actions')
      const res = await unenrollPersonalMfa()
      if (res.error) throw new Error(res.error)

      toast('Google Authenticator removido com sucesso!', 'success')
      setHasMfaSetup(false)
      setIsConfirmingRemoval(false)
    } catch (err: any) {
      toast(err.message || 'Erro ao remover MFA.', 'error')
    } finally {
      setIsRemovingMfa(false)
    }
  }

  const handleRemovePasskey = async () => {
    if (!isConfirmingPasskeyRemoval) {
      setIsConfirmingPasskeyRemoval(true)
      return
    }

    setIsRemovingPasskey(true)
    try {
      const { removePasskeys } = await import('@/app/auth/actions')
      const res = await removePasskeys()
      if (res.error) throw new Error(res.error)

      toast('Biometria removida com sucesso!', 'success')
      setHasPasskeySetup(false)
      setIsConfirmingPasskeyRemoval(false)
    } catch (err: any) {
      toast(err.message || 'Erro ao remover biometria.', 'error')
    } finally {
      setIsRemovingPasskey(false)
    }
  }

  return (
    <div className={isPersonalOnly ? "" : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm"}>
      {!isPersonalOnly && (
        <div className="flex items-center gap-3 mb-8 border-b border-neutral-100 dark:border-neutral-800 pb-6">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center text-red-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-wider">
              Segurança Global
            </h3>
            <p className="text-xs text-neutral-500 mt-1 font-medium">
              Regras de autenticação para os DEVs convidados neste Workspace.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Passkey Toggle */}
        <div className="flex flex-col gap-4 p-6 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {!isPersonalOnly && (
            <div className="flex items-center justify-between">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl text-indigo-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Autenticação Biométrica (Passkey)</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-lg">
                    Permite que você e os DEVs do time façam login no painel do MetaBuilderPRO utilizando biometria (FaceID / TouchID).
                  </p>
                </div>
              </div>
              <button
                disabled={!isOwner || isSaving}
                onClick={() => setPasskeyEnabled(!passkeyEnabled)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${passkeyEnabled ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${passkeyEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
          )}

          {(isPersonalOnly || passkeyEnabled) && (
            <div className="mt-2 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Meu Dispositivo</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Para acessar usando biometria, cadastre este aparelho.</p>
              </div>
              <button
                onClick={handleRegisterDevice}
                disabled={isRegistering}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" />
                {isRegistering ? 'Aguardando FaceID...' : 'Registrar Este Aparelho'}
              </button>
            </div>
          )}

          {hasPasskeySetup && (
            <div className="flex items-center justify-between p-6 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-200 dark:border-red-900/50 mt-2">
              <div>
                <h4 className="text-sm font-bold text-red-900 dark:text-red-400">Remover Chave Passkey</h4>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1 max-w-lg">
                  Desvincula o seu aparelho atual, permitindo cadastrar um novo ou limpar o acesso.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isConfirmingPasskeyRemoval && (
                  <button
                    onClick={() => setIsConfirmingPasskeyRemoval(false)}
                    disabled={isRemovingPasskey}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleRemovePasskey}
                  disabled={isRemovingPasskey}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isRemovingPasskey ? 'Removendo...' : isConfirmingPasskeyRemoval ? 'Sim, quero remover' : 'Remover Chave'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MFA Group */}
        <div className="flex flex-col gap-4 p-6 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {!isPersonalOnly && (
            <div className="flex items-center justify-between">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-red-100 dark:bg-red-500/10 rounded-xl text-red-600">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Autenticação Multi-Fator (MFA) Obrigatória</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-lg">
                    Força todos os DEVs convidados a configurarem um aplicativo Authenticator (Microsoft/Google) antes de acessarem o Workspace.
                  </p>
                </div>
              </div>
              <button
                disabled={!isOwner || isSaving}
                onClick={() => setMfaRequired(!mfaRequired)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${mfaRequired ? 'bg-red-600' : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${mfaRequired ? 'translate-x-8' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
          )}

          {hasMfaSetup && (
            <div className="flex items-center justify-between p-6 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-200 dark:border-red-900/50 mt-2">
              <div>
                <h4 className="text-sm font-bold text-red-900 dark:text-red-400">Remover Meu Authenticator</h4>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1 max-w-lg">
                  Se você perdeu acesso ao seu Authenticator ou quer cadastrá-lo novamente em outro celular, clique aqui para desvinculá-lo da sua conta.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isConfirmingRemoval && (
                  <button
                    onClick={() => setIsConfirmingRemoval(false)}
                    disabled={isRemovingMfa}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleRemovePersonalMfa}
                  disabled={isRemovingMfa}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isRemovingMfa ? 'Removendo...' : isConfirmingRemoval ? 'Sim, quero remover' : 'Remover Agora'}
                </button>
              </div>
            </div>
          )}
        </div>

        {!isOwner && (
          <div className="flex items-center gap-2 p-4 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            Apenas o Owner do Workspace pode alterar as configurações de segurança globais.
          </div>
        )}

          {!isPersonalOnly && isOwner && (
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-bold rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Políticas de Segurança'}
              </button>
            </div>
          )}
      </div>
    </div>
  )
}
