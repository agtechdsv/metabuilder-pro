import { useToast } from '@/components/ui/Toast'

interface UseAnalyticsRuntimeProps {
  project: any
  viewId: string
  localAnalyticsConfig: any
  initialAnalyticsConfig: any
  setLocalAnalyticsConfig: React.Dispatch<React.SetStateAction<any>>
  setEditingWidget: React.Dispatch<React.SetStateAction<any>>
  setIsWidgetModalOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useAnalyticsRuntime({
  project,
  viewId,
  localAnalyticsConfig,
  initialAnalyticsConfig,
  setLocalAnalyticsConfig,
  setEditingWidget,
  setIsWidgetModalOpen,
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

    try {
      // Lê o layout_config atual via API route (server-side autenticado)
      const getRes = await fetch(`/api/runtime/analytics-config?viewId=${encodeURIComponent(viewId)}`)
      if (!getRes.ok) throw new Error('Erro ao buscar configuração da view')
      const { layout_config } = await getRes.json()

      const updatedLayoutConfig = { ...layout_config, analytics_config: newConfig }

      // Auto-Discovery: Atualiza tables_config baseado nos widgets do BI para garantir carregamento correto
      const widgetModels = (newWidgets || []).map((w: any) => w.model_id)
      const joinModels = (layout_config?.joins || []).flatMap((j: any) => {
        const fromModel = project.models?.find((m: any) => m.db_table_name === j.from)
        const toModel = project.models?.find((m: any) => m.db_table_name === j.to)
        return [fromModel?.id, toModel?.id].filter(Boolean)
      })
      const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean)

      // Persiste via API route (server-side autenticado)
      const patchRes = await fetch('/api/runtime/analytics-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewId,
          layoutConfig: updatedLayoutConfig,
          tablesConfig: allInvolved
        })
      })

      if (!patchRes.ok) {
        const err = await patchRes.json()
        throw new Error(err.error || 'Erro ao salvar dashboard')
      }

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
      const getRes = await fetch(`/api/runtime/analytics-config?viewId=${encodeURIComponent(viewId)}`)
      if (!getRes.ok) throw new Error('Erro ao buscar configuração da view')
      const { layout_config } = await getRes.json()

      const updatedLayoutConfig = { ...layout_config, analytics_config: newConfig }

      const patchRes = await fetch('/api/runtime/analytics-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewId, layoutConfig: updatedLayoutConfig })
      })

      if (!patchRes.ok) {
        const err = await patchRes.json()
        throw new Error(err.error || 'Erro ao salvar layout')
      }

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
      const getRes = await fetch(`/api/runtime/analytics-config?viewId=${encodeURIComponent(viewId)}`)
      if (!getRes.ok) throw new Error('Erro ao buscar configuração da view')
      const { layout_config } = await getRes.json()

      const updatedLayoutConfig = { ...layout_config, analytics_config: newConfig }
      
      const widgetModels = (newWidgets || []).map((w: any) => w.model_id)
      const joinModels = (updatedLayoutConfig.joins || []).flatMap((j: any) => {
        const fromModel = project.models?.find((m: any) => m.db_table_name === j.from)
        const toModel = project.models?.find((m: any) => m.db_table_name === j.to)
        return [fromModel?.id, toModel?.id].filter(Boolean)
      })
      const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean)

      const patchRes = await fetch('/api/runtime/analytics-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewId,
          layoutConfig: updatedLayoutConfig,
          tablesConfig: allInvolved
        })
      })

      if (!patchRes.ok) {
        const err = await patchRes.json()
        throw new Error(err.error || 'Erro ao remover indicador')
      }

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
