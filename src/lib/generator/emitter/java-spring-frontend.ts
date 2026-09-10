import { AppAST } from '../ast'

/**
 * java-spring-frontend.ts — Gerador do frontend Next.js para modo java-spring (Módulo 4 — sub)
 *
 * TODO (Fase 2 — Gemini Pro High): Implementar conforme Módulo 4 do plano.
 * - Prefixar todos os arquivos com 'frontend/'
 * - Gerar package.json SEM drivers de banco
 * - Gerar .env.local com NEXT_PUBLIC_API_URL
 * - Gerar src/lib/api-client.ts
 * - Gerar app/actions/{model}.ts com REST actions
 */
export function generateJavaFrontend(ast: AppAST, files: Map<string, string>): void {
  // STUB — será implementado na Fase 2 pelo Gemini Pro High
  files.set('frontend/README.md', `# ${ast.projectName} — Frontend\n\n> TODO: implementar gerador Java frontend.\n`)
}
