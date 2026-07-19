'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Save, X, Code2, Trash2, FolderSync } from 'lucide-react'
import { ByocEditor } from '@/components/studio/ByocEditor'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import { useI18n } from '@/i18n/I18nContext'

export function ByocClient({ projectId }: { projectId: string }) {
  const [components, setComponents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeComponent, setActiveComponent] = useState<any | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  
  const [localFilePath, setLocalFilePath] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const isDesktop = isTauri()
  
  const { toast } = useToast()
  const { t } = useI18n()
  
  const supabase = createClient()
  
  // Ref para garantir que o polling use sempre o valor mais atualizado de activeComponent e handleSave
  const activeComponentRef = useRef(activeComponent)
  useEffect(() => {
    activeComponentRef.current = activeComponent
  }, [activeComponent])

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

  const handleSave = async (isAutoSave = false) => {
    const currentActive = activeComponentRef.current
    if (!currentActive) return
    
    const isNew = !currentActive.id
    
    const payload = {
      project_id: projectId,
      name: currentActive.name,
      description: currentActive.description,
      code: currentActive.code,
      compiled_code: null as string | null
    }

    try {
      if (!isAutoSave) toast('Compilando componente...', 'info')
      const compileRes = await fetch('/api/byoc/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentActive.code })
      })
      
      const compileData = await compileRes.json()
      if (!compileRes.ok) throw new Error(compileData.error || 'Erro na compilação')
      
      payload.compiled_code = compileData.compiled_code
    } catch (err: any) {
      if (!isAutoSave) toast('Falha na compilação: ' + err.message, 'error')
      else console.error('BYOC Auto-Sync Error:', err.message)
      return
    }

    let error;

    if (isNew) {
      const { data, error: insertError } = await supabase.from('ui_custom_components').insert([payload]).select().single()
      error = insertError
      if (!error && data) {
         setActiveComponent(data)
         activeComponentRef.current = data
      }
    } else {
      const { error: updateError } = await supabase
        .from('ui_custom_components')
        .update(payload)
        .eq('id', currentActive.id)
      error = updateError
    }

    if (error) {
      if (!isAutoSave) toast(error.message, 'error')
      else console.error('BYOC Auto-Sync DB Error:', error.message)
    } else {
      if (!isAutoSave) {
        toast('Componente salvo com sucesso!', 'success')
        setIsEditorOpen(false)
        setActiveComponent(null)
      } else {
        console.log('BYOC Auto-Sync salvo com sucesso.')
        if (isTauri()) {
          import('@tauri-apps/plugin-notification').then(({ sendNotification }) => {
            sendNotification({ 
              title: t('ide.byoc.sync_notif_title', 'BYOC Sincronizado 🔄'), 
              body: t('ide.byoc.sync_notif_body', 'O componente foi sincronizado e compilado com sucesso.') 
            })
          }).catch(console.error)
        }
      }
      fetchComponents()
    }
  }

  // Efeito de Polling para o File Sync
  useEffect(() => {
    let interval: any;
    if (isDesktop && isEditorOpen && isSyncing && localFilePath) {
      interval = setInterval(async () => {
        try {
          const { readTextFile } = await import('@tauri-apps/plugin-fs')
          const content = await readTextFile(localFilePath)
          
          if (activeComponentRef.current && activeComponentRef.current.code !== content) {
            // Atualiza o estado
            setActiveComponent((prev: any) => ({ ...prev, code: content }))
            activeComponentRef.current = { ...activeComponentRef.current, code: content }
            // Salva e compila automaticamente
            handleSave(true)
          }
        } catch (e) {
          console.error('Falha ao ler arquivo local para sync', e)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [isDesktop, isEditorOpen, isSyncing, localFilePath])

  const handleLinkLocalFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        filters: [{ name: 'React', extensions: ['tsx', 'jsx', 'ts', 'js'] }]
      })
      if (selected && typeof selected === 'string') {
        setLocalFilePath(selected)
        setIsSyncing(true)
        toast('Arquivo vinculado com sucesso! Sync ativado.', 'success')
      }
    } catch (e) {
      console.error(e)
      toast('Erro ao vincular arquivo.', 'error')
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
              {isDesktop && (
                <button 
                  onClick={handleLinkLocalFile} 
                  className={`inline-flex items-center justify-center px-4 rounded-md text-sm font-medium border h-8 transition-colors ${
                    isSyncing 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
                      : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                  }`}
                  title={localFilePath || 'Vincular Arquivo Local'}
                >
                  <FolderSync className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-pulse' : ''}`} />
                  {isSyncing ? 'Sync Ativo' : 'Vincular Arquivo'}
                </button>
              )}
              <button onClick={() => { setIsEditorOpen(false); setIsSyncing(false); setLocalFilePath(null); }} className="inline-flex items-center justify-center px-4 rounded-md text-sm font-medium border h-8 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </button>
              <button onClick={() => handleSave(false)} className="inline-flex items-center justify-center px-4 rounded-md text-sm font-medium h-8 bg-indigo-600 hover:bg-indigo-700 text-white">
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
