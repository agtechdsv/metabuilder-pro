import { RouteNode, AppAST } from '../../ast'

/**
 * Gera a página de um Caso de Uso construído via IA (AI Builder).
 * O componentCode gerado pelo LLM é adaptado para o ambiente local/ejetado do Next.js.
 */
export function generateAiPage(route: RouteNode, ast: AppAST): string {
  let code = (route.componentCode || '').trim()

  // Garante diretiva "use client" no topo
  const hasUseClient = /^['"]use client['"];?/m.test(code)
  if (hasUseClient) {
    code = code.replace(/^['"]use client['"];?\s*/m, '').trim()
  }

  const projectIdVal = ast.projectId || ''

  // Substitui declaração global de PROJECT_ID por constante real
  if (/declare\s+global\s*\{[\s\S]*?\bPROJECT_ID\b[\s\S]*?\}/.test(code)) {
    code = code.replace(
      /declare\s+global\s*\{[\s\S]*?\bPROJECT_ID\b[\s\S]*?\}/g,
      `const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID || '${projectIdVal}';`
    )
  } else if (code.includes('PROJECT_ID') && !code.includes('const PROJECT_ID')) {
    code = `const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID || '${projectIdVal}';\n\n` + code
  }

  return `"use client";\n\n${code}\n`
}
