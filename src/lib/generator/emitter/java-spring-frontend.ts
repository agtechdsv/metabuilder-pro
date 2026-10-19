import { AppAST, ModelNode } from '../ast'
import { generateRoutes } from '../layers/routes'
import { generateActions } from '../layers/actions'
import { generateComponents } from '../layers/components'
import { generateLoginPage, generateDownloadsPage } from './auth-flow'
import { generateBaseFiles } from './base-files'
import { generateAccessAdmin, applyWriteGuard } from './access-admin'
import { toPascalCase } from '../layers/routes/helpers'
import { javaNeedsAccess } from './java-spring-access'
import { routesNeedExport } from '../layers/export'


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
export function generateJavaFrontend(ast: AppAST, files: Map<string, string>, jwtSecret?: string): void {
  // 1. package.json — SEM drivers de banco
  generateFrontendPackageJson(ast, files)

  // 2. .env.local com API URL
  // com JWT ligado, o frontend assina cada chamada à API com o mesmo segredo do backend (só o servidor do frontend o conhece)
  const jwtLines = ast.jwtEnabled && jwtSecret ? `# Segredo JWT compartilhado com o backend (application.properties). Em produção defina JWT_SECRET nos dois lados.\nJWT_SECRET=${jwtSecret}\n` : ''
  files.set('frontend/.env.local', `NEXT_PUBLIC_API_URL=http://localhost:${ast.javaPort ?? 8080}\n${jwtLines}`)

  // 3. .gitignore
  files.set('frontend/.gitignore', `/node_modules\n/.next/\n/out/\n.env*.local\n.env\n.DS_Store\n`)

  // 4. .npmrc
  files.set('frontend/.npmrc', `legacy-peer-deps=true\nprefer-offline=true\naudit=false\nfund=false\n`)

  // 5. api-client.ts — wrapper de fetch REST
  const withUser = javaNeedsAccess(ast)
  files.set('frontend/lib/api-client.ts', generateApiClient(withUser))

  // 6. REST Actions para cada modelo (substituem as Server Actions de banco)
  for (const model of ast.models) {
    let actionContent = generateRestActions(model)
    // gestão de acesso: quem só tem leitura nas telas da tabela não grava (o servidor do frontend recusa antes de chamar a API)
    if (ast.accessAdmin) actionContent = applyWriteGuard(actionContent, model)
    const fileKeys = new Set<string>()
    if (model.dbTable) {
      fileKeys.add(model.dbTable.toLowerCase().trim())
      fileKeys.add(model.dbTable.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))
    }
    if (model.name) {
      fileKeys.add(model.name.toLowerCase().trim())
      fileKeys.add(model.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))
    }
    for (const key of fileKeys) {
      files.set(`frontend/app/actions/${key}.ts`, actionContent)
    }
  }

  // 7. Gerar rotas, componentes e páginas (reutilizar camadas existentes com prefixo)
  // Cria um AST "espelho" apontando os paths para frontend/
  const frontendAst: AppAST = { ...ast }

  // Gerar arquivos de rota e componentes com prefixo frontend/
  const tempFiles = new Map<string, string>()
  generateBaseFiles(frontendAst, tempFiles)
  generateRoutes(frontendAst, tempFiles)
  generateComponents(frontendAst, tempFiles)
  generateLoginPage(frontendAst, tempFiles)
  generateDownloadsPage(frontendAst, tempFiles)
  // gestão de acesso (opcional): o frontend lê os grupos e permissões pela API REST, como qualquer outra tabela
  generateAccessAdmin(frontendAst, tempFiles)

  // com regras de acesso no backend: o login (lê o cadastro do usuário e o grupo) e as telas de gestão de acesso chamam a API como "sistema"
  if (withUser) {
    const login = tempFiles.get('app/api/login/route.ts')
    if (login && login.includes('export async function POST(request: Request) {')) {
      tempFiles.set('app/api/login/route.ts', "import { asSystem } from '@/lib/api-client'\n" + login.replace('export async function POST(request: Request) {', 'async function handleLogin(request: Request) {') +
        '\nexport async function POST(request: Request) {\n  return asSystem(() => handleLogin(request))\n}\n')
    }
    const admin = tempFiles.get('app/actions/access-admin.ts')
    if (admin) {
      const names: string[] = []
      const wrapped = admin.replace(/export async function (\w+)\(/g, (_m, n: string) => { names.push(n); return 'async function ' + n + 'Impl(' })
      const wrappers = names.map(n => '\nexport async function ' + n + '(...args: Parameters<typeof ' + n + 'Impl>): ReturnType<typeof ' + n + 'Impl> {\n  return asSystem(() => ' + n + 'Impl(...args))\n}\n').join('')
      tempFiles.set('app/actions/access-admin.ts', wrapped.replace(/^('use server'\n)/, "$1import { asSystem } from '@/lib/api-client'\n") + wrappers)
    }
  }

  // Mover todos para frontend/ (ignorando config files da raiz que são recriados abaixo)
  for (const [path, content] of tempFiles) {
    // o proxy.ts do login/permissões também vai: sem ele as telas não exigiriam sessão nem aplicariam o acesso por grupo
    if (path.includes('/') || path === 'components.json' || path === 'proxy.ts') {
      files.set(`frontend/${path}`, content)
    }
  }

  // o login assina a sessão com MB_SESSION_SECRET: leva o segredo gerado junto da URL da API (cada exportação tem o seu)
  const secretLine = (tempFiles.get('.env.local') || '').split('\n').find(l => l.startsWith('MB_SESSION_SECRET='))
  if (secretLine) {
    files.set('frontend/.env.local', `${files.get('frontend/.env.local') ?? ''}# Assina a sessão de login do app. Em produção defina esta variável no ambiente de hospedagem (nunca a publique).\n${secretLine}\n${(tempFiles.get('.env.local') || '').split('\n').filter(l => l.startsWith('LDAP_')).map(l => l + '\n').join('')}`)
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
      next: '16.2.4',
      react: '19.2.4',
      'react-dom': '19.2.4',
      'lucide-react': '^1.14.0',
      clsx: '^2.1.1',
      'tailwind-merge': '^3.5.0',
      'framer-motion': '^12.38.0',
      'date-fns': '^4.3.0',
      leaflet: '^1.9.4',
      'react-leaflet': '^5.0.0',
      '@xyflow/react': '^12.10.2',
      dagre: '^0.8.5',
      recharts: '^3.8.1',
      'react-is': '^19.2.4',
      '@dnd-kit/core': '^6.3.1',
      '@dnd-kit/sortable': '^10.0.0',
      '@dnd-kit/utilities': '^3.2.2',
      'react-hook-form': '^7.54.0',
      '@hookform/resolvers': '^3.9.0',
      zod: '^3.23.0',
      '@radix-ui/react-label': '^2.1.0',
      '@radix-ui/react-slot': '^1.1.0',
      '@radix-ui/react-tabs': '^1.1.0',
      'bcryptjs': '^2.4.3',
      'jose': '^5.4.0',
      ...(ast.authConfig?.authType === 'ldap' ? { ldapts: '^7.2.0' } : {}),
      ...(routesNeedExport(ast) ? { exceljs: '^4.4.0' } : {}),
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
      '@types/bcryptjs': '^2.4.6',
    } as Record<string, string>,
    // exceljs (exportação) puxa traverse@>=0.3 <0.4: a 0.3.10 exige uma versão de which-typed-array que o registro não tem e o npm install falha
    ...(routesNeedExport(ast) ? { overrides: { traverse: '0.3.9' } } : {}),
  }

  files.set('frontend/package.json', JSON.stringify(pkg, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// api-client.ts — wrapper de fetch REST (Seção 4.3 do plano)
// ─────────────────────────────────────────────────────────────────────────────

function generateApiClient(withUser: boolean): string {
  const userImports = withUser ? "import { AsyncLocalStorage } from 'node:async_hooks'\n" : ''
  // com regras de acesso no backend, cada chamada leva os dados do usuário logado (a API aplica as regras da tabela para ele)
  const userBlock = withUser ? `
// Chamadas internas do app (login, gestão de acesso) não passam pelas regras do usuário final: vão marcadas como "sistema".
const g = globalThis as any
const systemCtx: AsyncLocalStorage<boolean> = (g.__mbSystemCtx ||= new AsyncLocalStorage<boolean>())
export function asSystem<T>(fn: () => Promise<T>): Promise<T> {
  return systemCtx.run(true, fn)
}

// Quem está chamando: o usuário da sessão assinada (nunca algo que o navegador mande).
async function userClaims(): Promise<Record<string, unknown>> {
  if (systemCtx.getStore()) return { sys: true }
  try {
    const { getSessionUser } = await import('@/lib/session-server')
    const u = await getSessionUser()
    if (u) return { email: u.email, name: u.name ?? '', attrs: u.attrs ?? {}, groups: u.acc?.gr ?? [] }
  } catch { /* fora de uma requisição: sem usuário */ }
  return {}
}
` : ''
  const claimsExpr = withUser ? 'await userClaims()' : '{}'
  return `import { SignJWT } from 'jose'
${userImports}
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
${userBlock}
// A API Spring só aceita chamadas com um JWT assinado com o segredo compartilhado (JWT_SECRET, em .env.local).
// Só o servidor do frontend conhece esse segredo: as chamadas partem das ações do servidor, nunca do navegador.
async function authHeaders(): Promise<Record<string, string>> {
  const secret = process.env.JWT_SECRET
  if (!secret) return {}
  const claims: Record<string, unknown> = ${claimsExpr}
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(typeof claims.email === 'string' && claims.email ? claims.email : 'mb-frontend')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret))
  return { Authorization: 'Bearer ' + token }
}

async function call(path: string, init: RequestInit = {}, params?: Record<string, any>): Promise<Response> {
  const url = new URL(API_BASE + path)
  if (params) {
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)))
  }
  let res: Response
  try {
    res = await fetch(url.toString(), {
      cache: 'no-store',
      ...init,
      headers: { ...((init.headers as Record<string, string> | undefined) ?? {}), ...(await authHeaders()) },
    })
  } catch {
    throw new Error('Não foi possível conectar ao backend (' + API_BASE + '). Confira se ele está rodando.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text
    try { const j = JSON.parse(text); msg = j.message || j.error || text } catch { /* texto simples */ }
    if (!msg && (res.status === 401 || res.status === 403)) msg = 'O backend recusou a chamada (o JWT_SECRET do frontend precisa ser o mesmo do backend).'
    throw new Error(msg || 'A API respondeu ' + res.status + ' ' + res.statusText)
  }
  return res
}

export async function apiGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await call(path, {}, params)).json()
}

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  return (await call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
}

export async function apiPut<T = any>(path: string, body: any): Promise<T> {
  return (await call(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
}

export async function apiDelete(path: string): Promise<any> {
  await call(path, { method: 'DELETE' })
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// REST Actions por modelo (Seção 4.4 do plano)
// ─────────────────────────────────────────────────────────────────────────────

function generateRestActions(model: ModelNode): string {
  const mn = model.name
  const endpoint = `/api/${model.dbTable}`

  // Compatibility aliases
  const aliases = new Set<string>()
  const candidates = [
    model.dbTable ? (model.dbTable.charAt(0).toUpperCase() + model.dbTable.slice(1).toLowerCase()) : null,
    model.dbTable ? toPascalCase(model.dbTable) : null,
    model.dbTable ? toPascalCase(model.dbTable.toLowerCase()) : null,
    model.name ? toPascalCase(model.name) : null,
  ]
  for (const cand of candidates) {
    if (cand && cand !== mn && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cand)) {
      aliases.add(cand)
    }
  }

  let aliasCode = ''
  if (aliases.size > 0) {
    aliasCode = '\n// Compatibility aliases\n'
    for (const alias of aliases) {
      aliasCode += `export async function get${alias}List(opts?: any) { return get${mn}List(opts) }\n`
      aliasCode += `export async function get${alias}ById(id: string) { return get${mn}ById(id) }\n`
      aliasCode += `export async function get${alias}ByField(field: string, value: any) { return get${mn}ByField(field, value) }\n`
      aliasCode += `export async function create${alias}(formData: any) { return create${mn}(formData) }\n`
      aliasCode += `export async function update${alias}(id: string, formData: any) { return update${mn}(id, formData) }\n`
      aliasCode += `export async function delete${alias}(id: string) { return delete${mn}(id) }\n`
    }
  }

  // tipo de cada coluna, para converter o que o formulário manda no que a API espera
  const columnTypes: Record<string, string> = {}
  for (const f of model.fields) if (!f.dbColumn.includes('.')) columnTypes[f.dbColumn] = (f.dataType || '').toLowerCase().replace(/\(.*\)/, '').trim()

  return `'use server'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'

// Tipo de cada coluna: o formulário manda texto ("199,90", "1.000", "") e a API Spring espera número, null etc.
const columnTypes: Record<string, string> = ${JSON.stringify(columnTypes)}
const INTEGER_TYPES = new Set(['integer', 'int', 'int4', 'int8', 'bigint', 'smallint'])
const NUMERIC_TYPES = new Set([...INTEGER_TYPES, 'number', 'numeric', 'decimal', 'float', 'real', 'double', 'double precision'])

function normalizeBody(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(body ?? {})) {
    if (k.startsWith('$') || k.startsWith('__rsc') || k.startsWith('_next')) continue
    if (v === '' || v === undefined) { out[k] = null; continue }
    if (typeof v === 'string') {
      const type = columnTypes[k] ?? columnTypes[k.toLowerCase()] ?? ''
      if (NUMERIC_TYPES.has(type)) {
        const t = v.trim()
        const n = Number(t.includes(',') ? t.replace(/\\./g, '').replace(',', '.') : t)
        out[k] = Number.isNaN(n) ? v : (INTEGER_TYPES.has(type) ? Math.trunc(n) : n)
        continue
      }
    }
    out[k] = v
  }
  return out
}

// Parâmetros da tela (paginação e ordenação da URL) que não são filtros da API
const UI_PARAMS = new Set(['page', 'limit', 'size', 'sort', 'sort_by', 'sort_order', 'embedded'])

export async function get${mn}List(opts?: { page?: number; limit?: number; search?: string; filters?: Record<string, any> }) {
  const query: Record<string, any> = {}
  if (opts?.filters) {
    Object.entries(opts.filters).forEach(([k, v]) => {
      if (v != null && v !== '' && !UI_PARAMS.has(k)) query[k] = v
    })
  }
  // página pedida explicitamente: devolve só ela (a API Spring conta as páginas a partir de 0)
  if (opts?.page != null) {
    return apiGet('${endpoint}', { ...query, page: Math.max(0, opts.page - 1), size: opts.limit ?? 50 })
  }
  // sem página: traz todos os registros (as telas paginam e ordenam no servidor do Next; a API devolve 50 por página por padrão)
  const all: any[] = []
  for (let page = 0; page < 200; page++) {
    const res: any = await apiGet('${endpoint}', { ...query, page, size: 500 })
    if (Array.isArray(res)) return res
    all.push(...(res?.content ?? []))
    const totalPages = res?.page?.totalPages ?? res?.totalPages ?? 1
    if (page + 1 >= totalPages) break
  }
  return all
}

export async function get${mn}ById(id: string) {
  return apiGet(\`${endpoint}/\${id}\`)
}

export async function get${mn}ByField(field: string, value: any) {
  const res: any = await apiGet('${endpoint}', { [field]: value, size: 500 })
  let items: any[] = []
  if (Array.isArray(res)) items = res
  else if (res && Array.isArray(res.content)) items = res.content
  else if (res && typeof res === 'object') items = [res]

  // Só os registros cuja coluna é IGUAL ao valor pedido (a API filtra por "contém" nos textos). Nunca devolve os demais quando não acha nenhum:
  // uma aba de relacionamento vazia listaria, e o Salvar da tela reatribuiria, registros de outros pais.
  const targetVal = String(value ?? '').trim().toLowerCase()
  return items.filter((item: any) => {
    const val = String(item?.[field] ?? item?.[field.toLowerCase()] ?? item?.[field.toUpperCase()] ?? '').trim().toLowerCase()
    return val === targetVal
  })
}

export async function create${mn}(formData: FormData | Record<string, any>) {
  const body = normalizeBody(formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData)
  return apiPost('${endpoint}', body)
}

export async function update${mn}(id: string, formData: FormData | Record<string, any>) {
  const body = normalizeBody(formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData)
  return apiPut(\`${endpoint}/\${id}\`, body)
}

export async function delete${mn}(id: string) {
  return apiDelete(\`${endpoint}/\${id}\`)
}
${aliasCode}`
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
      jsx: 'react-jsx',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts', '.next/dev/types/**/*.ts'],
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

// mesmo conteúdo do app Node: sem a pasta components/ as classes usadas só nos componentes (galeria, kanban, etc.) não entram no CSS e as telas ficam sem estilo
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.{ts,tsx}'],
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

  const routesRows = ast.routes.map(r => {
    return `| \`${r.path}\` | **${r.title || r.viewSlug}** | \`${r.logicType}\` | \`${r.modelTable}\` |`
  }).join('\n')

  return `<div align="center">

# 💻 ${ast.projectName} — Frontend Web (Next.js 14)

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14%20App%20Router-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Architecture-REST%20Client-blueviolet?style=for-the-badge" alt="REST Client" />
</p>

**Interface moderna de alta produtividade consumindo a API REST Spring Boot de forma desacoplada.**

</div>

---

## 📋 Pré-requisitos

| Item | Requisito Mínimo | Observações |
|---|---|---|
| **Node.js** | 18.17+ ou 20+ (LTS) | Verifique com \`node -v\` |
| **Gerenciador de Pacotes** | npm 9+, yarn 1.22+ ou pnpm 8+ | Recomendado: \`npm\` |
| **Backend Spring Boot** | Rodando em \`http://localhost:${port}\` | Necessário para requisições de dados |

---

## ⚙️ Configuração do Ambiente

O arquivo \`.env.local\` já é gerado pré-configurado para apontar para o backend local:

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:${port}
\`\`\`

> 💡 **Em produção:** Altere \`NEXT_PUBLIC_API_URL\` para a URL pública do seu backend (ex: \`https://api.seudominio.com\`).

---

## 🚀 Como Executar

### 1. Instalar as Dependências
\`\`\`bash
cd frontend
npm install
\`\`\`

### 2. Iniciar o Servidor de Desenvolvimento
\`\`\`bash
npm run dev
\`\`\`
Acesse: **\`http://localhost:3000\`**

### 3. Scripts Disponíveis no \`package.json\`
- \`npm run dev\`: Inicia servidor local em modo watch/HMR
- \`npm run build\`: Cria o build de produção otimizado
- \`npm run start\`: Executa o build de produção localmente
- \`npm run lint\`: Executa verificação de código com ESLint

---

## 🗺️ Rotas e Telas Geradas

Abaixo estão todas as rotas de interface geradas no Next.js App Router:

| Rota | Título da Tela | Tipo de Interface | Tabela Vinculada |
|---|---|---|---|
${routesRows}

---

## 🏛️ Arquitetura do Frontend

\`\`\`
frontend/
├── src/
│   ├── app/                      # App Router (Páginas e Layouts)
│   │   ├── layout.tsx            # Root Layout com Header e Navegação
│   │   ├── page.tsx              # Dashboard / Home
│   │   └── ...                   # Subpastas de cada rota gerada
│   ├── components/               # Componentes UI reutilizáveis
│   │   ├── ui/                   # Botões, Modais, Inputs, Tabelas, Badges
│   │   └── sidebar/              # Navegação lateral expansível
│   └── lib/
│       ├── api-client.ts         # Cliente HTTP centralizado para o Spring Boot
│       └── utils.ts              # Utilitários de formatação e classes Tailwind
├── public/                       # Assets estáticos, ícones e fontes
├── .env.local                    # Configuração local de URL do backend
├── tailwind.config.ts            # Configuração de temas e cores
└── package.json                  # Dependências e scripts
\`\`\`

---

## 🔌 Comunicação com o Backend

Todo o tráfego de dados é intermediado de forma type-safe através do módulo \`src/lib/api-client.ts\`.
Nenhum componente do frontend acessa o banco de dados diretamente.

Exemplo de chamada com tratamento de erros integrado:
\`\`\`typescript
import { apiClient } from '@/lib/api-client'

// Listagem paginada consumindo a API Spring Boot
const data = await apiClient.get('/api/clientes?page=0&size=20')
\`\`\`

---

## 🚢 Deploy para Produção

### Opção 1: Vercel (Recomendado)
A Vercel oferece deploy zero-config para Next.js:
1. Conecte seu repositório Git à plataforma Vercel.
2. Defina a variável de ambiente: \`NEXT_PUBLIC_API_URL=https://sua-api.com\`.
3. O build e deploy serão automáticos.

### Opção 2: Container Docker
Para rodar em cluster Kubernetes ou VPS tradicional:
\`\`\`bash
docker build -t ${ast.projectSlug}-frontend:latest .
docker run -p 3000:3000 ${ast.projectSlug}-frontend:latest
\`\`\`

---

## 🛠️ Resolução de Problemas (Troubleshooting)

| Problema | Causa Provável | Ação Recomendada |
|---|---|---|
| \`Failed to fetch\` ou \`Network Error\` | O backend Spring Boot não está rodando na porta ${port} | Verifique se o backend está ativo em \`http://localhost:${port}/api-docs\` |
| \`CORS error\` no console do navegador | O backend não autorizou \`http://localhost:3000\` | Verifique \`app.cors.allowed-origins\` em \`application.properties\` no backend |
| \`Port 3000 is in use\` | Outro processo local está utilizando a porta 3000 | O Next.js usará a 3001 automaticamente, ou encerre o processo anterior |

---

## 📄 Swagger da API
Acesse a documentação da API em: [http://localhost:${port}/swagger-ui.html](http://localhost:${port}/swagger-ui.html)
`
}
