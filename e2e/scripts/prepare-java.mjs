// Prepara o app EXPORTADO com backend Java (ejetado pela IDE) para os testes no banco real: instala as dependências do frontend,
// compila o backend (Maven Wrapper + JDK 21 portátil da IDE) e compila o frontend apontando para o backend dos testes.
// Uso: npm run java:prepare   (antes: IDE > Ejetar para uma pasta > Vendas PG > Java Spring Boot)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '..', '.env.real')
const env = Object.fromEntries((fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const root = process.env.E2E_JAVA_DIR || env.E2E_JAVA_DIR || 'C:\\Users\\Alexandre\\Downloads\\Vendas_PG_Java'
const backendPort = process.env.E2E_JAVA_BACKEND_PORT || env.E2E_JAVA_BACKEND_PORT || '8090'
const backend = path.join(root, 'backend')
const frontend = path.join(root, 'frontend')

if (!fs.existsSync(path.join(backend, 'pom.xml')) || !fs.existsSync(path.join(frontend, 'package.json'))) {
  console.error(`Não achei o app Java em ${root} (precisa de backend/ e frontend/).\nEjete o projeto com backend Java para essa pasta ou defina E2E_JAVA_DIR em e2e/.env.real.`)
  process.exit(1)
}
const jdk = path.join(process.env.USERPROFILE || '', '.metabuilder', 'jdk21')
const javaEnv = fs.existsSync(path.join(jdk, 'bin', 'java.exe')) ? { JAVA_HOME: jdk } : {}
const run = (cmd, args, cwd, extraEnv = {}) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ...extraEnv } })
  return r.status === 0
}
const must = (ok, what) => { if (!ok) { console.error(`Falhou: ${what}`); process.exit(1) } }

console.log(`App Java: ${root}`)
if (!fs.existsSync(path.join(frontend, 'node_modules'))) { console.log('\n▶ Instalando dependências do frontend...'); must(run('npm', ['install', '--no-audit', '--no-fund'], frontend), 'npm install (frontend)') }

console.log('\n▶ Compilando o backend (Maven, sem testes)...')
const mvnw = process.platform === 'win32' ? '.\\mvnw.cmd' : './mvnw'
if (!run(mvnw, ['-o', '-q', '-DskipTests', 'package'], backend, javaEnv)) {
  console.log('Compilação offline falhou (falta alguma dependência no ~/.m2): tentando de novo com internet...')
  must(run(mvnw, ['-q', '-DskipTests', 'package'], backend, javaEnv), 'mvnw package (backend)')
}

console.log('\n▶ Compilando o frontend (next build)...')
must(run('npx', ['next', 'build'], frontend, { NEXT_PUBLIC_API_URL: `http://localhost:${backendPort}` }), 'next build (frontend)')
console.log('\n✔ Pronto. Rode: npm run java:test')
