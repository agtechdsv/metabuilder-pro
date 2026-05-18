'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Layout, 
  Layers, 
  Box, 
  Settings, 
  LogOut,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicIcon } from './DynamicIcon'

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
  isCollapsed: boolean
  setIsCollapsed: (val: boolean) => void
}



export function DynamicSidebar({ project, workspaceSlug, projectSlug, navigation = [], isCollapsed, setIsCollapsed }: DynamicSidebarProps) {
  const projectIcon = project.icon || 'Box'
  const pathname = usePathname()
  const router = useRouter()
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedFolders(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const navigateToFolder = (id: string) => {
    router.push(`/${workspaceSlug}/${projectSlug}/dashboard/${id}`)
  }

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const isActive = item.type === 'view' 
      ? pathname.includes(`/${workspaceSlug}/${projectSlug}/${item.target}`)
      : pathname.includes(`/dashboard/${item.id}`)
    
    const isFolder = item.type === 'folder'
    const isExpanded = expandedFolders.includes(item.id)

    if (isFolder) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => navigateToFolder(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative",
              isActive 
                ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" 
                : "hover:bg-indigo-500/10 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400",
              isCollapsed && "justify-center px-0"
            )}
          >
            <DynamicIcon 
              icon={item.icon} 
              className={cn("w-5 h-5 shrink-0", isCollapsed && "w-6 h-6 transition-all duration-500")} 
              size={isCollapsed ? 24 : 20}
            />
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex items-center justify-between"
                >
                  <span className="text-sm font-bold truncate">
                    {item.label}
                  </span>
                  
                  <div 
                    onClick={(e) => toggleExpand(e, item.id)}
                    className="p-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-lg transition-all"
                  >
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform duration-300",
                      isExpanded && "rotate-90"
                    )} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-2 bg-neutral-900 text-white text-[10px] font-bold capitalize tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-[1000] shadow-xl translate-x-2 group-hover:translate-x-0">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-neutral-900" />
              </div>
            )}
          </button>
          
          {!isCollapsed && isExpanded && item.children && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="ml-4 pl-4 border-l border-neutral-200 dark:border-neutral-800 space-y-1 overflow-hidden"
            >
              {item.children.map(child => renderMenuItem(child, true))}
            </motion.div>
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
        <DynamicIcon 
          icon={item.icon} 
          className={cn("w-5 h-5 shrink-0", isCollapsed && "w-6 h-6 transition-all duration-500")} 
          size={isCollapsed ? 24 : 20}
        />
        
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-sm font-bold truncate"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        
        {isActive && !isCollapsed && (
          <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
        
        {isCollapsed && (
          <div className="absolute left-full ml-4 px-3 py-2 bg-neutral-900 text-white text-[10px] font-bold capitalize tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-[1000] shadow-xl translate-x-2 group-hover:translate-x-0">
            {item.label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-neutral-900" />
          </div>
        )}
      </Link>
    )
  }

  return (
    <motion.aside 
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "sticky top-0 h-screen bg-white/80 dark:bg-black/40 backdrop-blur-xl border-r border-neutral-200/50 dark:border-white/5 z-[100] flex flex-col shrink-0 transition-all",
        isCollapsed ? "overflow-visible" : "overflow-hidden"
      )}
    >
      {/* Sidebar Header - Aligned with Global Header */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-200/50 dark:border-white/5 shrink-0">
        <Link 
          href={`/${workspaceSlug}/${projectSlug}/dashboard`}
          className="flex items-center gap-3 group relative"
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 group-hover:scale-110 transition-transform">
            <DynamicIcon icon={projectIcon} size={18} />
          </div>
          
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-3 py-2 bg-neutral-900 text-white text-[10px] font-bold capitalize tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-[1000] shadow-xl translate-x-2 group-hover:translate-x-0">
              Dashboard
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-neutral-900" />
            </div>
          )}

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col truncate"
              >
                 <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-none truncate">
                   {project.name}
                 </span>
                 <span className="text-[7px] font-black uppercase tracking-[0.2em] text-indigo-500 opacity-70 mt-0.5">
                   MetaBuilder PRO
                 </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 px-4 py-6 space-y-2 custom-scrollbar",
        isCollapsed ? "overflow-visible" : "overflow-y-auto"
      )}>
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
           
           <AnimatePresence>
             {!isCollapsed && (
               <motion.div 
                 initial={{ opacity: 0, width: 0 }}
                 animate={{ opacity: 1, width: 'auto' }}
                 exit={{ opacity: 0, width: 0 }}
                 className="flex flex-col flex-1 min-w-0 overflow-hidden"
               >
                 <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">Usuário Cliente</span>
                 <span className="text-[9px] text-neutral-400 truncate">Sair do Sistema</span>
               </motion.div>
             )}
           </AnimatePresence>

           {!isCollapsed && (
             <button className="p-1.5 text-neutral-400 hover:text-red-500">
               <LogOut className="w-4 h-4" />
             </button>
           )}
        </div>
      </div>
    </motion.aside>
  )
}
