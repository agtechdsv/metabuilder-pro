import { WorkspaceAST } from '../ast'
import { generateRoutes } from '../layers/routes'
import { generateActions } from '../layers/actions'
import { generateComponents } from '../layers/components'
import { generatePortalPage, generateWorkspaceLayout, generateWorkspaceGlobalCss, generateProjectLayout } from '../layers/portal'
import { generateLoginPage } from './auth-flow'

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
    'framer-motion': '^12.0.0',
    'recharts': '^3.8.1',
    'react-is': '^18.3.1 || ^19.0.0',
    '@dnd-kit/core': '^6.3.1',
    '@dnd-kit/sortable': '^10.0.0',
    '@dnd-kit/utilities': '^3.2.2',
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

  // .npmrc — acelera o npm install e pula auditorias desnecessárias
  files.set('.npmrc', `legacy-peer-deps=true\nprefer-offline=true\naudit=false\nfund=false\n`)

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

  // 5. Página de login unificada para o workspace
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
