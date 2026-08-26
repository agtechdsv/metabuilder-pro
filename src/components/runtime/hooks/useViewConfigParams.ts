import { useMemo } from 'react'

export interface UseViewConfigParamsProps {
  displayFields: any[]
  filterFields: any[]
  formFields: any[]
  masterModelId?: string
  projectRelations?: any[]
}

export function useViewConfigParams({
  displayFields,
  filterFields,
  formFields,
  masterModelId,
  projectRelations
}: UseViewConfigParamsProps) {
  // Garante que todas as listas de campos sejam únicas por ID
  const cleanDisplayFields = useMemo(() => {
    const seen = new Set()
    return displayFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [displayFields])

  const cleanFilterFields = useMemo(() => {
    const seen = new Set()
    return filterFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [filterFields])

  const cleanFormFields = useMemo(() => {
    const seen = new Set()
    const filtered = formFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
    
    // Se a lista de campos do formulário estiver vazia (como no Kanban sem Zona 3
    // ou no modo Fallback/Model direto), caímos de volta para os campos de exibição (grid/list)
    // para garantir que a janela modal/drawer exiba os campos e funcione corretamente.
    if (filtered.length === 0) {
      return cleanDisplayFields.map(f => ({
        ...f,
        zone: 3
      }))
    }
    return filtered
  }, [formFields, cleanDisplayFields])

  const detailFields = useMemo(() => 
    cleanFormFields.filter(f => f.model_id && String(f.model_id) !== String(masterModelId)),
  [cleanFormFields, masterModelId])

  const activeRelations = useMemo(() => {
    if (!projectRelations) return []
    const activeModelIds = new Set<string>()
    if (masterModelId) activeModelIds.add(String(masterModelId))
    cleanFormFields.forEach(f => {
      if (f.model_id) activeModelIds.add(String(f.model_id))
    })
    return projectRelations.filter(r => activeModelIds.has(String(r.detail_model_id)))
  }, [projectRelations, cleanFormFields, masterModelId])

  return {
    cleanDisplayFields,
    cleanFilterFields,
    cleanFormFields,
    detailFields,
    activeRelations
  }
}
