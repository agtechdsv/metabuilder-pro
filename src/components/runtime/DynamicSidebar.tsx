'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Layout, 
  Layers, 
  Box, 
  Settings, 
  Database, 
  Search, 
  Globe,
  Link as LinkIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MenuItem {
  id: string
  label: string
  icon: string
  type: 'view' | 'link' | 'folder'
  target: string
  show_dashboard?: boolean
  children?: MenuItem[]
}

interface DynamicSidebarProps {
  project: any
  workspaceSlug: string
  projectSlug: string
  navigation: MenuItem[]
}

const ICON_MAP: Record<string, any> = {
  Layout,
  Layers,
  Box,
  Settings,
  Database,
  Search,
  Globe,
  Link: LinkIcon
}

export function DynamicSidebar({ project, workspaceSlug, projectSlug, navigation = [] }: DynamicSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
    // Ao clicar na pasta, navega para o dashboard dela
    router.push(`/${workspaceSlug}/${projectSlug}/dashboard/${id}`)
  }

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const Icon = ICON_MAP[item.icon] || Layout
    const isActive = item.type === 'view' 
      ? pathname.includes(`/${workspaceSlug}/${projectSlug}/${item.target}`)
      : pathname.includes(`/dashboard/${item.id}`)
    
    const isFolder = item.type === 'folder'
    const isExpanded = expandedFolders.includes(item.id)

    if (isFolder) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => toggleFolder(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative",
              isActive 
                ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" 
                : "hover:bg-indigo-500/10 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400",
              isCollapsed && "justify-center px-0"
            )}
          >
            <Icon className={cn("w-5 h-5 shrink-0", isCollapsed && "w-6 h-6")} />
            {!isCollapsed && <span className="flex-1 text-sm font-bold text-left truncate">{item.label}</span>}
            
            {/* Tooltip no colapsado */}
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-2 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[1000] shadow-xl">
                {item.label}
              </div>
            )}
          </button>
          
          {!isCollapsed && isExpanded && item.children && (
            <div className="ml-4 pl-4 border-l border-neutral-200 dark:border-neutral-800 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {item.children.map(child => renderMenuItem(child, true))}
            </div>
          )}
        </div>
      )
    }

    const href = item.type === 'view' 
      ? `/${workspaceSlug}/${projectSlug}/${item.target}` 
      : item.target

    return (
      <Link
        key={item.id}
        href={href}
        target={item.type === 'link' ? '_blank' : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative",
          isActive 
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
            : "hover:bg-indigo-500/10 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400",
          isCollapsed && "justify-center px-0"
        )}
      >
        <Icon className={cn("w-5 h-5 shrink-0", isCollapsed && "w-6 h-6")} />
        {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
        
        {isActive && !isCollapsed && (
          <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
        
        {isCollapsed && (
          <div className="absolute left-full ml-4 px-3 py-2 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[1000] shadow-xl">
            {item.label}
          </div>
        )}
      </Link>
    )
  }

  return (
    <aside 
      className={cn(
        "sticky top-0 h-screen bg-white/80 dark:bg-black/40 backdrop-blur-xl border-r border-neutral-200/50 dark:border-white/5 transition-all duration-500 z-[100] flex flex-col shrink-0",
        isCollapsed ? "w-24" : "w-72"
      )}
    >
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
               <span className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-none">
                 {project.name}
               </span>
               <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-500 opacity-70 mt-0.5">
                 MetaBuilder PRO
               </span>
            </div>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-all",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
        {navigation.length > 0 ? (
          navigation.map(item => renderMenuItem(item))
        ) : (
          <div className="py-10 text-center space-y-2 opacity-30">
            <Layers className="w-8 h-8 mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-widest">Sem Menu</p>
          </div>
        )}
      </nav>

      {/* Footer / User */}
      <div className="p-4 border-t border-neutral-200/50 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 shadow-sm",
          isCollapsed && "justify-center p-2"
        )}>
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-black text-white shrink-0">
             U
           </div>
           {!isCollapsed && (
             <div className="flex flex-col flex-1 min-w-0">
               <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">Usuário Cliente</span>
               <span className="text-[9px] text-neutral-400 truncate">Sair do Sistema</span>
             </div>
           )}
           {!isCollapsed && (
             <button className="p-1.5 text-neutral-400 hover:text-red-500">
               <LogOut className="w-4 h-4" />
             </button>
           )}
        </div>
      </div>
    </aside>
  )
}
