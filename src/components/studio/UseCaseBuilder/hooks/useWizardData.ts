'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Model, Enumeration, Relation, UseCase, BpmWorkflow } from '../types'

interface UseWizardDataParams {
  projectSlug: string | string[]
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
export function useWizardData({ projectSlug }: UseWizardDataParams): UseWizardDataReturn {
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

  useEffect(() => {
    const loadData = async () => {
      // 1. Fetch the current project by slug
      const { data: project } = await supabase
        .from('projects')
        .select('id, workspace_id, theme_config')
        .eq('slug', projectSlug)
        .single()

      if (!project) return

      setIsDownloadsActive(project.theme_config?.enable_downloads !== false)
      setCurrentProjectId(project.id)
      setCurrentWorkspaceId(project.workspace_id)

      // 2. Fetch models for this project (with their fields)
      const { data: modelsData } = await supabase
        .from('models')
        .select('*, fields(*)')
        .eq('project_id', project.id)
        .order('db_table_name')

      if (modelsData) setModels(modelsData as Model[])

      // 2.5. Fetch project enumerations
      const { data: enumsData } = await supabase
        .from('project_enumerations')
        .select('*')
        .eq('project_id', project.id)
        .order('name')

      if (enumsData) setEnumerations(enumsData as Enumeration[])

      // 3. Fetch relations for this project
      const { data: relsData } = await supabase
        .from('relations')
        .select('*')
        .eq('project_id', project.id)

      if (relsData) setRelations(relsData as Relation[])

      // 4. Fetch UI views (use cases) for reference selectors
      const { data: viewsData } = await supabase
        .from('ui_views')
        .select('name, slug, logic_type, draft_config, model_id')
        .eq('project_id', project.id)
        .order('name')

      if (viewsData) {
        // Deduplicate to avoid React key errors
        const unique = viewsData.filter((v, i, a) =>
          a.findIndex(t => t.slug === v.slug) === i
        )
        setUseCases(unique as UseCase[])
      }

      // 5. Fetch BPM Workflows for automations tab
      const { data: bpmData } = await supabase
        .from('bpm_workflows')
        .select('id, name')
        .eq('project_id', project.id)
        .order('name')

      if (bpmData) setBpmWorkflows(bpmData as BpmWorkflow[])

      setIsLoading(false)
    }

    loadData()
  }, [projectSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    models,
    enumerations,
    relations,
    useCases,
    bpmWorkflows,
    isLoading,
    isDownloadsActive,
    currentProjectId,
    currentWorkspaceId
  }
}
