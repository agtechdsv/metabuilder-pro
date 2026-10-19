// Prepara o app EXPORTADO de verdade (ejetado pela IDE) para os testes no banco real: confere a pasta, instala as dependências e compila.
// Uso: npm run real:prepare   (antes: IDE > Ejetar para uma pasta > Vendas PG > Node + Postgres (crm) > login via banco > gestão de acesso)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const oracle = process.argv[2] === 'oracle'
const envFile = path.join(here, '..', oracle ? '.env.oracle' : '.env.real')
const env = Object.fromEntries((fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const appDir = oracle
  ? (process.env.E2E_ORA_APP_DIR || env.E2E_ORA_APP_DIR || 'C:\\Users\\Alexandre\\Downloads\\Vendas_ORA_Node')
  : (process.env.E2E_REAL_APP_DIR || env.E2E_REAL_APP_DIR || 'C:\\AgTech\\Apps\\e2e-vendas-pg')

if (!fs.existsSync(path.join(appDir, 'package.json'))) {
  console.error(`Não achei o app exportado em ${appDir}.\nEjete o projeto ${oracle ? 'Vendas ORA' : 'Vendas PG'} para essa pasta (IDE > Ejetar para uma pasta) ou defina ${oracle ? 'E2E_ORA_APP_DIR em e2e/.env.oracle' : 'E2E_REAL_APP_DIR em e2e/.env.real'}.`)
  process.exit(1)
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: appDir, stdio: 'inherit', shell: true })
  if (r.status !== 0) { console.error(`Falhou: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1) }
}
console.log(`App exportado: ${appDir}`)
if (!fs.existsSync(path.join(appDir, 'node_modules'))) { console.log('\n▶ Instalando dependências...'); run('npm', ['install', '--no-audit', '--no-fund']) }
console.log('\n▶ Compilando (next build)...')
run('npx', ['next', 'build'])
console.log('\n✔ Pronto. Rode: npm run ' + (oracle ? 'ora:test' : 'real:test') + '')
