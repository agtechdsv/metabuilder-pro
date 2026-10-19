// O app exportado: Node (uma pasta com o Next) ou Java (backend/ Spring Boot + frontend/ Next), e qual banco ele usa.
import fs from 'node:fs'
import path from 'node:path'

/** Pilha do app a partir da pasta escolhida: Java se tem backend/pom.xml e frontend/package.json; senão Node. */
export function detectarApp(appDir) {
  const java = !!appDir && fs.existsSync(path.join(appDir, 'backend', 'pom.xml')) && fs.existsSync(path.join(appDir, 'frontend', 'package.json'))
  return java
    ? { pilha: 'java', raiz: appDir, frontendDir: path.join(appDir, 'frontend'), backendDir: path.join(appDir, 'backend') }
    : { pilha: 'node', raiz: appDir, frontendDir: appDir, backendDir: null }
}

const lerEnv = arquivo => {
  const out = {}
  if (!fs.existsSync(arquivo)) return out
  for (const l of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(l)
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return out
}

/** Banco que o app exportado usa por conta própria (sem a injeção do motor): { tipo, host, banco }. null se não deu para descobrir. */
export function bancoDoApp(app) {
  if (app.pilha === 'java') {
    const f = path.join(app.backendDir, 'src', 'main', 'resources', 'application.properties')
    if (!fs.existsSync(f)) return null
    const m = /^spring\.datasource\.url\s*=\s*jdbc:(postgresql|oracle:thin):(?:@)?(?:\/\/)?([^:/\s]+)(?::(\d+))?\/([^\s?]+)/m.exec(fs.readFileSync(f, 'utf8'))
    return m ? { tipo: m[1] === 'postgresql' ? 'postgres' : 'oracle', host: m[2], banco: m[4] } : null
  }
  const env = lerEnv(path.join(app.frontendDir, '.env.local'))
  if (env.DB_CONNECTION_STRING) {
    const m = /^(?:\/\/)?([^:/]+)(?::(\d+))?\/(.+)$/.exec(env.DB_CONNECTION_STRING)
    return m ? { tipo: 'oracle', host: m[1], banco: m[3] } : null
  }
  if (env.DATABASE_URL) { try { const u = new URL(env.DATABASE_URL); return { tipo: 'postgres', host: u.hostname, banco: u.pathname.replace(/^\//, '') } } catch { return null } }
  return null
}
