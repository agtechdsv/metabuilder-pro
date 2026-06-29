'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Save, X, Code2, Trash2 } from 'lucide-react'
import { ByocEditor } from '@/components/studio/ByocEditor'
import { useToast } from '@/components/ui/Toast'

export function ByocClient({ projectId }: { projectId: string }) {
  const [components, setComponents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeComponent, setActiveComponent] = useState<any | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const { toast } = useToast()
  
  const supabase = createClient()

  useEffect(() => {
    fetchComponents()
  }, [projectId])

  const fetchComponents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ui_custom_components')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      
    if (!error && data) {
      setComponents(data)
    }
    setLoading(false)
  }

  const handleCreateNew = () => {
    setActiveComponent({
      name: '',
      description: '',
      code: `import React from 'react';

export default function MeuNovoComponente(props: any) {
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-neutral-200">
      <h2 className="text-lg font-bold text-indigo-600">Olá, BYOC!</h2>
      <p className="text-neutral-500">Este é o seu primeiro componente customizado.</p>
    </div>
  );
}
`
    })
    setIsEditorOpen(true)
  }

  const handleEdit = (comp: any) => {
    setActiveComponent(comp)
    setIsEditorOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este componente? Ele não será mais exportado.')) return
    
    const { error } = await supabase.from('ui_custom_components').delete().eq('id', id)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Componente excluído com sucesso!', 'success')
      fetchComponents()
    }
  }

  const handleSave = async () => {
    if (!activeComponent) return
    
    const isNew = !activeComponent.id
    
    const payload = {
      project_id: projectId,
      name: activeComponent.name,
      description: activeComponent.description,
      code: activeComponent.code
    }

    let error;

    if (isNew) {
      const { error: insertError } = await supabase.from('ui_custom_components').insert([payload])
      error = insertError
    } else {
      const { error: updateError } = await supabase
        .from('ui_custom_components')
        .update(payload)
        .eq('id', activeComponent.id)
      error = updateError
    }

    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Componente salvo com sucesso!', 'success')
      setIsEditorOpen(false)
      setActiveComponent(null)
      fetchComponents()
    }
  }

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-900">BYOC / Dev Manual</h2>
          <p className="text-neutral-500">Traga seu próprio componente React. Codifique livremente e nós injetamos na exportação final.</p>
        </div>
        <button onClick={handleCreateNew} className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Novo Componente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {components.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-neutral-50">
            <Code2 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-neutral-900">Nenhum componente criado</h3>
            <p className="text-neutral-500 mb-4">Crie o seu primeiro componente para usar a força total do código customizado.</p>
            <button onClick={handleCreateNew} className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-100">Criar Componente</button>
          </div>
        )}
        
        {components.map(comp => (
          <div key={comp.id} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex flex-col">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Code2 className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-lg text-neutral-900">{comp.name}</h3>
              </div>
              <p className="text-sm text-neutral-500 mb-4">{comp.description}</p>
            </div>
            <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
              <button onClick={() => handleEdit(comp)} className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium flex-1 bg-neutral-900 text-white hover:bg-neutral-800">
                Editar Código
              </button>
              <button onClick={() => handleDelete(comp.id)} className="inline-flex items-center justify-center w-10 h-10 rounded-md border text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isEditorOpen && activeComponent && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          {/* Header do Editor */}
          <div className="h-14 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4">
            <div className="flex items-center gap-4 flex-1 max-w-2xl">
              <div className="w-1/3">
                <input 
                  value={activeComponent.name} 
                  onChange={(e) => setActiveComponent({ ...activeComponent, name: e.target.value })}
                  placeholder="NomeDoComponente"
                  className="flex h-8 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 bg-neutral-800 border-neutral-700 text-white focus-visible:ring-indigo-500"
                />
              </div>
              <div className="w-2/3">
                <input 
                  value={activeComponent.description} 
                  onChange={(e) => setActiveComponent({ ...activeComponent, description: e.target.value })}
                  placeholder="Descrição do que este componente faz"
                  className="flex h-8 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 bg-neutral-800 border-neutral-700 text-white focus-visible:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsEditorOpen(false)} className="inline-flex items-center justify-center px-4 rounded-md text-sm font-medium border h-8 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </button>
              <button onClick={handleSave} className="inline-flex items-center justify-center px-4 rounded-md text-sm font-medium h-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Save className="w-4 h-4 mr-2" />
                Salvar Componente
              </button>
            </div>
          </div>
          
          {/* Corpo do Editor */}
          <div className="flex-1 w-full relative bg-[#0a0a0a]">
            <ByocEditor 
              value={activeComponent.code} 
              onChange={(val) => setActiveComponent({ ...activeComponent, code: val || '' })}
              language="typescript" // using typescript for tsx support in monaco
              height="100%"
            />
          </div>
        </div>
      )}
    </div>
  )
}
