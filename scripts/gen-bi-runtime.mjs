// Embute o motor de BI (src/lib/bi + resolvedores de relação) em src/lib/generator/biRuntimeFiles.generated.ts
// para o gerador copiá-lo, sem alterações, para dentro do app exportado.
// Rode `npm run gen:bi` depois de mexer em qualquer arquivo da lista abaixo (o teste biRuntimeFiles falha se esquecer).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// caminho no app exportado → arquivo de origem (relativo a src/lib). Os imports entre eles são relativos e mantêm a mesma estrutura.
export const BI_RUNTIME_FILES = [
  'bi/widgetPlan.ts',
  'bi/queryBuilder.ts',
  'bi/safeFormula.ts',
  'bi/fkLabel.ts',
  'bi/columnKind.ts',
  'bi/period.ts',
  'bi/widget.ts',
  'bi/groups.ts',
  'bi/scaleLayout.ts',
  'bi/interaction.ts',
  'bi/recordsPlan.ts',
  'bi/shapeResult.ts',
  'schemaResolver.ts',
  'relationPathFinder.ts',
  'relationPaths.ts',
]

export function render() {
  const entries = BI_RUNTIME_FILES.map(rel => {
    const src = readFileSync(join(root, 'src', 'lib', rel), 'utf8').replace(/\r\n/g, '\n')
    return `  ${JSON.stringify('lib/' + rel)}: ${JSON.stringify(src)},`
  })
  return `// ARQUIVO GERADO por scripts/gen-bi-runtime.mjs — não edite. Rode \`npm run gen:bi\`.
// Conteúdo do motor de BI copiado para o app exportado (lib/bi/*, lib/schemaResolver.ts, lib/relationPath*.ts).

export const BI_RUNTIME_FILES: Record<string, string> = {
${entries.join('\n')}
}
`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(root, 'src', 'lib', 'generator', 'biRuntimeFiles.generated.ts'), render())
  console.log(`biRuntimeFiles.generated.ts: ${BI_RUNTIME_FILES.length} arquivos`)
}
