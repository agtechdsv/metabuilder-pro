'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ChevronDown, Briefcase, Folder, Boxes, Loader2, Check } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  slug: string
}

interface Project {
  id: string
  workspace_id: string
  name: string
  slug: string
}

export function WorkspaceProjectCombo({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fetchContext = async () => {
      const supabase = createClient()

      const { data: wData } = await supabase.from('workspaces').select('id, name, slug').order('name')
      if (wData) setWorkspaces(wData)

      const { data: pData } = await supabase.from('projects').select('id, workspace_id, name, slug').order('name')
      if (pData) setProjects(pData)

      setIsLoading(false)
    }
    fetchContext()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Extrair o workspace e o projeto atual do pathname
  // Exemplo de pathname: /admin/meu-workspace/meu-projeto/studio...
  const parts = pathname?.split('/').filter(Boolean) || []
  let currentWorkspaceSlug = null
  let currentProjectSlug = null

  if (parts[0] === 'admin' && parts.length > 1) {
    currentWorkspaceSlug = parts[1]
    if (parts.length > 2 && parts[2] !== 'settings' && parts[2] !== 'platform') {
      currentProjectSlug = parts[2]
    }
  } else if (parts[0] !== 'admin' && parts[0] !== 'features' && parts.length >= 1) {
    // Frontend normal: /[workspace_slug]/[project_slug]
    currentWorkspaceSlug = parts[0]
    if (parts.length > 1) currentProjectSlug = parts[1]
  }

  const currentWorkspace = workspaces.find(w => w.slug === currentWorkspaceSlug)
  const currentProject = projects.find(p => p.slug === currentProjectSlug && p.workspace_id === currentWorkspace?.id)

  const handleToggle = () => setIsOpen(!isOpen)

  if (!user) return null

  return (
    <div className="relative z-50 flex items-center justify-center flex-1 mx-8" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 group hover:shadow-md",
          isOpen
            ? "bg-indigo-50/80 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800/60 shadow-inner"
            : "bg-white/50 border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900/50 dark:border-neutral-800 dark:hover:bg-neutral-800/70"
        )}
      >
        <div className="flex flex-col items-start mr-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-0.5">
            <Briefcase className="w-3 h-3" />
            {currentWorkspace?.name || 'Home'}
          </div>
          <div className="flex items-center gap-1.5 text-sm font-black text-neutral-800 dark:text-neutral-200 leading-none">
            <Boxes className="w-3.5 h-3.5 text-indigo-500" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent truncate max-w-[300px]">
              {currentProject?.name || 'Navegue para...'}
            </span>
          </div>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-neutral-400 transition-transform duration-300 ml-1",
          isOpen && "rotate-180 text-indigo-500"
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[480px] max-h-[400px] overflow-y-auto bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="p-4 text-xs text-center text-neutral-500">Nenhum workspace encontrado.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {workspaces.map(ws => {
                const wsProjects = projects.filter(p => p.workspace_id === ws.id)
                const isWsActive = currentWorkspace?.id === ws.id

                return (
                  <div key={ws.id} className="flex flex-col gap-1">
                    <Link
                      href={`/admin/${ws.slug}`}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors group",
                        isWsActive
                          ? "bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Briefcase className={cn("w-3.5 h-3.5", isWsActive ? "text-indigo-500" : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300")} />
                        {ws.name}
                      </div>
                    </Link>

                    {wsProjects.length > 0 ? (
                      <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l border-neutral-200 dark:border-neutral-800/80 mt-0.5">
                        {wsProjects.map(proj => {
                          const isProjActive = currentProject?.id === proj.id
                          return (
                            <Link
                              key={proj.id}
                              href={`/admin/${ws.slug}/${proj.slug}/studio`}
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all group/item relative",
                                isProjActive
                                  ? "bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold"
                                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                              )}
                            >
                              {isProjActive && (
                                <span className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border-[2px] border-white dark:border-[#0a0a0a] bg-indigo-500 shadow-sm" />
                              )}
                              <div className="flex items-center gap-2">
                                <Boxes className={cn("w-3.5 h-3.5 transition-colors", isProjActive ? "text-indigo-500" : "text-neutral-300 dark:text-neutral-600 group-hover/item:text-indigo-400")} />
                                {proj.name}
                              </div>
                              {isProjActive && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="pl-8 py-1.5 text-[10px] font-medium text-neutral-400 italic">
                        Sem projetos
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
