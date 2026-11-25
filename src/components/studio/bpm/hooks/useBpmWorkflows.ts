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
  // Modal de nome do fluxo (substitui o prompt() do navegador): criar rascunho novo ou renomear
  const [nameDialog, setNameDialog] = useState<{ mode: 'create' | 'rename'; value: string } | null>(null)

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

    // Fluxo novo: pede o nome num modal; o salvamento continua em saveNewDraft
    if (currentWorkflowId === 'new') {
      setNameDialog({ mode: 'create', value: t('bpm.canvas.prompts.new_flow_default', 'Novo Fluxo') })
      return
    }

    setIsSaving(true)
    const flow = reactFlowInstance.toObject()

    try {
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
    } catch (err: any) {
      console.error(err)
      toast(t('bpm.canvas.toasts.save_draft_error', 'Erro ao salvar o rascunho.'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Cria o rascunho de um fluxo novo com o nome escolhido no modal
  const saveNewDraft = async (name: string) => {
    if (!reactFlowInstance || !projectId || !useCaseId) return

    setIsSaving(true)
    const flow = reactFlowInstance.toObject()

    try {
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
        channel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                action: 'sync_bpm',
                token: project?.secret_token || '',
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
    
    setNameDialog({ mode: 'rename', value: wf.name })
  }

  const renameTo = async (newName: string) => {
    const wf = workflows.find(w => w.id === currentWorkflowId)
    if (!wf || !newName || newName === wf.name) return

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

  const confirmNameDialog = async () => {
    if (!nameDialog) return
    const name = nameDialog.value.trim()
    if (!name) return
    const mode = nameDialog.mode
    setNameDialog(null)
    if (mode === 'create') await saveNewDraft(name)
    else await renameTo(name)
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
    nameDialog,
    setNameDialog,
    confirmNameDialog,
    handleSave,
    handlePublish,
    handleRename,
    handleDelete,
    confirmDelete
  }
}
