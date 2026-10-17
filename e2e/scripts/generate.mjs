// Gera o app de teste (Node + Postgres) a partir do gerador do MetaBuilder, instala as dependências (só na primeira vez) e compila.
// Uso: npm run gen            (app Node + Postgres em e2e/.apps/pg-node)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const name = process.argv[2] || 'pg-node'
const variants = { 'pg-node': { opts: {}, appDir: '' } }
const v = variants[name]
if (!v) { console.error('Variante desconhecida:', name, '— disponíveis:', Object.keys(variants).join(', ')); process.exit(1) }

const genDir = path.join(root, 'e2e', '.apps', name)
const appDir = path.join(genDir, v.appDir)
const run = (cmd, args, cwd, env = {}) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  if (r.status !== 0) { console.error(`Falhou: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1) }
}

console.log(`\n▶ Gerando o app "${name}"...`)
run('npx', ['vitest', 'run', 'src/lib/generator/__tests__/e2eGenerate.test.ts'], root, { E2E_GEN_DIR: genDir, E2E_GEN_OPTS: JSON.stringify(v.opts) })
if (!fs.existsSync(path.join(appDir, 'node_modules'))) { console.log('\n▶ Instalando dependências (só na primeira vez)...'); run('npm', ['install', '--no-audit', '--no-fund'], appDir) }
console.log('\n▶ Compilando (next build)...')
run('npx', ['next', 'build'], appDir)
console.log(`\n✔ App pronto em ${appDir}`)
