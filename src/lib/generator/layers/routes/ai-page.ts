import { RouteNode, AppAST } from '../../ast'
import { prepareComponentCode } from '../../../aiComponentCode'

/**
 * Gera a página de um Caso de Uso construído via IA (AI Builder).
 * O componentCode gerado pelo LLM é adaptado para o ambiente local/ejetado do Next.js.
 */
export function generateAiPage(route: RouteNode, ast: AppAST): string {
  let code = (route.componentCode || '').trim()

  // O código da IA pode vir com JSX inválido (ex.: aspas escapadas dentro de um atributo): a plataforma repara ao renderizar,
  // então a exportação repara igual. Se ainda assim não compilar, a tela mostra o erro em vez de derrubar o build do app inteiro.
  const prepared = prepareComponentCode(code)
  if (!prepared.ok) {
    const title = JSON.stringify(String(route.title || route.viewSlug))
    const detail = JSON.stringify(prepared.error.slice(0, 600))
    return [
      "'use client'",
      "",
      "export default function AiViewError() {",
      "  return (",
      "    <div className=\"p-8 m-4 rounded-2xl border border-red-200 bg-red-50 text-red-700\">",
      "      <h3 className=\"font-bold text-sm mb-2\">{" + title + "}</h3>",
      "      <pre className=\"text-xs whitespace-pre-wrap font-mono\">{" + detail + "}</pre>",
      "    </div>",
      "  )",
      "}",
      "",
    ].join(String.fromCharCode(10))
  }
  code = prepared.code

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

  // Em bancos relacionais locais (PostgreSQL, MySQL, etc.), limpa referências RLS de project_id
  if (ast.dbStack !== 'supabase') {
    code = code.replace(/\.eq\(\s*['"]project_id['"]\s*,\s*[^)]+\)/g, '')
    code = code.replace(/\bproject_id\s*:\s*PROJECT_ID\s*,?/g, '')
  }

  return `"use client";\n\n${code}\n`
}
