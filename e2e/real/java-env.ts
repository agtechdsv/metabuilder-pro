import fs from 'node:fs'
import path from 'node:path'

/**
 * Modo Java: o mesmo suíte real/ (banco crm, robôs, prefixo E2E-) roda contra o app ejetado com backend Spring Boot.
 * Este arquivo só ajusta o ambiente e precisa ser o PRIMEIRO import da configuração (antes de ./guard), porque o guard lê o ambiente ao carregar.
 *  - E2E_REAL_APP_DIR passa a ser a pasta frontend/ do projeto Java (é lá que o Next roda);
 *  - E2E_REAL_JAVA_DIR é a raiz do projeto (backend/ + frontend/): dali sai a conexão com o banco (application.properties);
 *  - portas próprias (frontend 3104, backend 8090) para não colidir com o app do dia a dia (3000/8080).
 */
const envFile = path.join(import.meta.dirname, '..', '.env.real')
const fileEnv: Record<string, string> = {}
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (l.includes('=') && !l.startsWith('#')) fileEnv[l.slice(0, l.indexOf('='))] = l.slice(l.indexOf('=') + 1)
  }
}
const root = process.env.E2E_JAVA_DIR ?? fileEnv.E2E_JAVA_DIR ?? 'C:\\Users\\Alexandre\\Downloads\\Vendas_PG_Java'

export const JAVA = {
  root,
  backendDir: path.join(root, 'backend'),
  frontendDir: path.join(root, 'frontend'),
  backendPort: Number(process.env.E2E_JAVA_BACKEND_PORT ?? fileEnv.E2E_JAVA_BACKEND_PORT ?? 8090),
  frontendPort: Number(process.env.E2E_JAVA_FRONTEND_PORT ?? fileEnv.E2E_JAVA_FRONTEND_PORT ?? 3104),
  jdkHome: path.join(process.env.USERPROFILE ?? '', '.metabuilder', 'jdk21'),
}

process.env.E2E_REAL_JAVA_DIR = root
process.env.E2E_REAL_APP_DIR = JAVA.frontendDir
process.env.E2E_REAL_PORT = String(JAVA.frontendPort)
