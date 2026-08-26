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
  files.set('app/login/page.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — ${ast.projectName}',
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-1">Bem-vindo de volta!</h1>
          <p className="text-[var(--muted)] text-sm text-center mb-8">Entre com suas credenciais para acessar o sistema.</p>

          {/* Biometria */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 border border-[var(--card-border)] hover:border-indigo-500 text-[var(--foreground)] rounded-xl py-2.5 px-4 text-sm font-medium transition-all mb-6 bg-white/5 hover:bg-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10"/>
              <path d="M12 8v4l3 3"/>
            </svg>
            ENTRAR COM BIOMETRIA
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[var(--card-border)]"></div>
            <span className="text-xs text-[var(--muted)]">ou</span>
            <div className="flex-1 h-px bg-[var(--card-border)]"></div>
          </div>

          {/* Form */}
          <form action="/api/login" method="post" className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="exemplo@empresa.com"
                className="w-full bg-[var(--background)] border border-[var(--card-border)] focus:border-indigo-500 text-[var(--foreground)] placeholder:text-[var(--muted)] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Senha</label>
                <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Esqueci minha senha</a>
              </div>
              <input
                id="password"
                type="password"
                placeholder="Sua senha secreta"
                className="w-full bg-[var(--background)] border border-[var(--card-border)] focus:border-indigo-500 text-[var(--foreground)] placeholder:text-[var(--muted)] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3 px-4 text-sm transition-colors shadow-lg shadow-indigo-600/25 mt-2"
            >
              ENTRAR NO SISTEMA
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-xs text-[var(--muted)] hover:text-white transition-colors">
              ← Voltar ao Dashboard
            </a>
          </div>

          <p className="text-center text-[10px] text-[var(--muted)] mt-6 tracking-widest uppercase">Powered by MetaBuilder PRO</p>
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

  // Root Layout — com sidebar e navegação
  const navItems = ast.routes.map(r =>
    `        <a href="${r.path}" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          ${r.title}
        </a>`
  ).join('\n')

  files.set('app/layout.tsx', `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${ast.projectName}",
  description: "Generated by MetaBuilder PRO — CleanCodeGenerator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={inter.className}>
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
            <div className="p-4 border-t border-[var(--card-border)]">
              <p className="text-xs text-[var(--muted)]">MetaBuilder PRO</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
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

  files.set('app/page.tsx', `import type { Metadata } from "next";

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
