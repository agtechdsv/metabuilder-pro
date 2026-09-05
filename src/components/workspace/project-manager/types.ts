export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  is_active: boolean
  workspace_id: string
  models?: { count: number }[]
  can_create?: boolean
  can_edit?: boolean
  can_deactivate?: boolean
  can_delete?: boolean
  theme_config?: any
}

export interface DownloadModalState {
  open: boolean
  phase: 'selecting' | 'downloading' | 'done' | 'error'
  fileName: string
  progress: number
  savedPath: string
  savedDir: string
  projectId?: string
  authConfig?: any
}
