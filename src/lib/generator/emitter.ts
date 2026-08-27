import { AppAST, WorkspaceAST } from './ast'
import { generateRoutes } from './layers/routes'
import { generateActions } from './layers/actions'
import { generateComponents } from './layers/components'
import { generatePortalPage, generateWorkspaceLayout, generateWorkspaceGlobalCss, generateProjectLayout } from './layers/portal'

/**
 * emitter.ts
 *
 * Recebe a AST (Árvore Abstrata) e orquestra a geração de todos os arquivos
 * do projeto Next.js em um mapa de string (Memory FS).
 */

export function generateNativeProject(ast: AppAST): Map<string, string> {
  const files = new Map<string, string>()

  // 1. Arquivos Base do Projeto
  generateBaseFiles(ast, files)

  // 2. Geração das Camadas
  generateRoutes(ast, files)
  generateActions(ast, files)
  generateComponents(ast, files)

  // 3. Página de Login
  generateLoginPage(ast, files)

  return files
}

function generateLoginPage(ast: AppAST, files: Map<string, string>) {
  files.set('app/(auth)/login/page.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — ${ast.projectName}',
}

export default function LoginPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#4f46e5]/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-[380px] relative z-10">
        {/* Card */}
        <div className="bg-[#09090b]/80 backdrop-blur-xl border border-[#27272a]/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">Bem-vindo de volta!</h1>
          <p className="text-[#a1a1aa] text-[13px] text-center mb-8 leading-relaxed px-4">Entre com suas credenciais para acessar o portal.</p>

          {/* Biometria */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 border border-[#27272a]/80 text-[#818cf8] rounded-xl py-3 px-4 text-xs font-bold tracking-wide transition-all mb-8 bg-[#18181b]/50 hover:bg-[#27272a]/50 uppercase"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10A10 10 0 0 0 12 2Z"/>
              <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            </svg>
            ENTRAR COM BIOMETRIA
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-[1px] bg-[#27272a]/80"></div>
            <span className="text-[10px] text-[#52525b] uppercase tracking-widest font-semibold">ou</span>
            <div className="flex-1 h-[1px] bg-[#27272a]/80"></div>
          </div>

          {/* Form */}
          <form action="/api/login" method="post" className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="exemplo@empresa.com"
                className="w-full bg-[#18181b] border-none text-[#d4d4d8] placeholder:text-[#52525b] rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">Senha</label>
                <a href="#" className="text-[10px] text-[#4f46e5] hover:text-[#6366f1] transition-colors font-bold uppercase tracking-wide">Esqueci minha senha?</a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Sua senha secreta"
                  className="w-full bg-[#18181b] border-none text-[#d4d4d8] placeholder:text-[#52525b] rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner pr-12"
                />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#4f46e5] hover:bg-[#6366f1] text-white font-bold rounded-xl py-3.5 px-4 text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20 mt-6 uppercase"
            >
              ENTRAR NO SISTEMA
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="/" className="text-[10px] text-[#71717a] hover:text-[#a1a1aa] transition-colors font-bold uppercase tracking-widest">
              &larr; VOLTAR AO PORTAL DO WORKSPACE
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-3">
             <div className="h-[1px] w-12 bg-[#27272a]/50"></div>
             <p className="text-center text-[9px] text-[#52525b] tracking-[0.2em] uppercase font-bold">POWERED BY METABUILDER</p>
             <div className="h-[1px] w-12 bg-[#27272a]/50"></div>
          </div>
        </div>
      </div>
    </main>
  )
}
`)

  // app/api/login/route.ts — define o cookie de sessão
  files.set('app/api/login/route.ts', `import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  // Validação simples — substitua por sua lógica real de auth
  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=credentials', request.url))
  }

  const response = NextResponse.redirect(new URL(redirect, request.url))
  response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  })
  return response
}
`)

  // app/api/logout/route.ts — limpa o cookie de sessão
  files.set('app/api/logout/route.ts', `import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete('mb_session')
  return response
}
`)

  // middleware.ts — intercepta toda requisição e redireciona para /login se não autenticado
  files.set('middleware.ts', `import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const session = request.cookies.get('mb_session')?.value
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
`)
}

function generateBaseFiles(ast: AppAST, files: Map<string, string>) {
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
      "next": "^14.2.0",
      "react": "^18.3.0",
      "react-dom": "^18.3.0",
      "lucide-react": "^0.360.0",
      "clsx": "^2.1.0",
      "tailwind-merge": "^2.2.0",
      "react-hook-form": "^7.51.0",
      "@hookform/resolvers": "^3.3.4",
      "zod": "^3.22.4",
      "@radix-ui/react-label": "^2.0.2",
      "@radix-ui/react-slot": "^1.0.2",
      "@radix-ui/react-tabs": "^1.0.4",
      ...(ast.dbStack === 'supabase' 
          ? { "@supabase/ssr": "^0.3.0", "@supabase/supabase-js": "^2.40.0" }
          : ast.dbStack === 'oracle'
            ? { "oracledb": "^6.5.0" }
            : ast.dbStack === 'mysql'
              ? { "mysql2": "^3.9.0" }
              : ast.dbStack === 'sqlserver'
                ? { "mssql": "^10.0.0" }
                : { "pg": "^8.11.0" })
    },
    devDependencies: {
      "typescript": "^5.0.0",
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      "tailwindcss": "^3.4.0",
      "postcss": "^8.4.0",
      "autoprefixer": "^10.4.19"
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
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
`)

  // globals.css — dark design system
  files.set('app/globals.css', `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
  --card-border: #27272a;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --muted: #71717a;
  --radius: 0.75rem;
}

* { box-sizing: border-box; }

body {
  background: var(--background);
  color: var(--foreground);
  min-height: 100vh;
  font-family: var(--font-inter, ui-sans-serif, system-ui, sans-serif);
}

a { text-decoration: none; color: inherit; }
`)

  // Root Layout — apenas html/body/globals, SEM sidebar
  files.set('app/layout.tsx', `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${ast.projectName}',
  description: 'Generated by MetaBuilder PRO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={inter.className}>
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
  const [langOpen, setLangOpen] = useState(false)
  const [lang, setLang] = useState('PT')
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="flex items-center gap-1.5 bg-[#18181b]/80 border border-[#27272a] rounded-full px-1.5 py-1.5 shadow-sm">
      {/* Botão de Histórico */}
      <button 
        onClick={() => alert('Nenhum histórico de acesso recente.')}
        className="w-7 h-7 flex items-center justify-center rounded-full text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#27272a] transition-all"
        title="Histórico"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
      </button>

      {/* Botão de Tema */}
      <button 
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="w-7 h-7 flex items-center justify-center rounded-full text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#27272a] transition-all"
        title="Alternar Tema"
      >
        {theme === 'dark' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
      </button>

      {/* Seletor de Idioma */}
      <div className="relative">
        <button 
          onClick={() => setLangOpen(!langOpen)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1 text-[11px] font-bold text-[#a1a1aa] hover:text-white transition-all border-l border-[#27272a]/80 ml-0.5"
        >
          {lang === 'PT' ? (
            <span className="w-4 h-4 rounded-full bg-green-500 overflow-hidden flex items-center justify-center relative shadow-inner"><span className="absolute inset-0 bg-yellow-400 rotate-45 scale-75"></span><span className="absolute w-2 h-2 rounded-full bg-blue-600"></span></span>
          ) : (
            <span className="w-4 h-4 rounded-full bg-blue-800 overflow-hidden flex items-center justify-center relative shadow-inner"><span className="absolute inset-0 bg-red-600 w-1 h-4"></span><span className="absolute inset-0 bg-red-600 h-1 w-4 top-1.5"></span></span>
          )}
          {lang}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#71717a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>

        {langOpen && (
          <div className="absolute right-0 top-full mt-2 w-32 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl overflow-hidden py-1 z-50">
            <button onClick={() => { setLang('PT'); setLangOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors text-left">
              <span className="w-4 h-4 rounded-full bg-green-500 overflow-hidden flex items-center justify-center relative"><span className="absolute inset-0 bg-yellow-400 rotate-45 scale-75"></span><span className="absolute w-2 h-2 rounded-full bg-blue-600"></span></span>
              Português
            </button>
            <button onClick={() => { setLang('EN'); setLangOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors text-left">
              <span className="w-4 h-4 rounded-full bg-blue-800 overflow-hidden flex items-center justify-center relative"><span className="absolute inset-0 bg-red-600 w-1 h-4"></span><span className="absolute inset-0 bg-red-600 h-1 w-4 top-1.5"></span></span>
              English
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
`)

  // (auth)/layout.tsx — sem sidebar, com top header (para /login)
  files.set('app/(auth)/layout.tsx', `import { HeaderControls } from '@/app/components/HeaderControls'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col font-sans">
      <header className="h-[60px] flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-20 border-b border-[#27272a]/30 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-[#18181b] border border-[#27272a] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span className="font-bold text-white text-[13px] tracking-wide uppercase">${ast.projectName}</span>
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

  // (protected)/layout.tsx — COM sidebar
  const navItems = ast.routes.map(r =>
    `        <a href="/${r.path.replace(/^\//, '')}" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          ${r.title}
        </a>`
  ).join('\n')

  files.set('app/(protected)/layout.tsx', `import Link from 'next/link'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--card-border)] bg-[var(--card)] flex flex-col shrink-0">
        <div className="p-5 border-b border-[var(--card-border)]">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <span className="font-bold text-white text-sm">${ast.projectName}</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
