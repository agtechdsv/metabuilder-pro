import { useToast } from '@/components/ui/Toast'

interface UseAnalyticsRuntimeProps {
  project: any
  viewId: string
  localAnalyticsConfig: any
  initialAnalyticsConfig: any
  setLocalAnalyticsConfig: React.Dispatch<React.SetStateAction<any>>
  setEditingWidget: React.Dispatch<React.SetStateAction<any>>
  setIsWidgetModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  supabase: any
}

export function useAnalyticsRuntime({
  project,
  viewId,
  localAnalyticsConfig,
  initialAnalyticsConfig,
  setLocalAnalyticsConfig,
  setEditingWidget,
  setIsWidgetModalOpen,
  supabase
}: UseAnalyticsRuntimeProps) {
  const { toast } = useToast()

  const handleAddWidgetRuntime = () => {
    setEditingWidget({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Widget',
      type: 'kpi',
      model_id: project.models?.[0]?.id || '',
      field: '',
      calc: 'COUNT',
      group_by: '',
      width: 'half'
    })
    setIsWidgetModalOpen(true)
  }

  const handleEditWidgetRuntime = (widget: any) => {
    setEditingWidget(widget)
    setIsWidgetModalOpen(true)
  }

  const handleSaveWidgetRuntime = async (updatedWidget: any) => {
    const currentConfig = localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }
    const currentWidgets = currentConfig.widgets || []
    const exists = currentWidgets.find((w: any) => w.id === updatedWidget.id)
    
    let newWidgets
    if (exists) {
      newWidgets = currentWidgets.map((w: any) => w.id === updatedWidget.id ? updatedWidget : w)
    } else {
      newWidgets = [...currentWidgets, updatedWidget]
    }

    const newConfig = { ...currentConfig, widgets: newWidgets }
    setLocalAnalyticsConfig(newConfig)
    setIsWidgetModalOpen(false)
    setEditingWidget(null)

    // Persistir no banco
    try {
      const { data: viewData } = await supabase.from('ui_views').select('layout_config').eq('id', viewId).single()
      const updatedLayoutConfig = { ...viewData?.layout_config, analytics_config: newConfig }

      // Auto-Discovery: Atualiza tables_config baseado nos widgets do BI para garantir carregamento correto
      const widgetModels = (newWidgets || []).map((w: any) => w.model_id)
      const joinModels = (viewData?.layout_config?.joins || []).flatMap((j: any) => {
        const fromModel = project.models?.find((m: any) => m.db_table_name === j.from)
        const toModel = project.models?.find((m: any) => m.db_table_name === j.to)
        return [fromModel?.id, toModel?.id].filter(Boolean)
      })
      const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean)

      const { error } = await supabase
        .from('ui_views')
        .update({ 
          layout_config: updatedLayoutConfig,
          tables_config: allInvolved // Sincroniza as tabelas necessárias
        })
        .eq('id', viewId)
      
      if (error) throw error
      toast('Dashboard atualizado com sucesso!', 'success')
    } catch (err: any) {
      console.error('Error persisting dashboard:', err)
      toast('Erro ao salvar dashboard: ' + err.message, 'error')
    }
  }

  const handleSaveDashboardLayout = async (newWidgets: any[]) => {
    const currentConfig = localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }
    const newConfig = { ...currentConfig, widgets: newWidgets }
    setLocalAnalyticsConfig(newConfig)

    try {
      const { data: viewData } = await supabase.from('ui_views').select('layout_config').eq('id', viewId).single()
      const updatedLayoutConfig = { ...viewData?.layout_config, analytics_config: newConfig }

      const { error } = await supabase
        .from('ui_views')
        .update({ layout_config: updatedLayoutConfig })
        .eq('id', viewId)
      
      if (error) throw error
      toast('Layout do dashboard salvo com sucesso!', 'success')
    } catch (err: any) {
      console.error('Error saving dashboard layout:', err)
      toast('Erro ao salvar ordem do dashboard: ' + err.message, 'error')
    }
  }

  const handleDeleteWidgetRuntime = async (id: string) => {
    const currentConfig = localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }
    const newWidgets = (currentConfig.widgets || []).filter((w: any) => w.id !== id)
    const newConfig = { ...currentConfig, widgets: newWidgets }
    
    setLocalAnalyticsConfig(newConfig)

    try {
      const { data: viewData } = await supabase.from('ui_views').select('layout_config').eq('id', viewId).single()
      const updatedLayoutConfig = { ...viewData?.layout_config, analytics_config: newConfig }
      
      const widgetModels = (newWidgets || []).map((w: any) => w.model_id)
      const joinModels = (updatedLayoutConfig.joins || []).flatMap((j: any) => {
        const fromModel = project.models?.find((m: any) => m.db_table_name === j.from)
        const toModel = project.models?.find((m: any) => m.db_table_name === j.to)
        return [fromModel?.id, toModel?.id].filter(Boolean)
      })
      const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean)

      const { error } = await supabase
        .from('ui_views')
        .update({ 
          layout_config: updatedLayoutConfig,
          tables_config: allInvolved
        })
        .eq('id', viewId)
      
      if (error) throw error
      toast('Indicador removido.', 'info')
    } catch (err: any) {
      console.error('Error deleting widget:', err)
      toast('Erro ao remover indicador.', 'error')
    }
  }

  return {
    handleAddWidgetRuntime,
    handleEditWidgetRuntime,
    handleSaveWidgetRuntime,
    handleSaveDashboardLayout,
    handleDeleteWidgetRuntime
  }
}
