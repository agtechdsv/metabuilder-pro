import { writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'

/**
 * Apoio dos testes que importam as ações de servidor GERADAS: escreve, ao lado delas, a camada de acesso a dados gerada
 * (app/actions/access.ts e access-registry.ts), com a sessão trocada por um usuário falso e o sqlPolicy.js (o mesmo do
 * Agente) carregado por um pequeno adaptador. Os módulos `@/lib/...` resolvem para o código-fonte do repositório.
 */
export function writeGeneratedAccess(dir: string, files: Map<string, string>) {
  const access = files.get('app/actions/access.ts')!
    .replace("'@/lib/session-server'", "'./session'")
    .replace("'@/lib/rowPolicy/sqlPolicy'", "'./sqlPolicy'")
  writeFileSync(join(dir, 'access.ts'), access)
  writeFileSync(join(dir, 'access-registry.ts'), files.get('app/actions/access-registry.ts')!)
  const cli = join(__dirname, '..', '..', '..', '..', 'cli', 'sqlPolicy.js').split(sep).join('/')
  writeFileSync(join(dir, 'sqlPolicy.ts'), `import { createRequire } from 'node:module'
const m = createRequire(import.meta.url)(${JSON.stringify(cli)})
export const { applyToSelect, guardCustom, enforceWrite, flagAllowed, PolicyError } = m
`)
}
