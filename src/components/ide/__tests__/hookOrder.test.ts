import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * React #310 ("Rendered more hooks than during the previous render"): um hook chamado DEPOIS de um `return` antecipado do componente.
 * Passa despercebido enquanto o componente nasce já aberto, e quebra (tela branca / "This page couldn't load") quando ele passa a nascer
 * fechado e abrir depois. Foi o que aconteceu com a janela da IDE Local. Este teste olha os componentes da IDE: nenhum hook no nível do
 * componente (2 espaços de recuo) pode vir depois de um `if (...) return` também no nível do componente.
 */
const DIR = join(__dirname, '..')
const arquivos = readdirSync(DIR).filter(f => f.endsWith('.tsx')).map(f => ({ nome: f, texto: readFileSync(join(DIR, f), 'utf8') }))

/** Cada função de componente exportada: do `export function X(` até o `}` na coluna 0. */
function componentes(texto: string): Array<{ nome: string; corpo: string }> {
  const out: Array<{ nome: string; corpo: string }> = []
  const re = /^export function (\w+)\(/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    const fim = texto.indexOf('\n}\n', m.index)
    out.push({ nome: m[1], corpo: texto.slice(m.index, fim < 0 ? texto.length : fim) })
  }
  return out
}

describe('componentes da IDE: ordem dos hooks', () => {
  for (const { nome, texto } of arquivos) {
    for (const c of componentes(texto)) {
      it(`${nome} › ${c.nome}: nenhum hook depois de um return antecipado`, () => {
        const linhas = c.corpo.split('\n')
        // return antecipado no nível do componente: "  if (...) {" seguido de "return" ou "  if (...) return"
        let primeiroReturn = -1
        for (let i = 1; i < linhas.length; i++) {
          if (/^ {2}if \(.*\) return\b/.test(linhas[i])) { primeiroReturn = i; break }
          if (/^ {2}if \(.*\) \{\s*$/.test(linhas[i]) && /^ {4}return\b/.test(linhas[i + 1] ?? '')) { primeiroReturn = i; break }
        }
        if (primeiroReturn < 0) return
        const depois = linhas.slice(primeiroReturn + 1)
        const hooks = depois.filter(l => /^ {2}(const .*= )?(React\.)?use[A-Z]\w*\(/.test(l) && !/^ {2}return\b/.test(l))
        expect(hooks, `${c.nome} chama hook depois do return antecipado da linha ${primeiroReturn + 1}`).toEqual([])
      })
    }
  }
})
