import { AppAST, ModelNode } from '../ast'
import { generateRoutes } from '../layers/routes'
import { generateActions } from '../layers/actions'
import { generateComponents } from '../layers/components'
import { generateLoginPage, generateDownloadsPage } from './auth-flow'

/**
 * java-spring-frontend.ts — Gerador do frontend Next.js para modo java-spring (Módulo 4)
 *
 * Gera todos os arquivos prefixados com 'frontend/'.
 * Diferenças em relação ao Node.js full-stack:
 *  - package.json SEM drivers de banco (pg, oracledb, mysql2, mssql, @supabase/ssr)
 *  - .env.local com NEXT_PUBLIC_API_URL ao invés de DATABASE_URL
 *  - src/lib/api-client.ts com wrapper de fetch REST
 *  - app/actions/{model}.ts com chamadas REST ao invés de Server Actions de banco
 */
export function generateJavaFrontend(ast: AppAST, files: Map<string, string>): void {
  // 1. package.json — SEM drivers de banco
  generateFrontendPackageJson(ast, files)

  // 2. .env.local com API URL
  files.set('frontend/.env.local', `NEXT_PUBLIC_API_URL=http://localhost:${ast.javaPort ?? 8080}\n`)

  // 3. .gitignore
  files.set('frontend/.gitignore', `/node_modules\n/.next/\n/out/\n.env*.local\n.env\n.DS_Store\n`)

  // 4. .npmrc
  files.set('frontend/.npmrc', `legacy-peer-deps=true\nprefer-offline=true\naudit=false\nfund=false\n`)

  // 5. api-client.ts — wrapper de fetch REST
  files.set('frontend/src/lib/api-client.ts', generateApiClient())

  // 6. REST Actions para cada modelo (substituem as Server Actions de banco)
  for (const model of ast.models) {
    files.set(`frontend/app/actions/${model.dbTable}.ts`, generateRestActions(model))
  }

  // 7. Gerar rotas, componentes e páginas (reutilizar camadas existentes com prefixo)
  // Cria um AST "espelho" apontando os paths para frontend/
  const frontendAst: AppAST = { ...ast }

  // Gerar arquivos de rota e componentes com prefixo frontend/
  const tempFiles = new Map<string, string>()
  generateRoutes(frontendAst, tempFiles)
  generateComponents(frontendAst, tempFiles)
  generateLoginPage(frontendAst, tempFiles)
  generateDownloadsPage(frontendAst, tempFiles)

  // Mover todos para frontend/
  for (const [path, content] of tempFiles) {
    files.set(`frontend/${path}`, content)
  }

  // 8. tsconfig.json, tailwind, next.config, postcss, etc.
  generateFrontendConfigFiles(ast, files)

  // 9. README.md do frontend
  files.set('frontend/README.md', generateFrontendReadme(ast))
}

// ─────────────────────────────────────────────────────────────────────────────
// package.json sem drivers de banco
// ─────────────────────────────────────────────────────────────────────────────

