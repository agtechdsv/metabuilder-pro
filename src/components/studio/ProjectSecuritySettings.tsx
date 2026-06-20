'use client'

import React, { useState } from 'react'
import { Shield, Smartphone, KeyRound, AlertCircle, Fingerprint } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface ProjectSecuritySettingsProps {
  project: any
  canEdit: boolean
}

export function ProjectSecuritySettings({ project, canEdit }: ProjectSecuritySettingsProps) {
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  
  const initialSecurity = project.theme_config?.security || {
    mfa_enabled: false,
    passkey_enabled: false
  }

  const [mfaEnabled, setMfaEnabled] = useState(initialSecurity.mfa_enabled)
  const [passkeyEnabled, setPasskeyEnabled] = useState(initialSecurity.passkey_enabled)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const newConfig = {
        ...(project.theme_config || {}),
        security: {
          mfa_enabled: mfaEnabled,
          passkey_enabled: passkeyEnabled
        }
      }

      const { error } = await supabase
        .from('projects')
        .update({ theme_config: newConfig })
        .eq('id', project.id)

      if (error) throw error

      toast('Configurações de segurança do projeto salvas com sucesso', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao atualizar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm max-w-4xl mx-auto">
      <div className="flex flex-col items-center text-center mb-10 pb-8 border-b border-neutral-100 dark:border-neutral-800/60">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-2xl flex items-center justify-center text-neutral-900 dark:text-white mb-6">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
          Segurança do App
        </h2>
        <p className="text-sm text-neutral-500 mt-3 max-w-lg">
          Configure as regras de autenticação e os métodos de login disponíveis para os <b>usuários finais</b> deste projeto.
        </p>
      </div>

      <div className="space-y-6">
        {/* Passkey Toggle */}
        <div className={`flex items-center justify-between p-6 rounded-2xl border transition-colors ${passkeyEnabled ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-800'}`}>
          <div className="flex gap-4 items-start">
            <div className={`p-3 rounded-xl ${passkeyEnabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h4 className="text-base font-bold text-neutral-900 dark:text-white">Login por Biometria (Passkey)</h4>
                <span className="px-2 py-0.5 bg-neutral-900 text-white dark:bg-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-md">Recomendado</span>
              </div>
              <p className="text-sm text-neutral-500 mt-1 max-w-md leading-relaxed">
                Ofereça uma experiência premium e segura. Permite que os usuários façam login usando FaceID, TouchID ou Windows Hello.
              </p>
            </div>
          </div>
          <button
            disabled={!canEdit || isSaving}
            onClick={() => setPasskeyEnabled(!passkeyEnabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
              passkeyEnabled ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${passkeyEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* MFA Toggle */}
        <div className={`flex items-center justify-between p-6 rounded-2xl border transition-colors ${mfaEnabled ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-500/5 dark:border-amber-500/20' : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-800'}`}>
          <div className="flex gap-4 items-start">
            <div className={`p-3 rounded-xl ${mfaEnabled ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-neutral-900 dark:text-white">Autenticação Multi-Fator (MFA)</h4>
              <p className="text-sm text-neutral-500 mt-1 max-w-md leading-relaxed">
                Exige que os usuários finais configurem um aplicativo Authenticator (Microsoft/Google) para gerar códigos de 6 dígitos.
              </p>
            </div>
          </div>
          <button
            disabled={!canEdit || isSaving}
            onClick={() => setMfaEnabled(!mfaEnabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
              mfaEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${mfaEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {!canEdit && (
          <div className="flex items-center gap-2 p-4 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            Você não tem permissão para alterar as configurações de segurança deste projeto.
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end pt-8">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3.5 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-sm font-black tracking-widest uppercase rounded-2xl transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
              {isSaving ? (
                <>Salvando...</>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Salvar Políticas de Segurança
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
