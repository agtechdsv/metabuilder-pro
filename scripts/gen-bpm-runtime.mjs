// Embute o núcleo do motor de BPM (cli/bpmCore.js, o MESMO que o Agente CLI usa) e o modelo de e-mail em
// src/lib/generator/bpmRuntimeFiles.generated.ts para o gerador copiá-los, sem alterações, para dentro do app Node exportado.
// Rode `npm run gen:bpm` depois de mexer em qualquer arquivo da lista abaixo (o teste bpmRuntimeFiles falha se esquecer).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// caminho no app exportado → arquivo de origem (relativo à raiz do repositório)
export const BPM_RUNTIME_FILES = [
  ['lib/bpm/core.js', 'cli/bpmCore.js'],
  ['lib/bpm/core.d.ts', 'src/lib/bpm/bpmCore.d.ts'],
  ['lib/bpm/emailTemplates.js', 'cli/emailTemplates.js'],
  ['lib/bpm/emailTemplates.d.ts', 'src/lib/bpm/emailTemplates.d.ts'],
]

const read = rel => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')

export function render() {
  const entries = BPM_RUNTIME_FILES.map(([dest, src]) => `  ${JSON.stringify(dest)}: ${JSON.stringify(read(src))},`)
  return `// ARQUIVO GERADO por scripts/gen-bpm-runtime.mjs — não edite. Rode \`npm run gen:bpm\`.
// Núcleo do motor de BPM (lib/bpm/*) copiado para o app Node exportado.

export const BPM_RUNTIME_FILES: Record<string, string> = {
${entries.join('\n')}
}
`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // só grava se o conteúdo mudou (regravar o mesmo texto mexe na data do arquivo e o Git reavalia, com aviso de CRLF)
  const out = join(root, 'src', 'lib', 'generator', 'bpmRuntimeFiles.generated.ts')
  const next = render()
  const changed = !existsSync(out) || readFileSync(out, 'utf8') !== next
  if (changed) writeFileSync(out, next)
  console.log(`bpmRuntimeFiles.generated.ts: ${BPM_RUNTIME_FILES.length} arquivos (${changed ? 'atualizado' : 'já estava em dia'})`)
}
