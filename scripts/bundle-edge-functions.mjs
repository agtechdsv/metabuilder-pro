// Gera versões de ARQUIVO ÚNICO das Edge Functions, para colar no editor do painel do Supabase (que só leva o index.ts, sem a pasta _shared).
//
//   node scripts/bundle-edge-functions.mjs
//
// Saída: supabase/functions-dashboard/<nome>/index.ts (ignorado pelo git; é só para copiar e colar). Pela CLI não precisa disto:
//   supabase functions deploy asaas-checkout asaas-update-subscription asaas-webhook iclub-release partner-payout partner-transfer-validation
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const fnDir = path.join(root, 'supabase', 'functions')
const outDir = path.join(root, 'supabase', 'functions-dashboard')
const FUNCTIONS = ['asaas-checkout', 'asaas-update-subscription', 'asaas-webhook', 'iclub-release', 'partner-payout', 'partner-transfer-validation']

const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const sharedImport = /^import [^;]*?from ["']\.\.\/_shared\/([\w-]+)\.ts["'];?\s*$/gm
const anyImport = /^import [^;]*?from ["']\.\/(\w+)\.ts["'];?\s*$/gm

fs.rmSync(outDir, { recursive: true, force: true })
for (const name of FUNCTIONS) {
  const src = read(path.join(fnDir, name, 'index.ts'))
  const used = new Set([...src.matchAll(sharedImport)].map(m => m[1]))
  if (used.has('iclub')) used.add('pricing') // iclub.ts usa o pricing.ts
  if (used.has('partners')) used.add('partnerCommission') // partners.ts usa o partnerCommission.ts
  const body = src.replace(sharedImport, '').replace(/^\n+/, '')

  const parts = []
  // as importações por URL (deno.land, esm.sh) ficam no topo; o código compartilhado vem logo depois delas
  const urlImports = body.match(/^import [^\n]*from "https?:\/\/[^\n]*\n/gm) || []
  let rest = body
  for (const imp of urlImports) rest = rest.replace(imp, '')
  parts.push(`// ARQUIVO GERADO por scripts/bundle-edge-functions.mjs (inclui supabase/functions/_shared). Não edite aqui: edite o original e gere de novo.\n`)
  parts.push(urlImports.join(''))
  for (const shared of ['pricing', 'iclub', 'partnerCommission', 'partners']) {
    if (!used.has(shared)) continue
    const code = read(path.join(fnDir, '_shared', shared + '.ts')).replace(anyImport, '')
    parts.push(`\n// ===== _shared/${shared}.ts =====\n${code}`)
  }
  parts.push(`\n// ===== ${name}/index.ts =====\n${rest}`)

  const dest = path.join(outDir, name)
  fs.mkdirSync(dest, { recursive: true })
  fs.writeFileSync(path.join(dest, 'index.ts'), parts.join(''))
  console.log('ok', path.relative(root, path.join(dest, 'index.ts')))
}
