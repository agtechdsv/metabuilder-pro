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
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${ast.workspaceName}",
  description: "Portal de aplicações gerado pelo MetaBuilder PRO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={inter.className}>{children}</body>
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
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal Page (/)
// ─────────────────────────────────────────────────────────────────────────────
export function generatePortalPage(ast: WorkspaceAST): string {
  const projectCards = ast.projects.map(p => `
      <a
        href="/${p.slug}"
        className="group flex flex-col gap-4 bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/15 flex items-center justify-center ring-1 ring-indigo-500/30 group-hover:bg-indigo-600/25 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
            </svg>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[var(--muted)] group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">${p.name}</h2>
          ${p.description ? `<p className="text-sm text-[var(--muted)] mt-1">${p.description}</p>` : ''}
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <span className="text-xs bg-indigo-600/15 text-indigo-400 rounded-full px-2.5 py-1 ring-1 ring-indigo-500/25">
            ${p.app.routes.length} tela${p.app.routes.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-[var(--muted)]">/${p.slug}</span>
        </div>
      </a>`).join('\n')

  return `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal — ${ast.workspaceName}",
};

export default function PortalPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <span className="font-semibold text-white">${ast.workspaceName}</span>
          </div>
          <span className="text-xs text-[var(--muted)] bg-[var(--card)] border border-[var(--card-border)] rounded-full px-3 py-1">
            Portal de Aplicações
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Portal de Aplicações
        </div>
        <h1 className="text-5xl font-bold text-white tracking-tight mb-4">${ast.workspaceName}</h1>
        <p className="text-[var(--muted)] text-lg max-w-xl mx-auto">
          Acesse suas aplicações e gerencie seus negócios em um só lugar.
        </p>
      </section>

      {/* Projects Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${projectCards}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)] py-6 text-center">
        <p className="text-xs text-[var(--muted)]">
          Powered by <span className="text-indigo-400 font-medium">MetaBuilder PRO</span>
        </p>
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
