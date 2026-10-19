// Prepara o app exportado para o teste: instala as dependências (se faltarem) e compila (se nunca foi compilado ou se o código mudou depois da última compilação).
// Node: next build. Java: Maven (mvnw package, com o JDK 21 portátil da IDE) para o backend e next build do frontend apontando para o backend dos testes.
// Uso: node dynamic/prepare-app.mjs   (a pasta do app vem de E2E_CONFIG ou de E2E_REAL_APP_DIR)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { detectarApp } from './lib/app.mjs'
import { envParaApp } from './lib/banco.mjs'

const cfg = process.env.E2E_CONFIG && fs.existsSync(process.env.E2E_CONFIG) ? JSON.parse(fs.readFileSync(process.env.E2E_CONFIG, 'utf8')) : {}
const appDir = cfg.appDir || process.env.E2E_REAL_APP_DIR
const app = detectarApp(appDir)
if (!appDir || !fs.existsSync(path.join(app.frontendDir, 'package.json'))) {
  console.error(`Não achei o app exportado em "${appDir}".`)
  process.exit(1)
}
const backendPort = cfg.backendPort || process.env.E2E_JAVA_BACKEND_PORT || 8090

// o build também usa o banco de teste (o Next pode ler o banco ao pré-renderizar páginas)
const bancoDeTeste = cfg.dbUrl ? envParaApp(cfg.dbUrl, app.pilha) : {}
const jdk = path.join(process.env.USERPROFILE || process.env.HOME || '', '.metabuilder', 'jdk21')
const javaEnv = fs.existsSync(path.join(jdk, 'bin', 'java.exe')) ? { JAVA_HOME: jdk } : {}

const run = (cmd, args, cwd, extra = {}) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ...bancoDeTeste, ...extra } })
  return r.status === 0
}
const must = (ok, o) => { if (!ok) { console.error(`Falhou: ${o}`); process.exit(1) } }

/** Data da última alteração do código (ignora dependências e a própria compilação). */
function ultimaAlteracao(dir, ignorar = new Set(['node_modules', '.next', '.git', 'db', 'target', '.mvn'])) {
  let max = 0
  if (!fs.existsSync(dir)) return 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignorar.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (!e.isDirectory() && /\.(md|log)$/i.test(e.name)) continue
    max = Math.max(max, e.isDirectory() ? ultimaAlteracao(p, ignorar) : fs.statSync(p).mtimeMs)
  }
  return max
}

if (!fs.existsSync(path.join(app.frontendDir, 'node_modules'))) {
  console.log('Preparando o app de teste: instalando as dependências (só na primeira vez, pode levar alguns minutos)...')
  must(run('npm', ['install', '--no-audit', '--no-fund'], app.frontendDir), 'npm install')
}

if (app.pilha === 'java') {
  // backend: compila o jar se não existe ou se o código mudou depois dele
  const target = path.join(app.backendDir, 'target')
  const jar = fs.existsSync(target) ? fs.readdirSync(target).find(n => n.endsWith('.jar') && !n.endsWith('.original')) : undefined
  if (!jar || ultimaAlteracao(app.backendDir) > fs.statSync(path.join(target, jar)).mtimeMs) {
    console.log('Preparando o app de teste: compilando o backend Java (Maven, sem testes; na primeira vez baixa dependências)...')
    const mvnw = process.platform === 'win32' ? '.\\mvnw.cmd' : './mvnw'
    if (!run(mvnw, ['-o', '-q', '-DskipTests', 'package'], app.backendDir, javaEnv)) {
      console.log('Compilação offline falhou (falta alguma dependência no ~/.m2): tentando de novo com internet...')
      must(run(mvnw, ['-q', '-DskipTests', 'package'], app.backendDir, javaEnv), 'mvnw package (backend)')
    }
  } else console.log('Backend Java já está compilado e atualizado.')
}

// frontend (Node: o próprio app; Java: a pasta frontend, apontando para o backend dos testes)
const marca = path.join(app.frontendDir, '.next', 'BUILD_ID')
const apiUrl = app.pilha === 'java' ? { NEXT_PUBLIC_API_URL: `http://localhost:${backendPort}` } : {}
const marcaApi = path.join(app.frontendDir, '.next', '.mb-api-url')
const apiMudou = app.pilha === 'java' && (!fs.existsSync(marcaApi) || fs.readFileSync(marcaApi, 'utf8') !== apiUrl.NEXT_PUBLIC_API_URL)
if (!fs.existsSync(marca) || apiMudou || ultimaAlteracao(app.frontendDir) > fs.statSync(marca).mtimeMs) {
  console.log('Preparando o app de teste: compilando o frontend (next build)...')
  must(run('npx', ['next', 'build'], app.frontendDir, apiUrl), 'next build')
  if (app.pilha === 'java') fs.writeFileSync(marcaApi, apiUrl.NEXT_PUBLIC_API_URL)
} else {
  console.log('Frontend de teste já está compilado e atualizado.')
}
