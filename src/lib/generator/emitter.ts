import { AppAST, WorkspaceAST } from './ast'
import { generateRoutes } from './layers/routes'
import { generateActions } from './layers/actions'
import { generateComponents } from './layers/components'
import { generatePortalPage, generateWorkspaceLayout, generateWorkspaceGlobalCss, generateProjectLayout } from './layers/portal'

/**
 * emitter.ts
 *
 * Recebe a AST (Ãrvore Abstrata) e orquestra a geração de todos os arquivos
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

  // 3. PÃ¡gina de Login
  generateLoginPage(ast, files)

  // 4. PÃ¡gina de Downloads
  generateDownloadsPage(ast, files)

  return files
}

import { T } from './layers/design-tokens'

function generateLoginPage(ast: AppAST, files: Map<string, string>) {
  const iconFallback = ast.projectName.charAt(0).toUpperCase()
  const projectIconSvg = ast.projectIcon && ast.projectIcon.startsWith('<svg') 
    ? ast.projectIcon 
    : `<span className="text-xl font-bold text-white">${iconFallback}</span>`

  files.set('app/(auth)/login/page.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — ${ast.projectName}',
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = await searchParams
  const error = resolvedSearchParams?.error
  const errorMessage = error === 'invalid'
    ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
    : error === 'credentials'
    ? 'Por favor, preencha o e-mail e a senha.'
    : error === 'server'
    ? 'Erro ao processar login. Verifique a conexão com o banco de dados.'
    : error === 'config'
    ? 'Tabela de autenticação não encontrada nos modelos do projeto.'
    : null

  return (
    <main className="${T.LOGIN_PAGE}">
      <div className="w-full max-w-[380px] relative z-10">
        {/* Card */}
        <div className="${T.LOGIN_CARD}">
          {/* Logo */}
          <div className="${T.LOGIN_LOGO}">
            ${projectIconSvg}
          </div>

          <h1 className="${T.LOGIN_TITLE}">Bem-vindo de volta!</h1>
          <p className="${T.LOGIN_SUBTITLE}">Entre com suas credenciais para acessar o sistema.</p>

          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold text-center leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form action="/api/login" method="post" className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="${T.LOGIN_LABEL}">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="exemplo@empresa.com"
                className="${T.LOGIN_INPUT}"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="${T.LOGIN_LABEL}">Senha</label>
                <a href="#" className="text-[10px] text-indigo-600 dark:text-[#4f46e5] hover:text-indigo-700 dark:hover:text-[#6366f1] transition-colors font-bold uppercase tracking-wide">Esqueci minha senha?</a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Sua senha secreta"
                  className="${T.LOGIN_INPUT}"
                />
              </div>
            </div>

            <button
              type="submit"
              className="${T.LOGIN_BTN}"
            >
              ENTRAR NO SISTEMA
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="/" className="${T.LOGIN_BACK_LINK}">
              &larr; VOLTAR AO INÍCIO
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-3">
             <div className="h-[1px] w-12 bg-slate-200 dark:bg-[#27272a]/50 transition-colors duration-300"></div>
             <p className="text-center text-[9px] text-slate-400 dark:text-[#52525b] tracking-[0.2em] uppercase font-bold transition-colors duration-300">POWERED BY METABUILDER</p>
             <div className="h-[1px] w-12 bg-slate-200 dark:bg-[#27272a]/50 transition-colors duration-300"></div>
          </div>
        </div>
      </div>
    </main>
  )
}
`)



  // app/api/login/route.ts — define o cookie de sessão
  let loginApiContent = `import { NextResponse } from 'next/server'\n`
  
  if (ast.authConfig?.authType === 'database') {
    const table = ast.authConfig.tableName || 'usuarios'
    const emailCol = ast.authConfig.emailColumn || 'email'
    const passCol = ast.authConfig.passwordColumn || 'hash_senha'
    const hashFormat = ast.authConfig.hashFormat || 'bcrypt'
    
    const cleanTable = (table || '').toLowerCase().trim().replace(/^.*\./, '')
    const targetTable = (table || '').toLowerCase().trim()
    
    // Procura estritamente o model da tabela de auth pelo nome exato da tabela
    const authModel = 
      ast.models.find(m => (m.dbTable || '').toLowerCase().trim() === targetTable) ||
      ast.models.find(m => (m.name || '').toLowerCase().trim() === targetTable) ||
      ast.models.find(m => (m.dbTable || '').toLowerCase().trim() === cleanTable) ||
      ast.models.find(m => (m.name || '').toLowerCase().trim() === cleanTable)
    
    if (authModel) {
      loginApiContent += `import { get${authModel.name}ByField } from '@/app/actions/${authModel.name.toLowerCase()}'\n`
      if (hashFormat === 'bcrypt') {
        loginApiContent += `import bcrypt from 'bcryptjs'\n`
      } else if (hashFormat === 'md5' || hashFormat === 'sha256') {
        loginApiContent += `import crypto from 'crypto'\n`
      }
      
      loginApiContent += `
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim()
  const password = formData.get('password') as string || ''
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=credentials', request.url))
  }

  try {
    const rows = await get${authModel.name}ByField('${emailCol}', email)
    if (!rows || rows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }
    
    const user = rows[0]
    const dbHash = String(user['${passCol}'] ?? user['${passCol.toLowerCase()}'] ?? user['${passCol.toUpperCase()}'] ?? '')

    let isValid = false
    ${
      hashFormat === 'bcrypt'
        ? `isValid = await bcrypt.compare(password, dbHash)`
        : hashFormat === 'sha256'
        ? `const hash = crypto.createHash('sha256').update(password).digest('hex')\n    isValid = (hash.toLowerCase() === dbHash.toLowerCase())`
        : hashFormat === 'md5'
        ? `const hash = crypto.createHash('md5').update(password).digest('hex')\n    isValid = (hash.toLowerCase() === dbHash.toLowerCase())`
        : `isValid = (password === dbHash)`
    }

    if (!isValid) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const response = NextResponse.redirect(new URL(redirect, request.url))
    response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    response.cookies.set('mb_user', JSON.stringify({ email, name: user['nome'] || user['nome_completo'] || user['name'] || user['NOME'] || '' }), {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response

  } catch (err) {
    console.error('Login DB Error:', err)
    return NextResponse.redirect(new URL('/login?error=server', request.url))
  }
}
`
    } else {
      loginApiContent += `
export async function POST(request: Request) {
  console.error('Tabela de autenticação "${table}" não encontrada nos modelos do projeto.')
  return NextResponse.redirect(new URL('/login?error=config', request.url))
}
`
    }
  } else if (ast.authConfig?.authType === 'managed' && ast.dbStack === 'supabase') {
    loginApiContent += `import { createClient } from '@/app/actions/db'\n
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim()
  const password = formData.get('password') as string || ''
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=credentials', request.url))
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const response = NextResponse.redirect(new URL(redirect, request.url))
    response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    response.cookies.set('mb_user', JSON.stringify({ email }), {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Login Supabase Error:', err)
    return NextResponse.redirect(new URL('/login?error=server', request.url))
  }
}
`
  } else {
    loginApiContent += `
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim() || 'user@example.com'
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  // Autenticação desativada ou mock
  const response = NextResponse.redirect(new URL(redirect, request.url))
  response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  response.cookies.set('mb_user', JSON.stringify({ email, name: email.split('@')[0] }), {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
`
  }

  files.set('app/api/login/route.ts', loginApiContent)

  // app/api/logout/route.ts â€” limpa o cookie de sessão
  files.set('app/api/logout/route.ts', `import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete('mb_session')
  response.cookies.delete('mb_user')
  return response
}
`)

  // middleware.ts â€” intercepta toda requisição e redireciona para /login se não autenticado
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
      "next": "^15.0.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^0.511.0",
      "clsx": "^2.1.1",
      "tailwind-merge": "^2.3.0",
      "framer-motion": "^12.0.0",
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

  // tsconfig.json â€” essencial para o alias @/ funcionar
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

  // â”€â”€ Sidebar fiel ao DynamicSidebar.tsx do Runtime â”€â”€
  const navItems = ast.navigation.length > 0 ? ast.navigation : ast.routes.map(r => ({
    id: r.viewSlug,
    label: r.title,
    icon: r.icon || 'Layout',
    type: 'view',
    target: r.viewSlug,
  }))
  const navItemsJson = JSON.stringify(navItems)
  const projectIcon = ast.projectIcon || 'Box'

  files.set('app/components/AppSidebar.tsx', `'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronRight, Home, LogOut, PanelLeftClose, PanelLeftOpen,
  Layout, Box
} from 'lucide-react'

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


// Minimal icon renderer — clientes podem substituir por lucide-react completo
function NavIcon({ name, size = 20 }: { name?: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  )
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
      return pathname === \`/\${item.target}\` ||
             pathname?.startsWith(\`/\${item.target}/\`)
    }
    return false
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item)
    const href = item.type === 'view' ? \`/\${item.target}\` : (item.target || '#')

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
            <NavIcon name={item.icon} size={isCollapsed ? 24 : 20} />
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
        <NavIcon name={item.icon} size={isCollapsed ? 24 : 20} />
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
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-200/50 dark:border-white/5 shrink-0">
        <Link href={\`/\${projectSlug}/dashboard\`} className="flex items-center gap-3 group relative">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 group-hover:scale-110 transition-transform">
            <Box size={18} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-none truncate">{projectName}</span>
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-indigo-500 opacity-70 mt-0.5">MetaBuilder PRO</span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className={\`flex-1 px-4 py-6 space-y-2 custom-scrollbar \${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}\`}>
        {navItems.map(item => renderItem(item))}
      </nav>

      {/* Footer */}
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

  // Protected Layout â€” usa AppSidebar + Header idÃªntico ao Runtime
  files.set('app/(protected)/layout.tsx', `'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, Home, ChevronRight } from 'lucide-react'
import { AppSidebar } from '@/app/components/AppSidebar'
import { HeaderControls } from '@/app/components/HeaderControls'

const NAV_ITEMS = ${navItemsJson}
const PROJECT_SLUG = '${ast.projectSlug}'
const PROJECT_NAME = '${ast.projectName}'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  const segments = (pathname || '').split('/').filter(Boolean).slice(1) // remove project slug
  const currentLabel = segments[segments.length - 1] || ''
  const navItem = NAV_ITEMS.find((n: any) => n.target === currentLabel)

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
        {/* Header */}
        <header className="h-16 border-b border-neutral-200/50 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl sticky top-0 z-[90] flex items-center px-6 gap-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-all hover:scale-105 active:scale-95"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

          <nav className="flex-1 flex items-center gap-2 text-[10px] font-bold capitalize tracking-widest text-neutral-400 overflow-hidden">
            <Link href={\`/\${PROJECT_SLUG}/dashboard\`} className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 shrink-0">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            {navItem && (
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-3 h-3 opacity-30 shrink-0" />
                <span className="text-neutral-900 dark:text-white truncate capitalize">{navItem.label}</span>
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
`)

  // Dashboard page â€” idÃªntico ao Runtime /dashboard
  const navCards = (ast.navigation.length > 0 ? ast.navigation : ast.routes.map(r => ({
    id: r.viewSlug,
    label: r.title,
    icon: r.icon,
    type: 'view',
    target: r.viewSlug,
  }))).filter((n: any) => n.type === 'view' || n.type === 'folder').map((n: any) => `
  <a
    href="/${n.target || n.id}"
    className="group flex flex-col justify-between bg-white dark:bg-[#141416] border border-slate-200 dark:border-[#27272a] rounded-3xl p-6 sm:p-8 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 min-h-[200px]"
  >
    <div>
      <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
      </div>
      <h2 className="font-black text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${n.label}</h2>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-neutral-500 mt-0.5">CASO DE USO</p>
    </div>
    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-[#27272a]/50 mt-4">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">ACESSAR</span>
      <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 dark:text-[#71717a] group-hover:text-white transition-colors group-hover:translate-x-0.5">
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
      </div>
    </div>
  </a>`).join('\n')

  files.set('app/(protected)/page.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard - ${ast.projectName}' }

export default function DashboardPage() {
  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-10">
        <div className="w-14 h-14 rounded-3xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">${ast.projectName}</h1>
          <p className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-500 mt-0.5">CASOS DE USO</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
${navCards}
      </div>
    </div>
  )
}
`)
}
/**
 * generateWorkspaceProject
 *
 * Recebe uma WorkspaceAST e produz um Ãºnico projeto Next.js com:
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

  // 2. package.json unificado (dependÃªncias de todos os projetos)
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
  if (ast.projects.some(p => p.app.authConfig?.hashFormat === 'bcrypt')) allDeps['bcryptjs'] = '^2.4.3'

  const devDeps: Record<string, string> = {
    typescript: '^5.0.0',
    '@types/node': '^20',
    '@types/react': '^18',
    '@types/react-dom': '^18',
    tailwindcss: '^3.4.0',
    postcss: '^8.4.0',
  }
  if (ast.projects.some(p => p.app.dbStack === 'postgres'))   devDeps['@types/pg'] = '^8.11.0'
  if (ast.projects.some(p => p.app.authConfig?.hashFormat === 'bcrypt')) devDeps['@types/bcryptjs'] = '^2.4.6'

  files.set('package.json', JSON.stringify({
    name: ast.workspaceSlug,
    version: '1.0.0',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
    dependencies: allDeps,
    devDependencies: devDeps,
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
  files.set('tailwind.config.ts', `import type { Config } from 'tailwindcss';
const config: Config = {
  darkMode: ["class"],
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
`)

  // 4. Por projeto: layout + rotas + actions + components
  for (const project of ast.projects) {
    const pSlug = project.slug
    const pApp = project.app

    // Layout do projeto (sidebar com as rotas dele)
    const routeNav = pApp.routes.map(r => ({ path: r.path, title: r.title }))
    files.set(`app/${pSlug}/layout.tsx`, generateProjectLayout(project.name, pSlug, routeNav))

    // PÃ¡gina índice do projeto (redirect para primeira view)
    const firstRoute = pApp.routes[0]?.path || '/'
    files.set(`app/${pSlug}/page.tsx`, `import { redirect } from 'next/navigation'\nexport default function ProjectIndex() {\n  redirect('/${pSlug}${firstRoute}')\n}\n`)

    // Middleware de autenticação
    files.set('middleware.ts', `import { NextResponse } from 'next/server'\nimport type { NextRequest } from 'next/server'\n\n// Rotas que NÃƒO exigem autenticação\nconst PUBLIC_PATHS = ['/login']\n\nexport function middleware(request: NextRequest) {\n  const { pathname } = request.nextUrl\n\n  // Permite rotas pÃºblicas e arquivos estÃ¡ticos\n  if (\n    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||\n    pathname.startsWith('/_next') ||\n    pathname.startsWith('/favicon')\n  ) {\n    return NextResponse.next()\n  }\n\n  // Verifica o cookie de sessão\n  const session = request.cookies.get('mb_session')?.value\n\n  if (!session) {\n    const loginUrl = new URL('/login', request.url)\n    loginUrl.searchParams.set('redirect', pathname)\n    return NextResponse.redirect(loginUrl)\n  }\n\n  return NextResponse.next()\n}\n\nexport const config = {\n  matcher: [\n    // Protege tudo exceto arquivos estÃ¡ticos e API do Next\n    '/((?!_next/static|_next/image|favicon.ico).*)',\n  ],\n}\n`)

    // Rotas, Actions e Components â€” com prefix do projeto
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

  // 5. PÃ¡gina de login unificada para o workspace
  const primaryProject = ast.projects[0]?.app
  if (primaryProject) {
    generateLoginPage(primaryProject, files)
  }

  // 6. BYOC Stubs (Custom Components)
  const byocSet = new Set<string>()
  for (const project of ast.projects) {
    for (const route of project.app.routes) {
      if (route.rawLayoutConfig?.custom_slots) {
        for (const slot of route.rawLayoutConfig.custom_slots) {
          if (slot.component) byocSet.add(slot.component)
        }
      }
    }
  }

  for (const componentName of byocSet) {
    files.set(`components/byoc/${componentName}.tsx`, `export default function ${componentName}({ data, config }: { data: any, config: any }) {
  return (
    <div className="p-4 border border-dashed border-indigo-500/50 bg-indigo-500/5 rounded-xl text-center">
      <div className="text-xs font-bold text-indigo-400 mb-1">BYOC Component</div>
      <div className="text-sm font-medium text-foreground">${componentName}</div>
      <div className="text-[10px] text-muted-foreground mt-2">Replace this stub with your real component in src/components/byoc/</div>
    </div>
  )
}
`)
  }

  return files
}

export function generateDownloadsPage(ast: AppAST, files: Map<string, string>) {
  files.set('app/(protected)/downloads/page.tsx', `import Link from 'next/link'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react'

export default function DownloadsPage() {
  // Dados mockados estruturais (O frontend farÃ¡ fetch real na API em v2)
  const jobs = [
    { id: '1', file_name: 'clientes_export.csv', status: 'completed', progress: 100, record_count: 1450, file_size: 45020, created_at: new Date().toISOString() },
    { id: '2', file_name: 'pedidos_relatorio.xlsx', status: 'processing', progress: 45, record_count: 8500, created_at: new Date().toISOString() },
  ]

  const metrics = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    failed: jobs.filter(j => j.status === 'failed').length
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-500/20">
            <Download className="w-5 h-5 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gerenciador de Downloads</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">Central de exportAções assíncronas do sistema.</p>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-amber-500">FILA DE GERAÇÃO DE ARQUIVOS</h4>
          <p className="text-xs text-amber-500/80 mt-1 leading-relaxed">
            As exportAções com mais de 1.000 registros são processadas em background para não travar o uso da aplicação. VocÃª pode continuar trabalhando normalmente e voltar aqui quando o status estiver Concluído.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Solicitado', value: metrics.total, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Download Concluído', value: metrics.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'Em Processamento', value: metrics.processing, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: 'Falhas', value: metrics.failed, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
        ].map((m, idx) => (
          <div key={idx} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{m.label}</span>
              <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${m.bg} \${m.color}\`}>
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <span className={\`text-3xl font-bold \${m.color}\`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs placeholder */}
      <div className="border-b border-[var(--card-border)] flex gap-6 mt-8">
        <div className="pb-3 border-b-2 border-indigo-500 font-semibold text-sm text-white">Todas ({metrics.total})</div>
        <div className="pb-3 border-b-2 border-transparent font-medium text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer">Concluídas ({metrics.completed})</div>
        <div className="pb-3 border-b-2 border-transparent font-medium text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer">Pendentes ({metrics.processing})</div>
      </div>

      {/* List */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[var(--card-border)] bg-neutral-900/40 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 flex items-center gap-2 text-xs font-black tracking-widest text-[var(--muted)] uppercase"><ArrowUpDown className="w-3 h-3"/> Arquivo</div>
          <div className="col-span-3 text-xs font-black tracking-widest text-[var(--muted)] uppercase">Registros</div>
          <div className="col-span-3 text-xs font-black tracking-widest text-[var(--muted)] uppercase">Status</div>
          <div className="col-span-1 text-center text-xs font-black tracking-widest text-[var(--muted)] uppercase">Ações</div>
        </div>

        <div className="divide-y divide-[var(--card-border)]">
          {jobs.length === 0 ? (
             <div className="p-12 text-center flex flex-col items-center">
               <Download className="w-12 h-12 text-[var(--muted)] opacity-20 mb-4" />
               <h3 className="text-white font-semibold mb-1">Nenhuma exportação encontrada</h3>
               <p className="text-[var(--muted)] text-sm">Gere arquivos nas telas de listagem clicando em "Exportar".</p>
             </div>
          ) : jobs.map((job) => (
             <div key={job.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-white/5 transition-colors group">
               <div className="col-span-5 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center ring-1 ring-neutral-700 group-hover:bg-indigo-600/10 group-hover:ring-indigo-500/30 transition-all">
                    {job.file_name.endsWith('csv') ? <FileText className="w-5 h-5 text-indigo-400" /> : <FileSpreadsheet className="w-5 h-5 text-emerald-400" />}
                 </div>
                 <div>
                   <div className="font-semibold text-white text-sm">{job.file_name}</div>
                   <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                     <Calendar className="w-3 h-3" />
                     {new Date(job.created_at).toLocaleString()}
                     {job.file_size && <span className="opacity-50">Â· {(job.file_size / 1024).toFixed(2)} KB</span>}
                   </div>
                 </div>
               </div>

               <div className="col-span-3 text-sm text-[var(--foreground)]">
                 <span className="bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-md text-xs font-medium">
                   {job.record_count?.toLocaleString()} linhas
                 </span>
               </div>

               <div className="col-span-3">
                 {job.status === 'completed' && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold ring-1 ring-emerald-500/20">
                     <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                   </span>
                 )}
                 {job.status === 'processing' && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold ring-1 ring-amber-500/20">
                     <Loader2 className="w-3.5 h-3.5 animate-spin" /> Em Processamento {job.progress}%
                   </span>
                 )}
               </div>

               <div className="col-span-1 flex justify-center">
                 {job.status === 'completed' ? (
                   <button className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95">
                     <Download className="w-4 h-4" />
                   </button>
                 ) : (
                   <div className="w-8 h-8 flex items-center justify-center text-[var(--muted)]">
                     <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                   </div>
                 )}
               </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  )
}
`)
}