function generateFrontendPackageJson(ast: AppAST, files: Map<string, string>): void {
  const pkg = {
    name: ast.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-frontend',
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'lucide-react': '^0.511.0',
      clsx: '^2.1.1',
      'tailwind-merge': '^2.3.0',
      'framer-motion': '^12.0.0',
      'date-fns': '^4.1.0',
      leaflet: '^1.9.4',
      'react-leaflet': '^5.0.0',
      '@xyflow/react': '^12.10.2',
      dagre: '^0.8.5',
      recharts: '^3.8.1',
      'react-is': '^19.0.0',
      '@dnd-kit/core': '^6.3.1',
      '@dnd-kit/sortable': '^10.0.0',
      '@dnd-kit/utilities': '^3.2.2',
      'react-hook-form': '^7.54.0',
      '@hookform/resolvers': '^3.9.0',
      zod: '^3.23.0',
      '@radix-ui/react-label': '^2.1.0',
      '@radix-ui/react-slot': '^1.1.0',
      '@radix-ui/react-tabs': '^1.1.0',
      // NOTA: sem pg, oracledb, mysql2, mssql, @supabase/ssr
      // O frontend chama a API REST do Spring Boot
    } as Record<string, string>,
    devDependencies: {
      typescript: '^5.6.0',
      '@types/node': '^22',
      '@types/react': '^19',
      '@types/react-dom': '^19',
      '@types/leaflet': '^1.9.16',
      '@types/dagre': '^0.7.54',
      tailwindcss: '^3.4.0',
      postcss: '^8.4.0',
      autoprefixer: '^10.4.20',
    } as Record<string, string>,
  }

  files.set('frontend/package.json', JSON.stringify(pkg, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// api-client.ts — wrapper de fetch REST (Seção 4.3 do plano)
// ─────────────────────────────────────────────────────────────────────────────

function generateApiClient(): string {
  return `const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {
  const url = new URL(\`\${API_BASE}\${path}\`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)))
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(\`\${API_BASE}\${path}\`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// REST Actions por modelo (Seção 4.4 do plano)
// ─────────────────────────────────────────────────────────────────────────────

function generateRestActions(model: ModelNode): string {
  const mn = model.name
  const endpoint = `/api/${model.dbTable}`

  return `'use server'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'

export async function get${mn}List(opts?: { page?: number; limit?: number; search?: string }) {
  return apiGet('${endpoint}', opts)
}

export async function get${mn}ById(id: string) {
  return apiGet(\`${endpoint}/\${id}\`)
}

export async function get${mn}ByField(field: string, value: any) {
  return apiGet('${endpoint}', { [field]: value })
}

export async function create${mn}(formData: FormData | Record<string, any>) {
  const body = formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData
  return apiPost('${endpoint}', body)
}

export async function update${mn}(id: string, formData: FormData | Record<string, any>) {
  const body = formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData
  return apiPut(\`${endpoint}/\${id}\`, body)
}

export async function delete${mn}(id: string) {
  return apiDelete(\`${endpoint}/\${id}\`)
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Arquivos de configuração do frontend Next.js
// ─────────────────────────────────────────────────────────────────────────────

function generateFrontendConfigFiles(ast: AppAST, files: Map<string, string>): void {
  // tsconfig.json
  files.set('frontend/tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2))

  // next.config.ts
  files.set('frontend/next.config.ts', `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Frontend chama Spring Boot via NEXT_PUBLIC_API_URL
  async rewrites() {
    return []
  },
}

export default nextConfig
`)

  // tailwind.config.ts
  files.set('frontend/tailwind.config.ts', `import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}

export default config
`)

  // postcss.config.mjs
  files.set('frontend/postcss.config.mjs', `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
`)
}

// ─────────────────────────────────────────────────────────────────────────────
// README do frontend
// ─────────────────────────────────────────────────────────────────────────────

function generateFrontendReadme(ast: AppAST): string {
  const port = ast.javaPort ?? 8080
  return `# ${ast.projectName} — Frontend (Next.js)

## Pré-requisitos
- Node.js 18+
- Spring Boot backend rodando em \`http://localhost:${port}\`

## Configuração
\`\`\`bash
# .env.local já está pré-configurado:
NEXT_PUBLIC_API_URL=http://localhost:${port}
\`\`\`

## Executar
\`\`\`bash
cd frontend
npm install
npm run dev
# Acesse: http://localhost:3000
\`\`\`

## Arquitetura
O frontend chama a API REST do Spring Boot via \`src/lib/api-client.ts\`.
Não há acesso direto ao banco de dados neste projeto.

### Endpoints consumidos
${ast.models.map(m => `- \`GET/POST /api/${m.dbTable}\` — ${m.name}`).join('\n')}

## Swagger UI
\`http://localhost:${port}/swagger-ui.html\`
`
}
