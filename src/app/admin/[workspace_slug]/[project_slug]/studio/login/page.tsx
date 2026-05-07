'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Save, 
  Palette,
  LayoutTemplate,
  Monitor,
  Type
} from 'lucide-react'
import Link from 'next/link'

export default function LoginVisualConfigurator() {
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug } = params

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [project, setProject] = useState<any>(null)
  
  const [uiConfig, setUiConfig] = useState({
    title: 'Acessar Conta',
    subtitle: 'Insira suas credenciais para continuar.',
    button_color: '#4f46e5',
    button_text: 'Entrar',
    theme: 'dark'
  })

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      // Resolve Project
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', project_slug)
        .single()
      
      if (proj) {
        setProject(proj)

        // Load existing config
        const { data: config } = await supabase
          .from('project_auth_config')
          .select('ui_config')
          .eq('project_id', proj.id)
          .single()

        if (config && config.ui_config) {
          setUiConfig({ ...uiConfig, ...config.ui_config })
        }
      }
      setIsLoading(false)
    }

    loadData()
  }, [project_slug, supabase])

  const handleSave = async () => {
    if (!project) return
    setIsSaving(true)
    
    try {
      const { error } = await supabase
        .from('project_auth_config')
        .upsert({
          project_id: project.id,
          ui_config: uiConfig
        }, { onConflict: 'project_id' })

      if (error) throw error
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2500)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando Studio...</div>

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      
      <nav className="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}`} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-neutral-800 mx-1"></div>
          <div>
            <h1 className="text-sm font-bold text-white">Configurar Portal de Login</h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Design e Copywriting</p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving || isSuccess}
          className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${isSuccess ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
        >
          {isSaving ? 'Salvando...' : isSuccess ? 'Salvo com sucesso!' : <><Save className="w-4 h-4" /> Publicar Visual</>}
        </button>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-64px)]">
        
        {/* Painel de Propriedades (Esquerda) */}
        <aside className="border-r border-neutral-800 bg-neutral-900/20 p-10 space-y-10 overflow-y-auto">
          
          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Type className="w-4 h-4" /> Textos Principais
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Título da Página</label>
                <input 
                  type="text" 
                  value={uiConfig.title}
                  onChange={e => setUiConfig({...uiConfig, title: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ex: Área do Cliente"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Subtítulo (Instruções)</label>
                <input 
                  type="text" 
                  value={uiConfig.subtitle}
                  onChange={e => setUiConfig({...uiConfig, subtitle: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Palette className="w-4 h-4" /> Estilos e Cores
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Cor do Botão (Hex)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-neutral-700" style={{ backgroundColor: uiConfig.button_color }}></div>
                    <input 
                      type="text" 
                      value={uiConfig.button_color}
                      onChange={e => setUiConfig({...uiConfig, button_color: e.target.value})}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Texto do Botão</label>
                  <input 
                    type="text" 
                    value={uiConfig.button_text}
                    onChange={e => setUiConfig({...uiConfig, button_text: e.target.value})}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Tema do Container</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setUiConfig({...uiConfig, theme: 'dark'})}
                    className={`p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${uiConfig.theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}
                  >
                    Dark Mode
                  </button>
                  <button 
                    onClick={() => setUiConfig({...uiConfig, theme: 'light'})}
                    className={`p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${uiConfig.theme === 'light' ? 'bg-white border-neutral-200 text-black font-bold' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}
                  >
                    Light Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

        </aside>

        {/* Live Preview (Direita) */}
        <main className="p-10 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent)] relative">
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-neutral-900 rounded-full border border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            <Monitor className="w-3 h-3" /> Live Preview
          </div>

          {/* O Preview da Tela de Login */}
          <div className={`w-full max-w-sm rounded-[2rem] p-10 shadow-2xl transition-all duration-500 border ${uiConfig.theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}>
            <div className="w-12 h-12 bg-neutral-800 rounded-xl mb-8 flex items-center justify-center border border-neutral-700">
              <LayoutTemplate className="w-6 h-6 text-neutral-500" />
            </div>
            
            <h2 className={`text-2xl font-bold mb-2 transition-colors ${uiConfig.theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
              {uiConfig.title}
            </h2>
            <p className={`text-sm mb-8 transition-colors ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
              {uiConfig.subtitle}
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase transition-colors ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>Email</label>
                <div className={`w-full h-10 rounded-lg border transition-colors ${uiConfig.theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}></div>
              </div>
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase transition-colors ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>Senha</label>
                <div className={`w-full h-10 rounded-lg border transition-colors ${uiConfig.theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}></div>
              </div>
              
              <button 
                className="w-full py-3 rounded-xl text-white text-sm font-bold mt-4 transition-all hover:opacity-90"
                style={{ backgroundColor: uiConfig.button_color, boxShadow: `0 10px 20px -10px ${uiConfig.button_color}` }}
              >
                {uiConfig.button_text}
              </button>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
