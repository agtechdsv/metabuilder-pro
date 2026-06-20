'use client'

import React, { useState } from 'react'
import { Shield, Smartphone, KeyRound, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface SecuritySettingsProps {
  workspace: any
  isOwner: boolean
}

export default function SecuritySettings({ workspace, isOwner }: SecuritySettingsProps) {
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  
  const initialSecurity = workspace.theme_config?.security || {
    mfa_required: false,
    passkey_enabled: false
  }

  const [mfaRequired, setMfaRequired] = useState(initialSecurity.mfa_required)
  const [passkeyEnabled, setPasskeyEnabled] = useState(initialSecurity.passkey_enabled)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const newConfig = {
        ...(workspace.theme_config || {}),
        security: {
          mfa_required: mfaRequired,
          passkey_enabled: passkeyEnabled
        }
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ theme_config: newConfig })
        .eq('id', workspace.id)

      if (error) throw error

      toast('Configurações de segurança atualizadas com sucesso', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao atualizar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm">
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

      <div className="space-y-6">
        {/* Passkey Toggle */}
        <div className="flex items-center justify-between p-6 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800">
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
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
              passkeyEnabled ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                passkeyEnabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* MFA Toggle */}
        <div className="flex items-center justify-between p-6 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800">
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
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
              mfaRequired ? 'bg-red-600' : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                mfaRequired ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {!isOwner && (
          <div className="flex items-center gap-2 p-4 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            Apenas o Owner do Workspace pode alterar as configurações de segurança globais.
          </div>
        )}

        {isOwner && (
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg active:scale-95"
            >
              {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
