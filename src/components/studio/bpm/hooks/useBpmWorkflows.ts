import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UseBpmWorkflowsProps {
  initialWorkflows: any[]
  projectId?: string
  useCaseId?: string
  project?: any
  reactFlowInstance: any
  setNodes: (nodes: any[]) => void
  setEdges: (edges: any[]) => void
  fitView: (options: any) => void
  initialNodes: any[]
  toast: (msg: string, type: 'success' | 'error' | 'info') => void
  t: (key: string, fallback?: string) => string
}

export function useBpmWorkflows({
  initialWorkflows,
  projectId,
  useCaseId,
  project,
  reactFlowInstance,
  setNodes,
  setEdges,
  fitView,
  initialNodes,
  toast,
  t
}: UseBpmWorkflowsProps) {
  const supabase = createClient()
  
  const [workflows, setWorkflows] = useState<any[]>(initialWorkflows)
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string>('new')
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (currentWorkflowId === 'new') {
      setNodes(initialNodes)
      setEdges([])
      setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50)
      return
    }

    const flow = workflows.find(w => w.id === currentWorkflowId)
    if (flow) {
      const activeFlowData = flow.draft_flow_data || flow.flow_data
      if (activeFlowData) {
        const { nodes: savedNodes = [], edges: savedEdges = [] } = activeFlowData
        setNodes(savedNodes.length > 0 ? savedNodes : initialNodes)
        setEdges(savedEdges)
        setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50)
      } else {
        setNodes(initialNodes)
        setEdges([])
        setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50)
      }
    }
  }, [currentWorkflowId, workflows, setNodes, setEdges, fitView, initialNodes])

  const handleSave = async () => {
    if (!reactFlowInstance || !projectId || !useCaseId) return

    setIsSaving(true)
    const flow = reactFlowInstance.toObject()
    
    try {
      if (currentWorkflowId === 'new') {
        const name = prompt(t('bpm.canvas.prompts.new_flow_name', 'Qual o nome deste novo fluxo?'), t('bpm.canvas.prompts.new_flow_default', 'Novo Fluxo'))
        if (!name) {
          setIsSaving(false)
          return
        }

        const { data, error } = await supabase
          .from('bpm_workflows')
          .insert({
            project_id: projectId,
            name: name,
            use_case_id: useCaseId,
            draft_flow_data: flow,
            is_active: false
          })
          .select()
          .single()

        if (error) throw error
        
        toast(t('bpm.canvas.toasts.draft_created', 'Rascunho criado com sucesso!'), 'success')
        setWorkflows(prev => [data, ...prev])
        setCurrentWorkflowId(data.id)
      } else {
        const { error } = await supabase
          .from('bpm_workflows')
          .update({
            draft_flow_data: flow,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentWorkflowId)

        if (error) throw error
        toast(t('bpm.canvas.toasts.draft_updated', 'Rascunho atualizado com sucesso!'), 'success')
        
        setWorkflows(prev => prev.map(w => w.id === currentWorkflowId ? { ...w, draft_flow_data: flow } : w))
      }
    } catch (err: any) {
      console.error(err)
      toast(t('bpm.canvas.toasts.save_draft_error', 'Erro ao salvar o rascunho.'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!reactFlowInstance || !projectId || !useCaseId) return
    
    if (currentWorkflowId === 'new') {
      toast(t('bpm.canvas.toasts.save_draft_before_publish', 'Salve o fluxo como rascunho antes de publicar.'), 'error')
      return
    }

    setIsPublishing(true)
    const flow = reactFlowInstance.toObject()

    try {
      const { error } = await supabase
        .from('bpm_workflows')
        .update({
          flow_data: flow,
          draft_flow_data: null,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentWorkflowId)

      if (error) throw error
      
      try {
        const channel = supabase.channel(`tunnel:${projectId}`)
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                action: 'sync_bpm',
                token: project?.secret_token || 'test-token',
                schemaName: project?.slug || 'public',
                queryId: crypto.randomUUID()
              }
            })
            setTimeout(() => { supabase.removeChannel(channel) }, 3000)
          }
        })
      } catch(e) {
        console.error('Erro ao notificar o CLI:', e)
      }
      
      toast(t('bpm.canvas.toasts.flow_published', 'Fluxo publicado e ativado em Produção!'), 'success')
      
      setWorkflows(prev => prev.map(w => w.id === currentWorkflowId ? { ...w, flow_data: flow, draft_flow_data: null, is_active: true } : w))
    } catch (err: any) {
      console.error(err)
      toast(t('bpm.canvas.toasts.publish_flow_error', 'Erro ao publicar o fluxo.'), 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleRename = async () => {
    const wf = workflows.find(w => w.id === currentWorkflowId)
    if (!wf) return
    
    const newName = window.prompt(t('bpm.canvas.prompts.flow_name', 'Nome do fluxo:'), wf.name)
    if (!newName || newName === wf.name) return

    try {
      const { error } = await supabase
        .from('bpm_workflows')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', currentWorkflowId)

      if (error) throw error
      
      toast(t('bpm.canvas.toasts.flow_renamed', 'Fluxo renomeado!'), 'success')
      setWorkflows(prev => prev.map(w => w.id === currentWorkflowId ? { ...w, name: newName } : w))
    } catch (err: any) {
      console.error(err)
      toast(t('bpm.canvas.toasts.rename_error', 'Erro ao renomear.'), 'error')
    }
  }

  const handleDelete = () => {
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    setIsDeleteModalOpen(false)
    
    try {
      const { error } = await supabase
        .from('bpm_workflows')
        .delete()
        .eq('id', currentWorkflowId)
        
      if (error) throw error
      
      toast(t('bpm.canvas.toasts.flow_deleted', 'Fluxo excluído com sucesso!'), 'success')
      setWorkflows(prev => prev.filter(w => w.id !== currentWorkflowId))
      setCurrentWorkflowId('new')
    } catch (err: any) {
      console.error(err)
      toast(t('bpm.canvas.toasts.delete_flow_error', 'Erro ao excluir o fluxo.'), 'error')
    }
  }

  return {
    workflows,
    setWorkflows,
    currentWorkflowId,
    setCurrentWorkflowId,
    isSaving,
    isPublishing,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    handleSave,
    handlePublish,
    handleRename,
    handleDelete,
    confirmDelete
  }
}
