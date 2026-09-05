export interface Guest {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  access_level: 'global' | 'granular'
  workspaces: { workspace_id: string; can_create?: boolean; can_edit?: boolean; can_delete?: boolean }[]
  projects: { workspace_id: string; user_id: string; project_id: string; can_create?: boolean; can_edit?: boolean; can_deactivate?: boolean; can_delete?: boolean }[]
}

export interface TeamData {
  guests: Guest[]
  workspaces: { id: string; name: string; slug: string }[]
  projects: { id: string; name: string; slug: string; workspace_id: string }[]
  allowedGuests: number
  usedGuests: number
}
