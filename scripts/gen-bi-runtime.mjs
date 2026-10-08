// Embute o motor de BI (src/lib/bi + resolvedores de relação) e o acesso a dados por tabela em
// src/lib/generator/biRuntimeFiles.generated.ts para o gerador copiá-los, sem alterações, para dentro do app exportado.
// Rode `npm run gen:bi` depois de mexer em qualquer arquivo das listas abaixo (o teste biRuntimeFiles falha se esquecer).
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
  'bi/access.ts',
  'bi/perf.ts',
  'schemaResolver.ts',
  'relationPathFinder.ts',
  'relationPaths.ts',
]

// Acesso a dados por tabela (permissões e regras por linha do usuário final): caminho no app exportado → arquivo de origem
// (relativo à raiz do repositório). O sqlPolicy.js é o MESMO que o Agente CLI usa; o .d.ts só dá tipos a ele no app exportado.
export const ACCESS_RUNTIME_FILES = [
  ['lib/rowPolicy/policy.ts', 'src/lib/rowPolicy/policy.ts'],
  ['lib/rowPolicy/audit.ts', 'src/lib/rowPolicy/audit.ts'],
  ['lib/rowPolicy/sqlPolicy.js', 'cli/sqlPolicy.js'],
  ['lib/rowPolicy/sqlPolicy.d.ts', 'src/lib/rowPolicy/sqlPolicy.d.ts'],
  // policy.ts usa os tipos e o viewerValue do BI (access.ts → widget.ts → groups.ts)
  ['lib/bi/access.ts', 'src/lib/bi/access.ts'],
  ['lib/bi/widget.ts', 'src/lib/bi/widget.ts'],
  ['lib/bi/groups.ts', 'src/lib/bi/groups.ts'],
]

const read = rel => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')

export function render() {
  const entries = BI_RUNTIME_FILES.map(rel => `  ${JSON.stringify('lib/' + rel)}: ${JSON.stringify(read('src/lib/' + rel))},`)
  const accessEntries = ACCESS_RUNTIME_FILES.map(([dest, src]) => `  ${JSON.stringify(dest)}: ${JSON.stringify(read(src))},`)
  return `// ARQUIVO GERADO por scripts/gen-bi-runtime.mjs — não edite. Rode \`npm run gen:bi\`.
// Conteúdo do motor de BI copiado para o app exportado (lib/bi/*, lib/schemaResolver.ts, lib/relationPath*.ts).

export const BI_RUNTIME_FILES: Record<string, string> = {
${entries.join('\n')}
}

// Acesso a dados por tabela (permissões e regras por linha do usuário final), copiado para o app exportado (lib/rowPolicy/*).
export const ACCESS_RUNTIME_FILES: Record<string, string> = {
${accessEntries.join('\n')}
}
`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(root, 'src', 'lib', 'generator', 'biRuntimeFiles.generated.ts'), render())
  console.log(`biRuntimeFiles.generated.ts: ${BI_RUNTIME_FILES.length} + ${ACCESS_RUNTIME_FILES.length} arquivos`)
}
