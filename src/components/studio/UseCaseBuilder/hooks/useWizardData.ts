'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Model, Enumeration, Relation, UseCase, BpmWorkflow } from '../types'

interface UseWizardDataParams {
  projectSlug: string | string[]
  workspaceSlug?: string | string[]
}

interface UseWizardDataReturn {
  models: Model[]
  enumerations: Enumeration[]
  relations: Relation[]
  useCases: UseCase[]
  bpmWorkflows: BpmWorkflow[]
  isLoading: boolean
  isDownloadsActive: boolean
  currentProjectId: string | undefined
  currentWorkspaceId: string | undefined
  virtualFields: any[]
  byocComponents: any[]
}

/**
 * Fetches all data needed by the wizard from Supabase in a single coordinated
 * load sequence:
 *  1. Project (id, workspace_id, theme_config)
 *  2. Models + Fields
 *  3. Project Enumerations
 *  4. Relations
 *  5. UI Views (for use-case selectors)
 *  6. BPM Workflows
 */
export function useWizardData({ projectSlug, workspaceSlug }: UseWizardDataParams): UseWizardDataReturn {
  const supabase = createClient()

  const [models, setModels] = useState<Model[]>([])
  const [enumerations, setEnumerations] = useState<Enumeration[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [useCases, setUseCases] = useState<UseCase[]>([])
  const [bpmWorkflows, setBpmWorkflows] = useState<BpmWorkflow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloadsActive, setIsDownloadsActive] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string>()
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>()
  const [virtualFields, setVirtualFields] = useState<any[]>([])
  const [byocComponents, setByocComponents] = useState<any[]>([])

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        // 1. Fetch the current project by slug (and workspace_id if available)
        let query = supabase
          .from('projects')
          .select('id, workspace_id, theme_config')
          .eq('slug', projectSlug)

        if (workspaceSlug) {
          const { data: ws } = await supabase
            .from('workspaces')
            .select('id')
            .eq('slug', workspaceSlug)
            .maybeSingle()

          if (ws?.id) {
            query = query.eq('workspace_id', ws.id)
          }
        }

        const { data: project } = await query.maybeSingle()

        if (!project || !isMounted) return

        setIsDownloadsActive(project.theme_config?.enable_downloads !== false)
        setCurrentProjectId(project.id)
        setCurrentWorkspaceId(project.workspace_id)

        // Fetch virtual_fields (calculated fields)
        const { data: projectFull } = await supabase
          .from('projects')
          .select('virtual_fields')
          .eq('id', project.id)
          .maybeSingle()

        if (projectFull?.virtual_fields && isMounted) {
          const vf = typeof projectFull.virtual_fields === 'string'
            ? JSON.parse(projectFull.virtual_fields)
            : projectFull.virtual_fields
          if (Array.isArray(vf)) setVirtualFields(vf)
        }

        // 2. Fetch models for this project (with their fields)
        const { data: modelsData } = await supabase
          .from('models')
          .select('*, fields(*)')
          .eq('project_id', project.id)
          .order('db_table_name')

        if (modelsData && isMounted) setModels(modelsData as Model[])

        // 2.5. Fetch project enumerations
        const { data: enumsData } = await supabase
          .from('project_enumerations')
          .select('*')
          .eq('project_id', project.id)
          .order('name')

        if (enumsData && isMounted) setEnumerations(enumsData as Enumeration[])

        // 3. Fetch relations for this project
        const { data: relsData } = await supabase
          .from('relations')
          .select('*')
          .eq('project_id', project.id)

        if (relsData && isMounted) setRelations(relsData as Relation[])

        // 4. Fetch UI views (use cases) for reference selectors
        const { data: viewsData } = await supabase
          .from('ui_views')
          .select('name, slug, logic_type, draft_config, model_id')
          .eq('project_id', project.id)
          .order('name')

        if (viewsData && isMounted) setUseCases(viewsData as UseCase[])

        // 5. Fetch BPM Workflows for automations tab
        const { data: bpmData } = await supabase
          .from('bpm_workflows')
          .select('id, name')
          .eq('project_id', project.id)
          .order('name')

        if (bpmData && isMounted) setBpmWorkflows(bpmData as BpmWorkflow[])

        // 6. Fetch BYOC Components
        const { data: byocData } = await supabase
          .from('ui_custom_components')
          .select('id, name, description, compiled_code')
          .eq('project_id', project.id)
          .order('name')

        if (byocData && isMounted) setByocComponents(byocData)
      } catch (err) {
        console.error('[useWizardData] Error loading wizard data:', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [projectSlug, workspaceSlug])

  return {
    models,
    enumerations,
    relations,
    useCases,
    bpmWorkflows,
    isLoading,
    isDownloadsActive,
    currentProjectId,
    currentWorkspaceId,
    virtualFields,
    byocComponents
  }
}
