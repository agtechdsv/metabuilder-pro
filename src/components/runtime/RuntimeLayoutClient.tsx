'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { DynamicSidebar } from './DynamicSidebar'
import { RuntimeGlobalHeader } from './RuntimeGlobalHeader'
import { DynamicIcon } from './DynamicIcon'

interface RuntimeLayoutClientProps {
  children: React.ReactNode
  project: any
  workspaceSlug: string
  projectSlug: string
  navigation: any[]
}

export function RuntimeLayoutClient({ 
  children, 
  project, 
  workspaceSlug, 
  projectSlug, 
  navigation 
}: RuntimeLayoutClientProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Atualiza o Título da Aba
    if (project.name) {
      document.title = `${project.name} | MetaBuilder PRO`
    }

    // Tenta atualizar o Favicon
    const projectIcon = project.icon || 'Box'
    
    const updateFavicon = (svgContent: string) => {
      try {
        // Desativa icones existentes sem removê-los (para não quebrar o Next.js)
        const links = document.querySelectorAll("link[rel*='icon']")
        links.forEach(link => {
          if (link.getAttribute('rel') !== 'project-favicon') {
            link.setAttribute('rel', 'alternate-icon')
          }
        })

        // Cria ou atualiza o ícone do projeto
        const blob = new Blob([svgContent], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        
        let projectLink = document.getElementById('project-favicon') as HTMLLinkElement
        if (!projectLink) {
          projectLink = document.createElement('link')
          projectLink.id = 'project-favicon'
          projectLink.rel = 'icon'
          projectLink.type = 'image/svg+xml'
          document.head.appendChild(projectLink)
        }
        projectLink.href = url

        let shortcutLink = document.getElementById('project-shortcut-favicon') as HTMLLinkElement
        if (!shortcutLink) {
          shortcutLink = document.createElement('link')
          shortcutLink.id = 'project-shortcut-favicon'
          shortcutLink.rel = 'shortcut icon'
          document.head.appendChild(shortcutLink)
        }
        shortcutLink.href = url

        console.log('Favicon atualizado para o projeto:', project.name)
      } catch (err) {
        console.error('Erro ao atualizar favicon:', err)
      }
    }

    // Se for SVG bruto, NÃO fazemos nada no cliente. 
    // O servidor já enviou isso no generateMetadata do layout.tsx
    if (projectIcon.startsWith('<svg')) {
      return
    } else {
      // Se for ícone da biblioteca, esperamos o renderizador invisível
      const timer = setTimeout(() => {
        if (iconRef.current) {
          const svgElement = iconRef.current.querySelector('svg')
          if (svgElement) {
            updateFavicon(svgElement.outerHTML)
          }
        }
      }, 300) // Aumentado para 300ms para garantir o render
      return () => clearTimeout(timer)
    }
  }, [project.name, project.icon])
  const isLoginPage = pathname?.endsWith('/login')

  if (isLoginPage) {
    return (
      <div className="flex-1 min-h-screen overflow-x-hidden">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#050505] transition-all duration-500 ease-in-out">
      <DynamicSidebar 
        project={project}
        workspaceSlug={workspaceSlug}
        projectSlug={projectSlug}
        navigation={navigation}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden relative">
        <RuntimeGlobalHeader 
          project={project}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          navigation={navigation}
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
        />
        
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Renderizador invisível para captura de Favicon */}
      <div ref={iconRef} className="fixed -top-96 -left-96 opacity-0 pointer-events-none" aria-hidden="true">
        <DynamicIcon icon={project.icon || 'Box'} size={32} />
      </div>
    </div>
  )
}
