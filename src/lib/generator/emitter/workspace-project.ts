import { WorkspaceAST } from '../ast'
import { generatePortalPage, generateWorkspaceGlobalCss, portalProjectEnvName } from '../layers/portal'
import { generateNodeProject } from './node-project'
import { generateJavaSpringProject } from './java-spring-project'

/**
 * Exportação de workspace: um portal (painel público com um card por projeto) + um app independente por projeto.
 *
 *   portal/            Next.js, sem login: só os cards. Cada card abre o endereço do projeto.
 *   apps/<projeto>/    o app completo do projeto (o mesmo que a exportação de um projeto gera): login, banco e sessão próprios.
 *
 * Cada projeto mantém a autenticação e a conexão com o banco independentes, como na plataforma. Os apps rodam em portas
 * diferentes (portal 3000, projetos 3001, 3002...) e o portal aponta para elas (NEXT_PUBLIC_PROJECT_URL_<PROJETO>).
 */

const PORTAL_PORT = 3000

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n'

function portalFiles(ast: WorkspaceAST, ports: Record<string, number>): Map<string, string> {
  const f = new Map<string, string>()
  f.set('package.json', json({
    name: `${ast.workspaceSlug}-portal`,
    version: '1.0.0',
    private: true,
    scripts: { dev: `next dev -p ${PORTAL_PORT}`, build: 'next build', start: `next start -p ${PORTAL_PORT}` },
    dependencies: { next: '16.2.4', react: '19.2.4', 'react-dom': '19.2.4' },
    devDependencies: {
      typescript: '^5.6.0', '@types/node': '^22', '@types/react': '^19', '@types/react-dom': '^19',
      tailwindcss: '^3.4.0', postcss: '^8.4.0', autoprefixer: '^10.4.20',
    },
  }))
  f.set('tsconfig.json', json({
    compilerOptions: {
      target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true,
      jsx: 'preserve', incremental: true, plugins: [{ name: 'next' }], paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }))
  f.set('next.config.js', `/** @type {import('next').NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig\n`)
  f.set('postcss.config.js', `module.exports = {\n  plugins: { tailwindcss: {}, autoprefixer: {} },\n}\n`)
  f.set('tailwind.config.ts', `import type { Config } from 'tailwindcss'\nconst config: Config = {\n  darkMode: 'media',\n  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],\n  theme: { extend: {} },\n  plugins: [],\n}\nexport default config\n`)
  f.set('.npmrc', `legacy-peer-deps=true\nprefer-offline=true\naudit=false\nfund=false\n`)
  f.set('.gitignore', `/node_modules\n/.next\n/out\n.DS_Store\n.env*.local\n.env\n`)
  f.set('.env.local', ast.projects.map(p => `${portalProjectEnvName(p.slug)}="http://localhost:${ports[p.slug]}"`).join('\n') + '\n')
  f.set('app/globals.css', generateWorkspaceGlobalCss())
  f.set('app/layout.tsx', `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(ast.workspaceName)},
  description: "MetaBuilder PRO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang=${JSON.stringify(ast.targetLanguage || 'pt')}>
      <body>{children}</body>
    </html>
  );
}
`)
  f.set('app/page.tsx', generatePortalPage(ast, ports))
  return f
}

/** Dá ao app a porta própria (o portal ocupa a 3000). */
function withPort(pkg: string, port: number): string {
  try {
    const p = JSON.parse(pkg)
    p.scripts = { ...(p.scripts || {}), dev: `next dev -p ${port}`, start: `next start -p ${port}` }
    return json(p)
  } catch {
    return pkg
  }
}

export function generateWorkspaceProject(ast: WorkspaceAST): Map<string, string> {
  const files = new Map<string, string>()

  const ports: Record<string, number> = {}
  ast.projects.forEach((p, i) => { ports[p.slug] = PORTAL_PORT + 1 + i })

  // 1. Portal
  for (const [path, content] of portalFiles(ast, ports)) files.set(`portal/${path}`, content)

  // 2. Um app independente por projeto (Node.js, ou Next.js + Spring Boot)
  for (const project of ast.projects) {
    const port = ports[project.slug]
    const isJava = project.app.backendStack === 'java-spring'
    const sub = isJava ? generateJavaSpringProject(project.app) : generateNodeProject(project.app)
    const front = isJava ? 'frontend/' : ''
    for (const [path, content] of sub) {
      let out = content
      if (path === `${front}package.json`) out = withPort(content, port)
      // o backend Java aceita o frontend na porta deste projeto (e não na 3000)
      else if (isJava && content.includes('localhost:3000')) out = content.split('localhost:3000').join(`localhost:${port}`)
      files.set(`apps/${project.slug}/${path}`, out)
    }
  }

  // 3. Raiz: como instalar e rodar tudo
  const slugs = ast.projects.map(p => p.slug)
  const scripts: Record<string, string> = {
    'install:all': ['portal', ...slugs.map(s => `apps/${s}` + (ast.projects.find(p => p.slug === s)?.app.backendStack === 'java-spring' ? '/frontend' : ''))].map(d => `npm install --prefix ${d}`).join(' && '),
    'dev:portal': 'npm run dev --prefix portal',
  }
  for (const p of ast.projects) {
    scripts[`dev:${p.slug}`] = `npm run dev --prefix apps/${p.slug}${p.app.backendStack === 'java-spring' ? '/frontend' : ''}`
  }
  files.set('package.json', json({ name: ast.workspaceSlug, version: '1.0.0', private: true, scripts }))
  files.set('.gitignore', `node_modules\n.next\n.env*.local\n.DS_Store\n`)
  files.set('README.md', workspaceReadme(ast, ports))
  return files
}

function workspaceReadme(ast: WorkspaceAST, ports: Record<string, number>): string {
  const rows = ast.projects.map(p => `| ${p.name} | \`apps/${p.slug}/\` | ${p.app.dbStack} | http://localhost:${ports[p.slug]} | \`npm run dev:${p.slug}\` |`).join('\n')
  return `# ${ast.workspaceName}

Gerado pelo MetaBuilder PRO. É um **portal** (painel com um card por projeto, sem login) mais **um app independente por projeto**:
cada um tem o login, a sessão e a conexão com o banco dele.

| Projeto | Pasta | Banco | Endereço | Rodar |
|---|---|---|---|---|
| Portal | \`portal/\` | — | http://localhost:${PORTAL_PORT} | \`npm run dev:portal\` |
${rows}

## Como rodar

1. \`npm run install:all\` (instala o portal e cada projeto).
2. Confira a conexão com o banco no \`.env.local\` de cada projeto (\`apps/<projeto>/.env.local\`).
3. Em um terminal por app: \`npm run dev:portal\` e \`npm run dev:<projeto>\`.

Em produção, publique cada app no endereço que quiser e informe esses endereços no portal
(\`portal/.env.local\`, variáveis \`NEXT_PUBLIC_PROJECT_URL_<PROJETO>\`).
`
}
