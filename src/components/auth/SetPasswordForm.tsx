'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { KeyRound, Eye, EyeOff, Loader2, LogOut, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setPasswordAction } from '@/app/auth/set-password/actions'

interface SetPasswordFormProps {
  workspaceSlug?: string
}

export function SetPasswordForm({ workspaceSlug }: SetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  const { toast } = useToast()
  const supabase = createClient()

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      toast('Por favor, informe a senha.', 'error')
      return
    }

    if (password.length < 6) {
      toast('A senha deve ter pelo menos 6 caracteres.', 'error')
      return
    }

    if (password !== confirmPassword) {
      toast('As senhas não coincidem.', 'error')
      return
    }

    setIsLoading(true)
    try {
      // Chama a Server Action — ela executa no servidor com acesso direto ao
      // cookie store, evitando o race-condition entre client e servidor.
      // O redirect também acontece server-side, garantindo que a sessão
      // atualizada já esteja gravada antes da navegação.
      const result = await setPasswordAction(password, workspaceSlug)

      // Se chegou aqui sem redirect, houve um erro
      if (result?.error) {
        throw new Error(result.error)
      }
    } catch (err: any) {
      // Erros de redirect do Next.js propagam como exceção — ignorar
      if (err?.message?.includes('NEXT_REDIRECT')) return
      toast(err.message || 'Erro ao definir senha.', 'error')
      setIsLoading(false)
    }
    // Não reseta isLoading em caso de sucesso: o redirect está em andamento
  }

  const handleCancel = async () => {
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erro ao deslogar no cancelamento:', err)
    } finally {
      setIsLoggingOut(false)
      window.location.href = '/'
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-650 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-550/15">
          <KeyRound className="h-6 w-6 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
          Defina sua Senha
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium px-2 leading-relaxed">
          Para garantir a segurança de sua conta, defina uma senha de acesso antes de entrar no Workspace.
        </p>
      </div>

      <form onSubmit={handleSetPassword} className="space-y-5">
        {/* Nova Senha */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">
            Nova Senha
          </label>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua nova senha"
              required
              disabled={isLoading || isLoggingOut}
              className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-2xl py-4 pl-14 pr-14 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || isLoggingOut}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-450 hover:text-indigo-500 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirmar Senha */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">
            Confirmar Nova Senha
          </label>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua nova senha"
              required
              disabled={isLoading || isLoggingOut}
              className={cn(
                "w-full bg-neutral-100/50 dark:bg-neutral-900/50 border rounded-2xl py-4 pl-14 pr-14 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none",
                confirmPassword && (password === confirmPassword ? "border-emerald-500/50 focus:border-emerald-500" : "border-red-500/50 focus:border-red-500"),
                !confirmPassword && "border-neutral-200 dark:border-neutral-800 focus:border-indigo-500"
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading || isLoggingOut}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-450 hover:text-indigo-500 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || isLoggingOut}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)] group relative overflow-hidden"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              <span className="relative z-10">Definir Senha e Acessar</span>
            </>
          )}
        </button>
      </form>

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading || isLoggingOut}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:text-neutral-450 dark:hover:text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              Cancelar e Sair
            </>
          )}
        </button>
      </div>
    </div>
  )
}
