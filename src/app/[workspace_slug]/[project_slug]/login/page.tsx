import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { LayoutTemplate, Lock, Mail } from 'lucide-react'

interface ConsumerLoginProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ConsumerLogin({ params }: ConsumerLoginProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  // 1. Resolve Workspace and Project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, workspaces!inner(slug)')
    .eq('slug', project_slug)
    .eq('workspaces.slug', workspace_slug)
    .single()

  if (!project) notFound()

  // 2. Fetch Auth Configuration (Engine + Visuals)
  const { data: authConfig } = await supabase
    .from('project_auth_config')
    .select('auth_type, ui_config')
    .eq('project_id', project.id)
    .single()

  // Default Fallback Configs
  const ui = authConfig?.ui_config || {}
  const title = ui.title || `Acessar ${project.name}`
  const subtitle = ui.subtitle || 'Insira suas credenciais para continuar.'
  const buttonColor = ui.button_color || '#4f46e5'
  const buttonText = ui.button_text || 'Entrar'
  const theme = ui.theme || 'dark'

  const isDark = theme === 'dark'

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark ? 'bg-[#050505]' : 'bg-neutral-100'}`}>
      
      {/* Container Principal do Login */}
      <div className={`w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden transition-all duration-500 ${isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
        
        {/* Decorative Glow */}
        <div 
          className="absolute top-0 right-0 w-48 h-48 blur-[80px] opacity-20 pointer-events-none"
          style={{ backgroundColor: buttonColor }}
        ></div>

        <div className="relative z-10">
          <div className={`w-14 h-14 rounded-2xl mb-8 flex items-center justify-center border shadow-inner ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
            <LayoutTemplate className={`w-7 h-7 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
          </div>
          
          <h1 className={`text-3xl font-extrabold mb-2 tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            {title}
          </h1>
          <p className={`text-sm mb-10 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {subtitle}
          </p>

          <form className="space-y-5">
            <div className="space-y-2">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                Identificação
              </label>
              <div className="relative group">
                <Mail className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-neutral-600 group-focus-within:text-white' : 'text-neutral-400 group-focus-within:text-black'}`} />
                <input 
                  type="text"
                  placeholder="Seu email ou usuário"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all border ${isDark ? 'bg-neutral-950 border-neutral-800 text-white focus:border-neutral-600' : 'bg-neutral-50 border-neutral-200 text-black focus:border-neutral-400'}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  Senha
                </label>
                <a href="#" className="text-[10px] font-bold hover:underline" style={{ color: buttonColor }}>
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative group">
                <Lock className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-neutral-600 group-focus-within:text-white' : 'text-neutral-400 group-focus-within:text-black'}`} />
                <input 
                  type="password"
                  placeholder="••••••••"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all border ${isDark ? 'bg-neutral-950 border-neutral-800 text-white focus:border-neutral-600' : 'bg-neutral-50 border-neutral-200 text-black focus:border-neutral-400'}`}
                />
              </div>
            </div>
            
            <button 
              type="submit"
              formAction={async () => {
                'use server'
                // Aqui entrará a lógica da Fase 4
                console.log('Integração de Login em construção! Fase 4 do projeto.')
              }}
              className="w-full py-4 rounded-xl text-white text-sm font-bold mt-6 transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: buttonColor, boxShadow: `0 15px 30px -10px ${buttonColor}80` }}
            >
              {buttonText}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Powered by MetaBuilder
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
