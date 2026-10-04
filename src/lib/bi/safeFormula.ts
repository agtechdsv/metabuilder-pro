/**
 * Avaliador seguro das fórmulas dos widgets de BI (ex.: "itens_pedido.preco_unitario * itens_pedido.quantidade").
 * Substitui o antigo `new Function('r', 'with(r){...}')`, que executava como JavaScript qualquer texto salvo no layout.
 *
 * Aceita apenas: números, campos (com ou sem prefixo "tabela."), + - * / % , parênteses e as funções ROUND, ABS, MIN, MAX.
 * Qualquer outra coisa (identificadores desconhecidos como função, strings, ponto e vírgula...) invalida a fórmula,
 * que passa a valer 0 em todas as linhas.
 */

type Node =
  | { t: 'num'; v: number }
  | { t: 'field'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'fn'; name: string; args: Node[] }

const FUNCTIONS = new Set(['ROUND', 'ABS', 'MIN', 'MAX'])

function tokenize(src: string): string[] | null {
  const tokens: string[] = []
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?|[-+*/%(),])/y
  let pos = 0
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m) return null
    tokens.push(m[1])
    pos = re.lastIndex
  }
  return tokens
}

function parse(tokens: string[]): Node | null {
  let i = 0
  const peek = () => tokens[i]
  const next = () => tokens[i++]

  const expr = (): Node | null => {
    let left = term()
    while (left && (peek() === '+' || peek() === '-')) {
      const op = next()
      const right = term()
      if (!right) return null
      left = { t: 'bin', op, a: left, b: right }
    }
    return left
  }
  const term = (): Node | null => {
    let left = unary()
    while (left && (peek() === '*' || peek() === '/' || peek() === '%')) {
      const op = next()
      const right = unary()
      if (!right) return null
      left = { t: 'bin', op, a: left, b: right }
    }
    return left
  }
  const unary = (): Node | null => {
    if (peek() === '-') { next(); const a = unary(); return a ? { t: 'neg', a } : null }
    if (peek() === '+') { next(); return unary() }
    return primary()
  }
  const primary = (): Node | null => {
    const tok = next()
    if (tok === undefined) return null
    if (tok === '(') {
      const e = expr()
      if (!e || next() !== ')') return null
      return e
    }
    if (/^\d/.test(tok)) return { t: 'num', v: Number(tok) }
    if (/^[A-Za-z_]/.test(tok)) {
      if (peek() === '(') {
        const name = tok.toUpperCase()
        if (!FUNCTIONS.has(name)) return null
        next()
        const args: Node[] = []
        if (peek() !== ')') {
          while (true) {
            const a = expr()
            if (!a) return null
            args.push(a)
            if (peek() === ',') { next(); continue }
            break
          }
        }
        if (next() !== ')') return null
        return { t: 'fn', name, args }
      }
      // campo: o prefixo "tabela." é descartado (as linhas vêm com o nome simples da coluna)
      return { t: 'field', name: tok.includes('.') ? tok.split('.').pop()! : tok }
    }
    return null
  }

  const root = expr()
  return root && i === tokens.length ? root : null
}

function lookup(row: any, name: string): number {
  let raw = row?.[name]
  if (raw === undefined && row) {
    const low = name.toLowerCase()
    const key = Object.keys(row).find(k => k.toLowerCase() === low)
    if (key) raw = row[key]
  }
  const n = Number(raw)
  return raw === null || raw === undefined || raw === '' || !Number.isFinite(n) ? 0 : n
}

function evaluate(node: Node, row: any): number {
  switch (node.t) {
    case 'num': return node.v
    case 'field': return lookup(row, node.name)
    case 'neg': return -evaluate(node.a, row)
    case 'bin': {
      const a = evaluate(node.a, row)
      const b = evaluate(node.b, row)
      switch (node.op) {
        case '+': return a + b
        case '-': return a - b
        case '*': return a * b
        case '/': return b === 0 ? 0 : a / b
        case '%': return b === 0 ? 0 : a % b
      }
      return 0
    }
    case 'fn': {
      const args = node.args.map(a => evaluate(a, row))
      switch (node.name) {
        case 'ROUND': return args.length > 1 ? Number(args[0].toFixed(Math.max(0, Math.min(10, Math.trunc(args[1]))))) : Math.round(args[0] ?? 0)
        case 'ABS': return Math.abs(args[0] ?? 0)
        case 'MIN': return args.length ? Math.min(...args) : 0
        case 'MAX': return args.length ? Math.max(...args) : 0
      }
      return 0
    }
  }
}

/** Compila a fórmula uma vez; a função devolvida calcula o valor de cada linha (sempre um número finito). */
export function compileFormula(formula: string): (row: any) => number {
  const tokens = tokenize(formula || '')
  const ast = tokens ? parse(tokens) : null
  if (!ast) return () => 0
  return (row: any) => {
    const v = evaluate(ast, row)
    return Number.isFinite(v) ? v : 0
  }
}
