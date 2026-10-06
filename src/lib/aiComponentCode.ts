/**
 * Segurança de compilação do código de componente gerado pela IA (AI Builder).
 *
 * Os modelos às vezes escrevem aspas escapadas dentro de atributos JSX (placeholder="TV 50\""), o que é JavaScript
 * válido mas JSX inválido (no JSX a barra invertida não escapa nada). Aqui o código é compilado com o mesmo
 * transpilador do renderizador (Sucrase); se falhar, tenta-se o reparo conhecido antes de desistir.
 */
import { transform } from 'sucrase'

/** Mesma normalização do renderizador: sem a diretiva 'use client'. */
function normalize(code: string): string {
  return code.replace(/^['"]use client['"];?\s*/m, '').trim()
}

export function compileError(code: string): string | null {
  try {
    transform(normalize(code), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'classic' })
    return null
  } catch (e: any) {
    return String(e?.message || e)
  }
}

/**
 * `attr="texto 15\""` → `attr="texto 15&quot;"` (o JSX decodifica a entidade). Só mexe em strings de atributo que
 * contêm \" ; o resto do código fica como está.
 */
export function repairJsxAttributeQuotes(code: string): string {
  return code.replace(/(\s[A-Za-z_][\w:-]*=)"((?:[^"\\\n]|\\.)*)"/g, (match, head: string, value: string) => {
    if (!value.includes('\\"')) return match
    return `${head}"${value.replace(/\\"/g, '&quot;')}"`
  })
}

export type PreparedCode = { ok: true; code: string; repaired: boolean } | { ok: false; error: string }

/** Devolve o código pronto para uso (reparado se preciso) ou o erro de compilação que sobrou. */
export function prepareComponentCode(code: string): PreparedCode {
  const first = compileError(code)
  if (first === null) return { ok: true, code, repaired: false }
  const repairedCode = repairJsxAttributeQuotes(code)
  if (repairedCode !== code && compileError(repairedCode) === null) return { ok: true, code: repairedCode, repaired: true }
  return { ok: false, error: first }
}
