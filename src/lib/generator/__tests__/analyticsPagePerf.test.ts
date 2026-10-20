import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// A página de BI do app com backend Java junta as tabelas e calcula as fórmulas no servidor do Next, a cada acesso. Com 20 acessos ao mesmo tempo
// ela levava ~25 s (cada acesso gastava ~1,3 s de CPU): a junção varria a tabela alvo para cada linha e a fórmula recompilava uma RegExp por coluna
// e uma função por linha. Estes testes seguram as três correções.
const fonte = readFileSync(join(__dirname, '..', 'layers', 'routes', 'analytics-page.ts'), 'utf8')

describe('página de BI gerada (caminho sem o motor de BI): custo por acesso', () => {
  it('a junção usa índice por chave, não um filter da tabela alvo para cada linha', () => {
    expect(fonte).toContain('const index = new Map<string, any[]>()')
    expect(fonte).not.toContain('targetData.filter(')
  })

  it('as fórmulas reaproveitam as RegExp e só olham as colunas que aparecem nelas', () => {
    expect(fonte).toContain('rowRegexCache')
    expect(fonte).toContain('keyRelevanceCache')
    expect(fonte).not.toContain("new RegExp(escaped, 'gi')")
  })

  it('a conta simples não compila uma função nova a cada linha (cai no caminho antigo só fora do caso simples)', () => {
    expect(fonte).toContain('evalArithmetic(sanitized)')
    expect(fonte.indexOf('evalArithmetic(sanitized)')).toBeLessThan(fonte.indexOf("new Function('\"use strict\"; return ('"))
  })
})
