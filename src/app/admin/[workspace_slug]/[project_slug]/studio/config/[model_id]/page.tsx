'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Settings, 
  Layout, 
  CheckCircle2, 
  Circle, 
  ChevronRight,
  GripVertical,
  Monitor,
  Smartphone,
  Tablet,
  Plus
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

/**
 * MetaBuilder Studio - Configurador de Telas (Views)
 */
export default function ViewConfigurator() {
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug, model_id } = params

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [model, setModel] = useState<any>(null)
  const [fields, setFields] = useState<any[]>([])
  const [viewConfig, setViewConfig] = useState({
    name: '',
    slug: '',
    icon: 'layout',
    view_type: 'crud_grid'
  })
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({})
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({})

  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Busca Dados do Model e Fields em paralelo para ganhar tempo
        const [modelRes, fieldsRes] = await Promise.all([
          supabase.from('models').select('*').eq('id', model_id).single(),
          supabase.from('fields').select('*').eq('model_id', model_id).order('order_index', { ascending: true })
        ])

        if (modelRes.error || !fieldsRes.data) return

        const modelData = modelRes.data
        const fieldsData = fieldsRes.data

        // 2. Prepara os dados base (nomes originais)
        const finalSelected: Record<string, boolean> = {}
        const finalLabels: Record<string, string> = {}
        
        fieldsData.forEach(f => {
          finalSelected[f.id] = true
          finalLabels[f.id] = f.display_name || f.db_column_name
        })

        // 3. Busca a View e as personalizações (ui_components)
        const { data: existingView } = await supabase
          .from('ui_views')
          .select('*, ui_components(field_id, is_visible, label)')
          .eq('model_id', model_id)
          .maybeSingle()
        
        if (existingView) {
          setViewConfig({
            name: existingView.name || '',
            slug: existingView.slug || '',
            view_type: existingView.view_type || 'table',
            icon: existingView.icon || 'layout'
          })

          // Sobrescreve com as personalizações do usuário
          if (existingView.ui_components) {
            existingView.ui_components.forEach((c: any) => {
              finalSelected[c.field_id] = c.is_visible
              if (c.label) {
                finalLabels[c.field_id] = c.label
              }
            })
          }
        }

        // 4. Sincroniza tudo de UMA SÓ VEZ
        // Isso evita que o React renderize estados intermediários (o flicker)
        setModel(modelData)
        setFields(fieldsData)
        setSelectedFields(finalSelected)
        setCustomLabels(finalLabels)
        
      } catch (err) {
        console.error('Erro crítico no carregamento do Studio:', err)
      } finally {
        // Só liberamos a tela quando tudo estiver 100% pronto
        setIsLoading(false)
      }
    }

    if (model_id) loadData()
  }, [model_id, supabase])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 1. Upsert na ui_views
      const { data: view, error: viewError } = await supabase
        .from('ui_views')
        .upsert({
          project_id: model.project_id,
          model_id: model.id,
          name: viewConfig.name,
          slug: viewConfig.slug,
          view_type: viewConfig.view_type,
          icon: viewConfig.icon
        }, { onConflict: 'project_id, model_id' })
        .select()
        .single()

      if (viewError) throw viewError

      // 2. Criar/Atualizar ui_components para cada campo selecionado
      const componentPromises = fields.map((field, index) => {
        return supabase
          .from('ui_components')
          .upsert({
            view_id: view.id,
            field_id: field.id,
            label: customLabels[field.id] || field.display_name,
            component_type: field.ui_widget || 'text_input',
            order_index: index,
            is_visible: !!selectedFields[field.id]
          }, { onConflict: 'view_id, field_id' })
      })

      await Promise.all(componentPromises)
      
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        router.push(`/admin/${workspace_slug}/${project_slug}/studio`)
      }, 1500)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando Studio...</div>

  return (
    <div className="min-h-screen bg-[#080808] text-white selection:bg-indigo-500/30">
      
      {/* Top Bar Config */}
      <nav className="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-neutral-800 mx-1"></div>
          <div>
            <h1 className="text-sm font-bold text-white">Configurando Tela</h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{model?.db_table_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-neutral-800 p-1 rounded-lg border border-neutral-700">
            <button className="p-1.5 bg-neutral-700 rounded-md text-white"><Monitor className="w-4 h-4" /></button>
            <button className="p-1.5 text-neutral-500 hover:text-white transition-colors"><Tablet className="w-4 h-4" /></button>
            <button className="p-1.5 text-neutral-500 hover:text-white transition-colors"><Smartphone className="w-4 h-4" /></button>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving || isSuccess}
            className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${isSuccess ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
          >
            {isSaving ? 'Salvando...' : isSuccess ? 'Salvo com sucesso!' : <><Save className="w-4 h-4" /> Salvar Alterações</>}
          </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-64px)]">
        
        {/* Painel de Propriedades (Esquerda) */}
        <aside className="lg:col-span-4 border-r border-neutral-800 bg-neutral-900/20 p-8 space-y-10 overflow-y-auto">
          
          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">Propriedades da Tela</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Nome da View</label>
                <input 
                  type="text" 
                  value={viewConfig.name}
                  onChange={e => setViewConfig({...viewConfig, name: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ex: Painel de Vendas"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Slug da URL</label>
                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm group focus-within:border-indigo-500">
                  <span className="text-neutral-600 mr-1">/</span>
                  <input 
                    type="text" 
                    value={viewConfig.slug}
                    onChange={e => setViewConfig({...viewConfig, slug: e.target.value.toLowerCase().replace(/\s/g, '-')})}
                    className="w-full bg-transparent outline-none"
                    placeholder="vendas"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">Tipo de Visualização</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setViewConfig({...viewConfig, view_type: 'crud_grid'})}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${viewConfig.view_type === 'crud_grid' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}
              >
                <Layout className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">Tabela CRUD</span>
              </button>
              <button 
                disabled
                className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/20 text-neutral-700 flex flex-col items-center gap-3 cursor-not-allowed"
              >
                <GripVertical className="w-6 h-6 opacity-20" />
                <span className="text-[10px] font-bold uppercase opacity-20">Kanban (Breve)</span>
              </button>
            </div>
          </div>

          <Link 
            href={`/${workspace_slug}/${project_slug}/${viewConfig.slug}`} 
            target="_blank"
            className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-indigo-400 hover:bg-indigo-500/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">Visualizar Preview</span>
            </div>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </aside>

        {/* Editor de Componentes (Direita) */}
        <main className="lg:col-span-8 p-10 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.05),transparent)]">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Campos do Banco</h2>
                <p className="text-neutral-500 text-sm">Selecione quais colunas do {model?.db_table_name} devem aparecer nesta View.</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800">
                <Settings className="w-3 h-3" /> 
                {fields.length} CAMPOS DETECTADOS
              </div>
            </div>

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-[2.5rem] overflow-hidden backdrop-blur-sm shadow-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-800/50 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    <th className="px-8 py-5 w-20">Visível</th>
                    <th className="px-8 py-5">Nome Original</th>
                    <th className="px-8 py-5">Tipo</th>
                    <th className="px-8 py-5">Rótulo na UI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {fields.map((field) => (
                    <tr 
                      key={field.id}
                      onClick={() => setSelectedFields(prev => ({...prev, [field.id]: !prev[field.id]}))}
                      className={`group cursor-pointer transition-colors ${selectedFields[field.id] ? 'bg-indigo-500/[0.02]' : 'opacity-40 hover:opacity-70'}`}
                    >
                      <td className="px-8 py-6">
                        {selectedFields[field.id] ? (
                          <CheckCircle2 className="w-6 h-6 text-indigo-500" />
                        ) : (
                          <Circle className="w-6 h-6 text-neutral-700" />
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{field.db_column_name}</span>
                          {field.is_primary_key && <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter">PRIMARY KEY</span>}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-2 py-1 bg-neutral-800 rounded-md text-[10px] font-mono text-neutral-400 border border-neutral-700">
                          {field.data_type}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <input 
                          type="text"
                          value={customLabels[field.id] || ''}
                          onChange={e => setCustomLabels(prev => ({...prev, [field.id]: e.target.value}))}
                          onClick={e => e.stopPropagation()}
                          className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 outline-none w-full"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 border border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4 group hover:border-indigo-500/30 transition-colors">
              <div className="p-4 bg-neutral-900 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
                <Plus className="w-8 h-8 text-neutral-700 group-hover:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-400">Adicionar Campo Virtual</p>
                <p className="text-xs text-neutral-600 mt-1">Crie campos calculados ou botões de ação personalizados.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
