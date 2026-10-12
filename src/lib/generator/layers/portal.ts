import { WorkspaceAST } from '../ast'

/**
 * portal.ts
 *
 * Gera os arquivos raiz do portal de workspace:
 *  - app/page.tsx             → Dashboard com cards de todos os projetos
 *  - app/layout.tsx           → Layout raiz com branding do workspace
 *  - app/globals.css          → Estilos globais (dark mode, Inter font)
 *  - app/[project]/layout.tsx → Layout de cada projeto (sidebar + header)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout
// ─────────────────────────────────────────────────────────────────────────────
export function generateWorkspaceLayout(ast: WorkspaceAST): string {
  return `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { TopProgressBar } from "@/components/TopProgressBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${ast.workspaceName}",
  description: "Portal de aplicações gerado pelo MetaBuilder PRO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={inter.className}>
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Global CSS
// ─────────────────────────────────────────────────────────────────────────────
export function generateWorkspaceGlobalCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 243 75% 59%; /* Indigo-600 */
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 10% 3.9%;
    --radius: 0.75rem;
    --card-border: 240 5.9% 90%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 243 75% 59%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
    --card-border: 240 3.7% 15.9%;
  }
}

* { box-sizing: border-box; }

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  min-height: 100vh;
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal Page (/)
// ─────────────────────────────────────────────────────────────────────────────
/** Textos do portal nos idiomas de geração. */
const PORTAL_TEXT = {
  pt: { badge: 'Portal de Aplicações', hero: 'Acesse suas aplicações e gerencie seus negócios em um só lugar.', enter: 'Entrar no sistema', screen: 'tela', screens: 'telas' },
  en: { badge: 'Application Portal', hero: 'Access your applications and manage your business in one place.', enter: 'Enter the system', screen: 'screen', screens: 'screens' },
  es: { badge: 'Portal de Aplicaciones', hero: 'Acceda a sus aplicaciones y gestione su negocio en un solo lugar.', enter: 'Entrar al sistema', screen: 'pantalla', screens: 'pantallas' },
} as const

/** Endereço de cada projeto: variável de ambiente do portal (NEXT_PUBLIC_PROJECT_URL_<SLUG>) ou a porta local padrão. */
export function portalProjectEnvName(slug: string): string {
  return 'NEXT_PUBLIC_PROJECT_URL_' + slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

const esc = (v: string) => String(v ?? '').replace(/[{}<>\`$]/g, '')

/**
 * Portal de aplicações do workspace: um painel público (sem login) com um card por projeto. Cada projeto é um app independente,
 * com o login e o banco dele; o card apenas abre o endereço do app.
 */
export function generatePortalPage(ast: WorkspaceAST, ports: Record<string, number> = {}): string {
  const tx = PORTAL_TEXT[(ast.targetLanguage as 'pt' | 'en' | 'es') || 'pt'] || PORTAL_TEXT.pt
  const urlEntries = ast.projects.map(p => `  ${JSON.stringify(p.slug)}: process.env.${portalProjectEnvName(p.slug)} || 'http://localhost:${ports[p.slug] ?? 3001}',`).join('\n')
  const cards = ast.projects.map(p => {
    const n = p.app.routes.length
    return `      <a
        key=${JSON.stringify(p.slug)}
        href={PROJECT_URLS[${JSON.stringify(p.slug)}]}
        className="group flex flex-col gap-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm hover:shadow-xl hover:border-indigo-400 transition-all"
      >
        <div className="w-16 h-16 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">${esc(p.name)}</h2>
          ${p.description ? `<p className="text-sm text-neutral-500 mt-1">${esc(p.description)}</p>` : ''}
          <p className="text-[11px] text-neutral-400 mt-2">${n} ${n !== 1 ? tx.screens : tx.screen}</p>
        </div>
        <span className="mt-auto flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600">
          ${tx.enter}
          <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">→</span>
        </span>
      </a>`
  }).join('\n')

  return `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal — ${esc(ast.workspaceName)}",
};

// cada projeto é um app independente (login e banco próprios): o card abre o endereço dele
const PROJECT_URLS: Record<string, string> = {
${urlEntries}
};

export default function PortalPage() {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-[#050505] flex flex-col">
      <section className="flex-1 max-w-5xl w-full mx-auto px-6 pt-24 pb-10 text-center">
        <span className="inline-block text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full px-5 py-2 shadow-sm">
          ${tx.badge}
        </span>
        <h1 className="mt-10 text-6xl font-black tracking-tight text-neutral-900 dark:text-white">${esc(ast.workspaceName)}</h1>
        <p className="mt-5 text-lg text-neutral-500 max-w-2xl mx-auto">${tx.hero}</p>
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
${cards}
        </div>
      </section>
      <footer className="py-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">Powered by MetaBuilder</p>
      </footer>
    </main>
  );
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Project Layout (app/[project-slug]/layout.tsx)
// ─────────────────────────────────────────────────────────────────────────────
export function generateProjectLayout(projectName: string, projectSlug: string, routes: { path: string; title: string }[]): string {
  const navItems = routes.map(r => {
    const href = `/${projectSlug}${r.path}`
    return `        <a href="${href}" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          ${r.title}
        </a>`
  }).join('\n')

  return `import Link from "next/link";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--card-border)] bg-[var(--card)] flex flex-col">
        <div className="p-5 border-b border-[var(--card-border)]">
          <Link href="/" className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-white transition-colors mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Portal
          </Link>
          <h2 className="font-bold text-white text-sm">${projectName}</h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
${navItems}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
`
}
