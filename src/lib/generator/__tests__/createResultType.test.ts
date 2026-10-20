import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// No Oracle (e no MySQL) a ação de criar não devolve o registro (retorna void). As páginas geradas testam o resultado (`if (res) ...`),
// então ele precisa ser tipado como `any`: sem isso o `next build` do app exportado falha com "An expression of type 'void' cannot be tested for truthiness".
describe('páginas geradas: resultado da ação de criar', () => {
  const dir = join(__dirname, '..', 'layers', 'routes')
  const files = readdirSync(dir).filter(f => f.endsWith('-page.ts'))

  it.each(files)('%s não testa o resultado de create sem tipá-lo', file => {
    const src = readFileSync(join(dir, file), 'utf8')
    expect(src).not.toMatch(/const (res|result) = await create\$\{mn\}\(/)
  })
})
