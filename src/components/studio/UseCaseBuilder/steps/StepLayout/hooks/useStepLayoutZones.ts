import { useState, useRef, useEffect, useMemo } from 'react'

export function useStepLayoutZones(config: any, models: any[], relations: any[]) {
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({
    masterDetail: true,
    joins: true,
    zone01: true,
    zone02: true,
    zone03: true
  })
  const toggleZone = (zone: string) => setExpandedZones(prev => ({ ...prev, [zone]: !prev[zone] }))

  const [hiddenDetails, setHiddenDetails] = useState<Set<string>>(new Set())
  const [retractedModels, setRetractedModels] = useState<Set<string>>(new Set())
  const hasInitializedRetractedRef = useRef(false)

  useEffect(() => {
    if (models.length > 0 && !hasInitializedRetractedRef.current) {
      const rootId = config.layout_config?.master_model_id || config.selected_models?.[0]
      const newRetracted = new Set<string>()
      models.forEach((m: any) => {
        if (m.id !== rootId) {
          newRetracted.add(m.id)
        }
      })
      setRetractedModels(newRetracted)
      hasInitializedRetractedRef.current = true
    }
  }, [models, config.layout_config])

  const formTree = useMemo(() => {
    if (config.logic_type === 'analytics') return models

    const rootId = config.layout_config.master_model_id || config.selected_models[0]
    const rootModel = models.find((m: any) => m.id === rootId)
    if (!rootModel) return models.filter((m: any) => config.selected_models.includes(m.id))

    const maxDepth = config.layout_config?.max_relation_depth || 2

    const buildTree = (modelId: string, depth: number, visited: Set<string>): any[] => {
      if (depth >= maxDepth + 1) return []

      const childRelations = relations.filter((r: any) => r.to_model_id === modelId && !visited.has(r.from_model_id))

      return childRelations.map((r: any) => {
        const childModel = models.find((m: any) => m.id === r.from_model_id)
        if (!childModel) return null

        const newVisited = new Set(visited)
        newVisited.add(r.from_model_id)

        return {
          ...childModel,
          children: buildTree(childModel.id, depth + 1, newVisited)
        }
      }).filter(Boolean)
    }

    return [{
      ...rootModel,
      children: buildTree(rootId, 1, new Set([rootId]))
    }]
  }, [config, models, relations])

  return {
    expandedZones, toggleZone,
    hiddenDetails, setHiddenDetails,
    retractedModels, setRetractedModels,
    formTree
  }
}
