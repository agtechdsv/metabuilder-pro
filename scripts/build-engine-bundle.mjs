// Gera src/lib/testing/engineBundle.generated.ts a partir dos arquivos do motor (e2e/dynamic + src/lib/testing).
// Roda antes do build (prebuild). Se o código-fonte do motor não estiver no checkout, mantém o arquivo já gerado.
import fs from 'node:fs'
import { OUT, buildBundleSource } from './engine-bundle-lib.mjs'

const src = buildBundleSource()
if (!src) {
  console.log('[engine-bundle] código-fonte do motor não encontrado; mantendo o pacote já gerado.')
} else if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== src) {
  fs.writeFileSync(OUT, src)
  console.log('[engine-bundle] pacote do motor atualizado.')
} else {
  console.log('[engine-bundle] pacote do motor já está em dia.')
}
