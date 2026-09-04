import { AppAST } from '../ast'

export function generateBaseFiles(ast: AppAST, files: Map<string, string>) {
  // package.json
  files.set('package.json', JSON.stringify({
    name: ast.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    version: "1.0.0",
    private: true,
    scripts: {
      "dev": "next dev",
      "build": "next build",
      "start": "next start"
    },
    dependencies: {
      "next": "^15.0.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^0.511.0",
      "clsx": "^2.1.1",
      "tailwind-merge": "^2.3.0",
      "framer-motion": "^12.0.0",
      "recharts": "^3.8.1",
      "@dnd-kit/core": "^6.3.1",
      "@dnd-kit/sortable": "^10.0.0",
      "@dnd-kit/utilities": "^3.2.2",
      "react-hook-form": "^7.54.0",
      "@hookform/resolvers": "^3.9.0",
      "zod": "^3.23.0",
      "@radix-ui/react-label": "^2.1.0",
      "@radix-ui/react-slot": "^1.1.0",
      "@radix-ui/react-tabs": "^1.1.0",
      ...(ast.authConfig?.hashFormat === 'bcrypt' ? { "bcryptjs": "^2.4.3" } : {}),
      ...(ast.dbStack === 'supabase'
          ? { "@supabase/ssr": "^0.5.0", "@supabase/supabase-js": "^2.45.0" }
          : ast.dbStack === 'oracle'
            ? { "oracledb": "^6.5.0" }
            : ast.dbStack === 'mysql'
              ? { "mysql2": "^3.11.0" }
              : ast.dbStack === 'sqlserver'
                ? { "mssql": "^11.0.0" }
                : { "pg": "^8.13.0" })
    },
    devDependencies: {
      "typescript": "^5.6.0",
      "@types/node": "^22",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "tailwindcss": "^3.4.0",
      "postcss": "^8.4.0",
      "autoprefixer": "^10.4.20",
      ...(ast.authConfig?.hashFormat === 'bcrypt' ? { "@types/bcryptjs": "^2.4.6" } : {})
    }
  }, null, 2))

  // .env.local
  if (ast.dbStack === 'supabase') {
    files.set('.env.local', `NEXT_PUBLIC_SUPABASE_URL="${ast.supabaseUrl || ''}"\nNEXT_PUBLIC_SUPABASE_ANON_KEY="${ast.supabaseAnonKey || ''}"`)
  } else if (ast.dbStack === 'oracle') {
    files.set('.env.local', `DB_CONNECTION_STRING="${ast.dbConnectionString || 'localhost:1521/XEPDB1'}"\nDB_USER="admin"\nDB_PASSWORD="password"`)
  } else if (ast.dbStack === 'mysql') {
    files.set('.env.local', `DATABASE_URL="${ast.dbConnectionString || 'mysql://user:password@localhost:3306/db_name'}"`)
  } else if (ast.dbStack === 'sqlserver') {
    files.set('.env.local', `DATABASE_URL="${ast.dbConnectionString || 'Server=localhost,1433;Database=db_name;User Id=user;Password=password;Encrypt=true'}"`)
  } else {
    files.set('.env.local', `DATABASE_URL="${ast.dbConnectionString || 'postgres://user:pass@localhost:5432/db'}"`)
  }

  // .gitignore
  files.set('.gitignore', `# dependencies
/node_modules
/.pnp
.pnp.js

# next.js
/.next/
/out/

# misc
.DS_Store

# local env files
.env*.local
.env
`)

  // .npmrc — acelera o npm install, previne backtracking de peer deps e pula auditoria de rede
  files.set('.npmrc', `legacy-peer-deps=true\nprefer-offline=true\naudit=false\nfund=false\n`)

  // tsconfig.json — essencial para o alias @/ funcionar
  files.set('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] }
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"]
  }, null, 2))

  // next.config.js (Next.js 14 não suporta .ts aqui)
  files.set('next.config.js', `/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
`)

  // postcss.config.js
  files.set('postcss.config.js', `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`)


  // tailwind.config.ts
  files.set('tailwind.config.ts', `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
export default config;
`)

  // globals.css â€” idÃªntico ao Runtime Web
  files.set('app/globals.css', `@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

body {
  background: #f8fafc; /* slate-50 */
  color: #0f172a; /* slate-900 */
  min-height: 100vh;
  font-family: var(--font-inter, ui-sans-serif, system-ui, sans-serif);
}

.dark body {
  background: #050505;
  color: #fafafa;
}

/* Custom scrollbar â€” igual ao Runtime */
.custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 9999px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.6); }

a { text-decoration: none; color: inherit; }
`)

  // Root Layout — apenas html/body/globals, SEM sidebar
  files.set('app/layout.tsx', `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import { TopProgressBar } from '@/components/TopProgressBar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${ast.projectName}',
  description: 'Generated by MetaBuilder PRO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: \`
              (function() {
                try {
                  var saved = localStorage.getItem('mb_theme');
                  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            \`,
          }}
        />
      </head>
      <body className={inter.className}>
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
`)

  // Componente cliente para os controles do header
  files.set('app/components/HeaderControls.tsx', `'use client'

import { useState, useEffect } from 'react'

export function HeaderControls() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)
  const [clientUser, setClientUser] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'dark' : 'light')
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark')
      try { localStorage.setItem('mb_theme', 'dark') } catch (e) {}
    } else {
      document.documentElement.classList.remove('dark')
      try { localStorage.setItem('mb_theme', 'light') } catch (e) {}
    }
  }

  useEffect(() => {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.trim().startsWith('mb_user='))
    if (cookieValue) {
      try {
        const payload = cookieValue.substring('mb_user='.length)
        const userData = JSON.parse(decodeURIComponent(payload))
        setClientUser(userData)
      } catch (e) {
        document.cookie = 'mb_user=; Max-Age=0; path=/;'
      }
    }
  }, [])

  const displayName = clientUser?.name || clientUser?.email || 'Usuário'
  const displayEmail = clientUser?.email || 'Sair do Sistema'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-3 md:gap-4 relative">
      <div className="flex items-center gap-2 pr-2 border-r border-neutral-200 dark:border-neutral-800">
        {/* Botão de Tema */}
        <button 
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 dark:text-[#71717a] hover:text-slate-800 dark:hover:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-[#27272a] transition-all"
          title="Alternar Tema"
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>

      {/* Avatar e Dropdown */}
      <div 
        className="relative group"
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
      >
        <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-black text-white hover:scale-105 active:scale-95 transition-all shadow-sm">
          {avatarLetter}
        </button>
        
        {menuOpen && (
          <div className="absolute right-0 top-full pt-2 z-50">
            <div className="w-56 rounded-xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-slate-200 dark:border-[#27272a] bg-slate-50/50 dark:bg-black/20">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 truncate mt-0.5">{displayEmail}</p>
              </div>
              <div className="p-1.5">
                <a href="/api/logout" className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sair do Sistema
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
`)

  // (auth)/layout.tsx â€” sem sidebar, com top header (para /login)
  files.set('app/(auth)/layout.tsx', `import { HeaderControls } from '@/app/components/HeaderControls'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex flex-col font-sans transition-colors duration-300">
      <header className="h-[60px] flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-20 border-b border-slate-200 dark:border-[#27272a]/30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-slate-100 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] flex items-center justify-center transition-colors duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-[13px] tracking-wide uppercase transition-colors duration-300">${ast.projectName}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <HeaderControls />
        </div>
      </header>
      {children}
    </div>
  )
}
`)

  // ── DynamicIcon Component ──
  files.set('app/components/DynamicIcon.tsx', `'use client'

import React from 'react'
import * as LucideIcons from 'lucide-react'
import { LucideProps } from 'lucide-react'

interface DynamicIconProps extends LucideProps {
  icon?: any
  className?: string
  size?: number
}

export function DynamicIcon({ icon, className, size = 20, ...props }: DynamicIconProps) {
  if (!icon) return <LucideIcons.Layout className={className} size={size} {...props} />

  if (typeof icon !== 'string') {
    return <>{icon}</>
  }

  if (icon.trim().startsWith('<svg')) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: icon }}
        style={{ width: size, height: size }}
      />
    )
  }

  const cleanName = icon
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m: any, c: string) => c.toUpperCase())
    .replace(/^[a-z]/, (m: string) => m.toUpperCase())

  const IconComponent = (LucideIcons as any)[cleanName] || (LucideIcons as any)[icon] || LucideIcons.Layout
  return <IconComponent className={className} size={size} {...props} />
}
export default DynamicIcon
`)

  // ── Sidebar fiel ao DynamicSidebar.tsx do Runtime ──
  const navItems = ast.navigation.length > 0 ? ast.navigation : ast.routes.map(r => ({
    id: r.viewSlug,
    label: r.title,
    icon: r.icon || 'Layout',
    type: 'view',
    target: r.viewSlug,
  }))
  const navItemsJson = JSON.stringify(navItems, null, 2)
  const projectIcon = ast.projectIcon || 'Layers'

  files.set('app/components/AppSidebar.tsx', `'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'

interface NavItem {
  id: string
  label: string
  icon?: string
  type: 'view' | 'folder' | 'link'
  target?: string
  children?: NavItem[]
}

interface AppSidebarProps {
  projectName: string
  projectSlug: string
  navItems: NavItem[]
  isCollapsed: boolean
  setIsCollapsed: (v: boolean) => void
}

export function AppSidebar({ projectName, projectSlug, navItems, isCollapsed, setIsCollapsed }: AppSidebarProps) {
  const pathname = usePathname()
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const [clientUser, setClientUser] = useState<any>(null)

  useEffect(() => {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.trim().startsWith('mb_user='))
    if (cookieValue) {
      try {
        const payload = cookieValue.substring('mb_user='.length)
        const userData = JSON.parse(decodeURIComponent(payload))
        setClientUser(userData)
      } catch (e) {
        document.cookie = 'mb_user=; Max-Age=0; path=/;'
      }
    }
  }, [])

  const displayName = clientUser?.name || clientUser?.email || 'Usuário'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  const isActive = (item: NavItem) => {
    if (item.type === 'view') {
      const raw = item.target || item.id || ''
      const target = raw.startsWith('/') ? raw.slice(1) : raw
      return pathname === \`/\${target}\` ||
             pathname?.startsWith(\`/\${target}/\`) ||
             pathname === \`/\${projectSlug}/\${target}\` ||
             pathname?.startsWith(\`/\${projectSlug}/\${target}/\`)
    }
    return false
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item)
    const raw = item.target || item.id || ''
    const target = raw.startsWith('/') ? raw.slice(1) : raw
    const href = item.type === 'view' ? \`/\${target}\` : (item.target || '#')

    if (item.type === 'folder') {
      const expanded = expandedFolders.includes(item.id)
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => toggleFolder(item.id)}
            className={\`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative
              hover:bg-indigo-500/10 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400
              \${isCollapsed ? 'justify-center px-0' : ''}\`}
          >
            <DynamicIcon icon={item.icon || 'Layout'} size={isCollapsed ? 24 : 20} />
            {!isCollapsed && (
              <span className="flex-1 flex items-center justify-between">
                <span className="text-sm font-bold truncate">{item.label}</span>
                <ChevronRight className={\`w-4 h-4 transition-transform duration-300 \${expanded ? 'rotate-90' : ''}\`} />
              </span>
            )}
          </button>
          {!isCollapsed && expanded && item.children && (
            <div className="ml-4 pl-4 border-l border-neutral-200 dark:border-neutral-800 space-y-1">
              {item.children.map(child => renderItem(child))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.id}
        href={href}
        target={item.type === 'link' ? '_blank' : undefined}
        className={\`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative
          \${active
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
            : 'hover:bg-indigo-500/10 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400'}
          \${isCollapsed ? 'justify-center px-0' : ''}\`}
      >
        <DynamicIcon icon={item.icon || 'Layout'} size={isCollapsed ? 24 : 20} />
        {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
        {active && !isCollapsed && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
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
    <aside
      style={{ width: isCollapsed ? 80 : 288, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)' }}
      className={\`sticky top-0 h-screen bg-white/80 dark:bg-black/40 backdrop-blur-xl border-r border-neutral-200/50 dark:border-white/5 z-[100] flex flex-col shrink-0 \${isCollapsed ? 'overflow-visible' : 'overflow-hidden'}\`}
    >
      <div className="h-16 flex items-center px-6 border-b border-neutral-200/50 dark:border-white/5 shrink-0">
        <Link href="/" className="flex items-center gap-3 group relative">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 group-hover:scale-110 transition-transform">
            <DynamicIcon icon="${projectIcon}" size={18} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-none truncate">{projectName}</span>
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-indigo-500 opacity-70 mt-0.5">MetaBuilder PRO</span>
            </div>
          )}
        </Link>
      </div>

      <nav className={\`flex-1 px-4 py-6 space-y-2 custom-scrollbar \${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}\`}>
        {navItems.map(item => renderItem(item))}
      </nav>

      <div className="p-4 border-t border-neutral-200/50 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className={\`flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 shadow-sm \${isCollapsed ? 'justify-center p-2' : ''}\`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-black text-white shrink-0">{avatarLetter}</div>
          {!isCollapsed && (
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">{displayName}</span>
              <a href="/api/logout" className="text-[9px] text-neutral-400 hover:text-red-500 text-left transition-colors truncate">Sair do Sistema</a>
            </div>
          )}
          {!isCollapsed && (
            <a href="/api/logout" title="Sair" className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </aside>
  )
}
`)

  // Protected Layout — usa AppSidebar + Header idêntico ao Runtime
  files.set('app/(protected)/layout.tsx', `'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, Home, ChevronRight } from 'lucide-react'
import { AppSidebar } from '@/app/components/AppSidebar'
import { HeaderControls } from '@/app/components/HeaderControls'
import { DynamicIcon } from '@/app/components/DynamicIcon'

const NAV_ITEMS = ${navItemsJson}
const PROJECT_SLUG = '${ast.projectSlug}'
const PROJECT_NAME = '${ast.projectName}'

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isEmbedded = searchParams?.get('embedded') === 'true'

  if (isEmbedded) {
    return (
      <div className="flex-1 min-h-screen bg-transparent">
        {children}
      </div>
    )
  }

  const segments = (pathname || '').split('/').filter(Boolean)
  const slugSegment = segments[0] === PROJECT_SLUG ? segments[1] : segments[0]
  const navItem = NAV_ITEMS.find((n: any) => {
    const raw = String(n.target || n.id || '')
    const t = raw.startsWith('/') ? raw.slice(1) : raw
    return t === slugSegment || n.label?.toLowerCase() === slugSegment?.toLowerCase()
  })

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#050505]">
      <AppSidebar
        projectName={PROJECT_NAME}
        projectSlug={PROJECT_SLUG}
        navItems={NAV_ITEMS}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-neutral-200/50 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl sticky top-0 z-[90] flex items-center px-6 gap-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-all hover:scale-105 active:scale-95"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

          <nav className="flex-1 flex items-center gap-2 text-[10px] font-bold capitalize tracking-widest text-neutral-400 overflow-hidden">
            <Link href="/" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 shrink-0">
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            {navItem && (
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-3 h-3 opacity-30 shrink-0" />
                <div className="flex items-center gap-1.5 text-neutral-900 dark:text-white truncate">
                  <DynamicIcon icon={navItem.icon || 'Layout'} size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">{navItem.label}</span>
                </div>
              </div>
            )}
          </nav>

          <HeaderControls />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1 min-h-screen bg-transparent">{children}</div>}>
      <ProtectedLayoutContent>
        {children}
      </ProtectedLayoutContent>
    </Suspense>
  )
}
`)

  // Dashboard page — fiel à DynamicDashboard.tsx da Web Produção
  const navCards = (ast.navigation.length > 0 ? ast.navigation : ast.routes.map(r => ({
    id: r.viewSlug,
    label: r.title,
    icon: r.icon || 'Layout',
    type: 'view',
    target: r.viewSlug,
  }))).filter((n: any) => n.type === 'view' || n.type === 'folder').map((n: any) => `
        <Link
          key="${n.id}"
          href="/${String(n.target || n.id).startsWith('/') ? String(n.target || n.id).slice(1) : String(n.target || n.id)}"
          className="group relative p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] hover:border-indigo-500 transition-all shadow-sm hover:shadow-2xl dark:shadow-none overflow-hidden flex flex-col justify-between min-h-[220px]"
        >
          {/* Glow Effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-all duration-500" />
          
          <div className="relative z-10 flex flex-col h-full gap-6">
            <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm">
              <DynamicIcon icon="${n.icon || 'Layout'}" size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                ${n.label}
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-widest">
                CASO DE USO
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-indigo-500 transition-colors">
                ACESSAR
              </span>
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>`).join('\n')

  files.set('app/(protected)/page.tsx', `import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'

export const metadata: Metadata = { title: 'Dashboard - ${ast.projectName}' }

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header idêntico ao RuntimeHeader da Web Produção */}
      <div className="px-6 sm:px-10 py-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
            <DynamicIcon icon="${ast.projectIcon || 'Layers'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${ast.projectName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                ${ast.projectDescription || 'CRM COMPLETO'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Cards ocupando o espaço horizontal com respiro confortável */}
      <div className="px-6 sm:px-10 py-2 space-y-6 animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
${navCards}
        </div>
      </div>
    </div>
  )
}
`)
}