${navItems}
        </nav>
        <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">MetaBuilder PRO</p>
          <a href="/api/logout" className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors">Sair</a>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
`)

  // Root Page — Dashboard com cards das rotas
  const routeCards = ast.routes.map(r =>
    `      <a
        href="${r.path}"
        className="group flex flex-col gap-3 bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center ring-1 ring-indigo-500/30 group-hover:bg-indigo-600/25 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[var(--muted)] group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">${r.title}</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">${r.path}</p>
        </div>
      </a>`
  ).join('\n')

  files.set('app/(protected)/page.tsx', `import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — ${ast.projectName}" };

export default function Home() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-[var(--card-border)] pb-8">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Sistema operacional
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">${ast.projectName}</h1>
        <p className="text-[var(--muted)] mt-2 text-lg">Selecione um módulo para começar.</p>
      </div>

      {/* Módulos Grid */}
      <div>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-widest mb-4">Módulos disponíveis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
${routeCards}
        </div>
      </div>
    </div>
  );
}
`)
}

/**
 * generateWorkspaceProject
 *
 * Recebe uma WorkspaceAST e produz um único projeto Next.js com:
 *  - Portal de entrada (/) com cards de todos os projetos
 *  - Sub-rotas por projeto (/[slug]/...)
 *  - Server Actions e componentes isolados por projeto
 */
export function generateWorkspaceProject(ast: WorkspaceAST): Map<string, string> {
  const files = new Map<string, string>()

  // 1. Arquivos raiz do workspace (layout, globals, portal page)
  files.set('app/layout.tsx', generateWorkspaceLayout(ast))
  files.set('app/globals.css', generateWorkspaceGlobalCss())
  files.set('app/page.tsx', generatePortalPage(ast))

  // 2. package.json unificado (dependências de todos os projetos)
  const allDeps: Record<string, string> = {
    'next': '^14.2.0',
    'react': '^18.3.0',
    'react-dom': '^18.3.0',
    'lucide-react': '^0.360.0',
    'clsx': '^2.1.0',
    'tailwind-merge': '^2.2.0',
    '@radix-ui/react-tabs': '^1.0.4',
    '@radix-ui/react-label': '^2.0.2',
    '@radix-ui/react-slot': '^1.0.2',
    'react-hook-form': '^7.51.0',
    'zod': '^3.22.4',
  }
  if (ast.projects.some(p => p.app.dbStack === 'supabase')) {
    allDeps['@supabase/ssr'] = '^0.3.0'
    allDeps['@supabase/supabase-js'] = '^2.40.0'
  }
  if (ast.projects.some(p => p.app.dbStack === 'postgres'))   allDeps['pg'] = '^8.11.0'
  if (ast.projects.some(p => p.app.dbStack === 'mysql'))      allDeps['mysql2'] = '^3.9.0'
  if (ast.projects.some(p => p.app.dbStack === 'sqlserver'))  allDeps['mssql'] = '^10.0.0'
  if (ast.projects.some(p => p.app.dbStack === 'oracle'))     allDeps['oracledb'] = '^6.5.0'

  files.set('package.json', JSON.stringify({
    name: ast.workspaceSlug,
    version: '1.0.0',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
    dependencies: allDeps,
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20',
      '@types/react': '^18',
      '@types/react-dom': '^18',
      tailwindcss: '^3.4.0',
      postcss: '^8.4.0',
    },
  }, null, 2))

  // 3. .env.local com credenciais do workspace
  if (ast.dbStack === 'supabase') {
    files.set('.env.local', `NEXT_PUBLIC_SUPABASE_URL="${ast.supabaseUrl || ''}"\nNEXT_PUBLIC_SUPABASE_ANON_KEY="${ast.supabaseAnonKey || ''}"`)
  } else {
    files.set('.env.local', `DATABASE_URL="${ast.dbConnectionString || ''}"`)
  }

  // .gitignore
  files.set('.gitignore', `/node_modules\n/.next\n/out\n.DS_Store\n.env*.local\n.env\n`)

  // tailwind.config.ts
  files.set('tailwind.config.ts', `import type { Config } from 'tailwindcss';\nconst config: Config = {\n  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],\n  theme: { extend: {} },\n  plugins: [],\n};\nexport default config;\n`)

  // 4. Por projeto: layout + rotas + actions + components
  for (const project of ast.projects) {
    const pSlug = project.slug
    const pApp = project.app

    // Layout do projeto (sidebar com as rotas dele)
    const routeNav = pApp.routes.map(r => ({ path: r.path, title: r.title }))
    files.set(`app/${pSlug}/layout.tsx`, generateProjectLayout(project.name, pSlug, routeNav))

    // Página índice do projeto (redirect para primeira view)
    const firstRoute = pApp.routes[0]?.path || '/'
    files.set(`app/${pSlug}/page.tsx`, `import { redirect } from 'next/navigation'\nexport default function ProjectIndex() {\n  redirect('/${pSlug}${firstRoute}')\n}\n`)

    // Middleware de autenticação
    files.set('middleware.ts', `import { NextResponse } from 'next/server'\nimport type { NextRequest } from 'next/server'\n\n// Rotas que NÃO exigem autenticação\nconst PUBLIC_PATHS = ['/login']\n\nexport function middleware(request: NextRequest) {\n  const { pathname } = request.nextUrl\n\n  // Permite rotas públicas e arquivos estáticos\n  if (\n    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||\n    pathname.startsWith('/_next') ||\n    pathname.startsWith('/favicon')\n  ) {\n    return NextResponse.next()\n  }\n\n  // Verifica o cookie de sessão\n  const session = request.cookies.get('mb_session')?.value\n\n  if (!session) {\n    const loginUrl = new URL('/login', request.url)\n    loginUrl.searchParams.set('redirect', pathname)\n    return NextResponse.redirect(loginUrl)\n  }\n\n  return NextResponse.next()\n}\n\nexport const config = {\n  matcher: [\n    // Protege tudo exceto arquivos estáticos e API do Next\n    '/((?!_next/static|_next/image|favicon.ico).*)',\n  ],\n}\n`)

    // Rotas, Actions e Components — com prefix do projeto
    const projectFiles = new Map<string, string>()
    generateRoutes(pApp, projectFiles)
    generateActions(pApp, projectFiles)
    generateComponents(pApp, projectFiles)

    // Reprefixa todos os arquivos para ficarem dentro de app/[slug]/
    for (const [path, content] of projectFiles) {
      const newPath = path.replace(/^app\//, `app/${pSlug}/`)
      files.set(newPath, content)
    }
  }

  return files
}
