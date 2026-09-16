import { AppAST, ModelNode } from '../ast'
import { generateRoutes } from '../layers/routes'
import { generateActions } from '../layers/actions'
import { generateComponents } from '../layers/components'
import { generateLoginPage, generateDownloadsPage } from './auth-flow'
import { generateBaseFiles } from './base-files'
import { toPascalCase } from '../layers/routes/helpers'


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
  files.set('frontend/lib/api-client.ts', generateApiClient())

  // 6. REST Actions para cada modelo (substituem as Server Actions de banco)
  for (const model of ast.models) {
    const actionContent = generateRestActions(model)
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

  // Mover todos para frontend/ (ignorando config files da raiz que são recriados abaixo)
  for (const [path, content] of tempFiles) {
    if (path.includes('/') || path === 'components.json') {
      files.set(`frontend/${path}`, content)
    }
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

  return `'use server'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'

export async function get${mn}List(opts?: { page?: number; limit?: number; search?: string; filters?: Record<string, any> }) {
  const queryParams: Record<string, any> = {}
  if (opts) {
    if (opts.page != null) queryParams.page = Math.max(0, opts.page - 1)
    if (opts.limit != null) queryParams.size = opts.limit
    if (opts.search) queryParams.search = opts.search
    if (opts.filters) {
      Object.entries(opts.filters).forEach(([k, v]) => {
        if (v != null && v !== '') queryParams[k] = v
      })
    }
  }
  return apiGet('${endpoint}', queryParams)
}

export async function get${mn}ById(id: string) {
  return apiGet(\`${endpoint}/\${id}\`)
}

export async function get${mn}ByField(field: string, value: any) {
  const res: any = await apiGet('${endpoint}', { [field]: value })
  let items: any[] = []
  if (Array.isArray(res)) items = res
  else if (res && Array.isArray(res.content)) items = res.content
  else if (res && typeof res === 'object') items = [res]

  // Failsafe: se a API retornou mais de 1 registro ou todos os registros, filtra pelo campo solicitado
  const targetVal = String(value ?? '').trim().toLowerCase()
  const filtered = items.filter((item: any) => {
    const val = String(item?.[field] ?? item?.[field.toLowerCase()] ?? item?.[field.toUpperCase()] ?? '').trim().toLowerCase()
    return val === targetVal
  })
  return filtered.length > 0 ? filtered : items
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
