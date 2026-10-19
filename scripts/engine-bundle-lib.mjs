// Monta o pacote do motor de testes dinâmico: os arquivos que a IDE grava na pasta do usuário (.metabuilder/testes/engine).
// Usado por scripts/build-engine-bundle.mjs (gera src/lib/testing/engineBundle.generated.ts) e pelo teste que confere que o arquivo gerado está em dia.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const OUT = path.join(ROOT, 'src', 'lib', 'testing', 'engineBundle.generated.ts')

/** caminho no pacote (igual ao do repositório, para os imports relativos continuarem valendo) ← arquivo de origem */
export const ENGINE_FILES = {
  'e2e/package.json': 'e2e/dynamic/engine.package.json',
  'e2e/playwright.dynamic.config.ts': 'e2e/playwright.dynamic.config.ts',
  'e2e/dynamic/ide-reporter.ts': 'e2e/dynamic/ide-reporter.ts',
  'e2e/dynamic/make-pdf.mjs': 'e2e/dynamic/make-pdf.mjs',
  'e2e/dynamic/prepare-app.mjs': 'e2e/dynamic/prepare-app.mjs',
  'e2e/dynamic/db-tool.mjs': 'e2e/dynamic/db-tool.mjs',
  'e2e/dynamic/global-setup.ts': 'e2e/dynamic/global-setup.ts',
  'e2e/dynamic/global-teardown.ts': 'e2e/dynamic/global-teardown.ts',
  'e2e/dynamic/lib/config.ts': 'e2e/dynamic/lib/config.ts',
  'e2e/dynamic/lib/db.ts': 'e2e/dynamic/lib/db.ts',
  'e2e/dynamic/lib/guard.ts': 'e2e/dynamic/lib/guard.ts',
  'e2e/dynamic/lib/acesso.mjs': 'e2e/dynamic/lib/acesso.mjs',
  'e2e/dynamic/lib/seguranca.ts': 'e2e/dynamic/lib/seguranca.ts',
  'e2e/dynamic/lib/login.ts': 'e2e/dynamic/lib/login.ts',
  'e2e/dynamic/tests/manifest.spec.ts': 'e2e/dynamic/tests/manifest.spec.ts',
  'src/lib/testing/plan.ts': 'src/lib/testing/plan.ts',
  'src/lib/testing/manifestTypes.ts': 'src/lib/testing/manifestTypes.ts',
  'src/lib/testing/results.ts': 'src/lib/testing/results.ts',
}

/** Conteúdo (quebras de linha sempre LF, para o pacote ser igual no Windows e no servidor). null se o código-fonte do motor não está aqui. */
export function readEngineFiles() {
  const files = {}
  for (const [dest, src] of Object.entries(ENGINE_FILES)) {
    const f = path.join(ROOT, src)
    if (!fs.existsSync(f)) return null
    files[dest] = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  }
  return files
}

export function buildBundleSource() {
  const files = readEngineFiles()
  if (!files) return null
  const hash = crypto.createHash('sha256')
  for (const k of Object.keys(files).sort()) hash.update(k).update(files[k])
  const version = hash.digest('hex').slice(0, 10)
  return `// GERADO por scripts/build-engine-bundle.mjs (roda no "npm run build"). Não edite: mude os arquivos de origem e gere de novo.
// Pacote do motor de testes dinâmico que a IDE grava em .metabuilder/testes/engine.
export const ENGINE_VERSION = ${JSON.stringify(version)}
export const ENGINE_FILES: Record<string, string> = ${JSON.stringify(files, null, 1)}
`
}
