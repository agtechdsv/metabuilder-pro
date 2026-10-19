// Prepara o app exportado para o teste: instala as dependências (se faltarem) e compila (se nunca foi compilado ou se o código mudou depois da última compilação).
// Uso: node dynamic/prepare-app.mjs   (a pasta do app vem de E2E_CONFIG ou de E2E_REAL_APP_DIR)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const cfg = process.env.E2E_CONFIG && fs.existsSync(process.env.E2E_CONFIG) ? JSON.parse(fs.readFileSync(process.env.E2E_CONFIG, 'utf8')) : {}
const appDir = cfg.appDir || process.env.E2E_REAL_APP_DIR
if (!appDir || !fs.existsSync(path.join(appDir, 'package.json'))) {
  console.error(`Não achei o app exportado em "${appDir}".`)
  process.exit(1)
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: appDir, stdio: 'inherit', shell: true, env: { ...process.env, ...(cfg.dbUrl ? { DATABASE_URL: cfg.dbUrl } : {}) } })
  if (r.status !== 0) { console.error(`Falhou: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1) }
}

/** Data da última alteração do código do app (ignora dependências e a própria compilação). */
function ultimaAlteracao(dir, ignorar = new Set(['node_modules', '.next', '.git', 'db'])) {
  let max = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignorar.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (!e.isDirectory() && /\.(md|log)$/i.test(e.name)) continue
    max = Math.max(max, e.isDirectory() ? ultimaAlteracao(p, ignorar) : fs.statSync(p).mtimeMs)
  }
  return max
}

if (!fs.existsSync(path.join(appDir, 'node_modules'))) {
  console.log('Preparando o app de teste: instalando as dependências (só na primeira vez, pode levar alguns minutos)...')
  run('npm', ['install', '--no-audit', '--no-fund'])
}
const marca = path.join(appDir, '.next', 'BUILD_ID')
if (!fs.existsSync(marca) || ultimaAlteracao(appDir) > fs.statSync(marca).mtimeMs) {
  console.log('Preparando o app de teste: compilando (next build)...')
  run('npx', ['next', 'build'])
} else {
  console.log('App de teste já está compilado e atualizado.')
}
