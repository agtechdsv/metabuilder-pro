import fs from 'node:fs'
import path from 'node:path'

/**
 * Configuração do motor de testes dinâmico. Duas origens:
 *  - E2E_CONFIG = caminho de um JSON (é o que a IDE grava para o motor instalado na pasta do usuário);
 *  - sem ela, o modo do repositório: variáveis E2E_REAL_* e o arquivo e2e/.env.real (criado por `npm run real:robot`).
 */
export interface EngineConfig {
  /** pasta do app exportado a testar (a que tem package.json e .env.local) */
  appDir: string
  port: number
  /** conexão com o banco de TESTE (o mesmo que o app exportado usa): é nele que o motor confere que nada foi alterado */
  dbUrl: string
  /** usuário do app que o robô usa para entrar */
  user: string
  password: string
  /** permite banco que não é desta máquina (só com o consentimento do cliente, dado na IDE) */
  allowRemote: boolean
  /** bancos permitidos; vazio = o próprio banco de dbUrl */
  allowedDbs: string[]
  /** pasta onde o app grava as exportações durante o teste */
  exportDir: string
}

const engineRoot = path.join(import.meta.dirname, '..', '..')

function parseEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.includes('=') || line.startsWith('#')) continue
    out[line.slice(0, line.indexOf('='))] = line.slice(line.indexOf('=') + 1)
  }
  return out
}

export function loadConfig(): EngineConfig {
  const exportDir = path.join(engineRoot, '.apps', 'exports-dynamic')
  const file = process.env.E2E_CONFIG
  if (file) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<EngineConfig>
    return { appDir: '', port: 3102, dbUrl: '', user: '', password: '', allowRemote: false, allowedDbs: [], exportDir, ...j }
  }
  const env = parseEnv(path.join(engineRoot, '.env.real'))
  const val = (k: string, d = '') => process.env[k] ?? env[k] ?? d
  return {
    appDir: val('E2E_REAL_APP_DIR', ''),
    port: Number(val('E2E_REAL_PORT', '3102')),
    dbUrl: val('E2E_REAL_PG_URL'),
    user: val('E2E_REAL_USER'),
    password: val('E2E_REAL_PASSWORD'),
    allowRemote: false,
    allowedDbs: val('E2E_REAL_ALLOWED_DBS', 'crm').split(',').map(s => s.trim()).filter(Boolean),
    exportDir,
  }
}

export const CONFIG = loadConfig()
