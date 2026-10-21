/**
 * Tipos de Entrega e o que cada um leva (parte pura, testável). A leitura da pasta, a compilação e a gravação ficam em deliveryIO.ts e deliveryBuild.ts.
 *
 *   source   — Código-fonte limpo: o app sem arquivos de trabalho, sem segredos e sem os arquivos de subida (Docker/proxy/guia).
 *   docker   — Pacote Docker: o projeto inteiro com Dockerfiles, compose de produção, Caddyfile, .env.example e o manual (DEPLOY.md).
 *   compiled — Pacote compilado, sem Docker: o app já compilado (Next standalone e, no Java, o jar), scripts de início e o manual (LEIA-ME.md).
 *              Um pacote só serve para Windows e Linux: o único binário que depende do sistema (sharp, usado só por next/image) é retirado.
 */
import { applyDelivery, type DeliveryFiles, type DeliveryKind } from './delivery'

export const DELIVERY_KINDS: DeliveryKind[] = ['source', 'docker', 'compiled']

const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '')

/** Arquivos que existem só para subir o app (o Código-fonte limpo não os leva). */
const DEPLOY_FILES = new Set([
  'Dockerfile', '.dockerignore', 'docker-compose.prod.yml', 'Caddyfile', 'DEPLOY.md',
  'backend/Dockerfile', 'backend/.dockerignore', 'frontend/Dockerfile', 'frontend/.dockerignore',
])
export const isDeployFile = (rel: string): boolean => DEPLOY_FILES.has(norm(rel))

/** O projeto tem o pacote de produção (Dockerfile e compose)? Projetos sincronizados antes dele existir precisam sincronizar de novo. */
export function hasDockerPack(files: DeliveryFiles): boolean {
  const has = (n: string) => files.has(n)
  return has('docker-compose.prod.yml') && (has('Dockerfile') || has('frontend/Dockerfile'))
}

/** Pasta de cada tipo dentro do destino. Com um tipo só, os arquivos ficam direto na raiz. */
export function kindFolder(kind: DeliveryKind, kinds: DeliveryKind[]): string {
  if (kinds.length <= 1) return ''
  return kind === 'source' ? 'codigo-fonte' : kind === 'docker' ? 'docker' : 'pacote-compilado'
}

export const kindLabel = (kind: DeliveryKind): string => (kind === 'source' ? 'Código-fonte limpo' : kind === 'docker' ? 'Pacote Docker' : 'Pacote compilado (sem Docker)')

/** Os arquivos de um tipo que é só cópia (source e docker), já sem arquivos de trabalho nem segredos. */
export function filesForCopyKind(raw: DeliveryFiles, kind: 'source' | 'docker', includeSecrets: boolean): { files: DeliveryFiles; skipped: string[]; sanitized: string[] } {
  const r = applyDelivery(raw, { includeSecrets })
  if (kind === 'docker') return r
  const files: DeliveryFiles = new Map()
  for (const [k, v] of r.files) if (!isDeployFile(k)) files.set(k, v)
  return { files, skipped: r.skipped, sanitized: r.sanitized }
}

// ───────────────────────────────────────────────────────────────────────────
// O que o projeto é (para o manual e os scripts)
// ───────────────────────────────────────────────────────────────────────────

export interface ProjectInfo {
  name: string
  slug: string
  stack: 'node' | 'java'
  db: 'oracle' | 'postgres' | 'outro'
  backendPort: number
  hasAccessAdmin: boolean
}

const text = (v: Uint8Array | string | undefined): string => (v === undefined ? '' : typeof v === 'string' ? v : new TextDecoder().decode(v))

/** Lê o que o projeto é a partir dos arquivos da pasta (antes de tirar os segredos). */
export function detectProjectInfo(files: DeliveryFiles, name: string, slug: string): ProjectInfo {
  const stack: ProjectInfo['stack'] = files.has('backend/pom.xml') ? 'java' : 'node'
  const props = text(files.get('backend/src/main/resources/application.properties'))
  const env = text(files.get('.env.local')) + '\n' + text(files.get('.env.example')) + '\n' + text(files.get('frontend/.env.local'))
  const sample = props + '\n' + env
  const db: ProjectInfo['db'] = /jdbc:oracle|DB_CONNECTION_STRING|oracledb/i.test(sample) ? 'oracle' : /jdbc:postgresql|postgres(ql)?:\/\/|DATABASE_URL/i.test(sample) ? 'postgres' : 'outro'
  const port = /^\s*server\.port\s*=\s*(\d+)/m.exec(props)
  return { name, slug, stack, db, backendPort: port ? Number(port[1]) : 8080, hasAccessAdmin: files.has('db/access-control.sql') }
}

// ───────────────────────────────────────────────────────────────────────────
// Scripts de início do pacote compilado
// ───────────────────────────────────────────────────────────────────────────

const CRLF = (s: string) => s.replace(/\r?\n/g, '\r\n')

const cmdLoadEnv = (envPath: string) => `if not exist "${envPath}" (\n  echo Crie o arquivo .env a partir do .env.example e preencha antes de iniciar.\n  exit /b 1\n)\nfor /f "usebackq eol=# tokens=1,* delims==" %%a in ("${envPath}") do set "%%a=%%b"\n`
const shLoadEnv = (envPath: string) => `[ -f "${envPath}" ] || { echo "Crie o arquivo .env a partir do .env.example e preencha antes de iniciar."; exit 1; }
# lê o .env linha a linha, com o valor LITERAL (senha com $, & ou espaço não quebra); ignora comentários e linhas vazias
while IFS= read -r line || [ -n "$line" ]; do
  line=\${line%$(printf '\\r')}
  case "$line" in ''|\\#*) continue ;; esac
  export "\${line%%=*}=\${line#*=}"
done < "${envPath}"
`

/** Scripts de início do pacote: nome do arquivo -> conteúdo. O .env fica na raiz do pacote. */
export function startScripts(info: Pick<ProjectInfo, 'stack' | 'backendPort'>, jarName: string): Map<string, string> {
  const out = new Map<string, string>()
  if (info.stack === 'node') {
    out.set('iniciar.cmd', CRLF(`@echo off\ncd /d "%~dp0"\n${cmdLoadEnv('.env')}if "%PORT%"=="" set "PORT=3000"\nif "%HOSTNAME%"=="" set "HOSTNAME=0.0.0.0"\nnode server.js\n`))
    out.set('iniciar.sh', `#!/bin/sh\ncd "$(dirname "$0")" || exit 1\n${shLoadEnv('.env')}export PORT="\${PORT:-3000}" HOSTNAME="\${HOSTNAME:-0.0.0.0}"\nexec node server.js\n`)
    return out
  }
  out.set('iniciar-backend.cmd', CRLF(`@echo off\ncd /d "%~dp0"\n${cmdLoadEnv('.env')}if "%SERVER_PORT%"=="" set "SERVER_PORT=${info.backendPort}"\nset "JAVA_CMD=java"\nif defined JAVA_HOME if exist "%JAVA_HOME%\\bin\\java.exe" set "JAVA_CMD=%JAVA_HOME%\\bin\\java.exe"\n"%JAVA_CMD%" -jar "backend\\${jarName}"\n`))
  out.set('iniciar-backend.sh', `#!/bin/sh\ncd "$(dirname "$0")" || exit 1\n${shLoadEnv('.env')}export SERVER_PORT="\${SERVER_PORT:-${info.backendPort}}"\nJAVA_CMD=java; [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ] && JAVA_CMD="$JAVA_HOME/bin/java"\nexec "$JAVA_CMD" -jar "backend/${jarName}"\n`)
  out.set('iniciar-frontend.cmd', CRLF(`@echo off\ncd /d "%~dp0"\n${cmdLoadEnv('.env')}if "%API_URL%"=="" set "API_URL=http://localhost:${info.backendPort}"\nif "%PORT%"=="" set "PORT=3000"\nif "%HOSTNAME%"=="" set "HOSTNAME=0.0.0.0"\ncd frontend\nnode server.js\n`))
  out.set('iniciar-frontend.sh', `#!/bin/sh\ncd "$(dirname "$0")" || exit 1\n${shLoadEnv('.env')}export API_URL="\${API_URL:-http://localhost:${info.backendPort}}" PORT="\${PORT:-3000}" HOSTNAME="\${HOSTNAME:-0.0.0.0}"\ncd frontend || exit 1\nexec node server.js\n`)
  return out
}

// ───────────────────────────────────────────────────────────────────────────
// Manual do pacote compilado
// ───────────────────────────────────────────────────────────────────────────

export function compiledReadme(info: ProjectInfo, jarName: string): string {
  const java = info.stack === 'java'
  const dbWord = info.db === 'oracle' ? 'Oracle' : info.db === 'postgres' ? 'PostgreSQL' : 'o banco de dados'
  const dbVars = java
    ? '`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`'
    : info.db === 'oracle' ? '`DB_CONNECTION_STRING`, `DB_USER`, `DB_PASSWORD`' : '`DATABASE_URL`'
  const access = info.hasAccessAdmin
    ? (java ? '\n- **Tabelas de acesso:** rode o arquivo `db/access-control.sql` do projeto no banco, uma vez.' : '\n- **Tabelas de acesso:** com o `.env` pronto, rode uma vez `node scripts/setup-access.mjs` dentro desta pasta (ou o `db/access-control.sql` no banco).')
    : ''
  const tree = java
    ? `\`\`\`
pacote-compilado/
├── backend/${jarName}        ← o backend (Spring Boot)
├── frontend/                  ← o frontend (Next.js já compilado)
├── .env.example               ← os nomes das variáveis
├── iniciar-backend.cmd / .sh  ← sobe o backend
├── iniciar-frontend.cmd / .sh ← sobe o frontend
└── LEIA-ME.md                 ← este manual
\`\`\``
    : `\`\`\`
pacote-compilado/
├── server.js, .next/, node_modules/   ← o app já compilado
├── scripts/, db/                      ← criação das tabelas de acesso
├── .env.example                       ← os nomes das variáveis
├── iniciar.cmd / iniciar.sh           ← sobe o app
└── LEIA-ME.md                         ← este manual
\`\`\``
  const needs = java
    ? '**Java (JRE ou JDK) 21** e **Node.js 22 LTS** instalados e no PATH (se o Java não estiver no PATH, defina \`JAVA_HOME\` no \`.env\`). Não precisa de Maven, npm nem internet.'
    : '**Node.js 22 LTS** instalado e no PATH. Não precisa de npm nem de internet.'
  const run = java
    ? `1. Faça uma cópia do \`.env.example\` com o nome \`.env\` e preencha (uma variável por linha, \`NOME=valor\`, **sem aspas**): ${dbVars}, \`JWT_SECRET\` e \`MB_SESSION_SECRET\`.
2. Suba o **backend**: \`.\\iniciar-backend.cmd\` (Windows, ou duplo clique) ou \`sh iniciar-backend.sh\` (Linux). Aguarde: ele leva alguns segundos.
3. Suba o **frontend**: \`.\\iniciar-frontend.cmd\` (Windows, ou duplo clique) ou \`sh iniciar-frontend.sh\` (Linux).
4. Abra \`http://localhost:3000\` (no próprio servidor Windows, a primeira conexão por \`localhost\` pode levar uns 2 segundos: use \`http://127.0.0.1:3000\`). A verificação de saúde está em \`/api/health\`.`
    : `1. Faça uma cópia do \`.env.example\` com o nome \`.env\` e preencha (uma variável por linha, \`NOME=valor\`, **sem aspas**): ${dbVars} e \`MB_SESSION_SECRET\`.
2. Suba o app: \`.\\iniciar.cmd\` (Windows, ou duplo clique) ou \`sh iniciar.sh\` (Linux).
3. Abra \`http://localhost:3000\` (no próprio servidor Windows, a primeira conexão por \`localhost\` pode levar uns 2 segundos: use \`http://127.0.0.1:3000\`). A verificação de saúde está em \`/api/health\`.`
  const service = java
    ? `- **Linux (systemd):** crie dois serviços, um com \`ExecStart=/usr/bin/java -jar <pasta>/backend/${jarName}\` e outro com \`WorkingDirectory=<pasta>/frontend\` e \`ExecStart=/usr/bin/node server.js\`, ambos com \`EnvironmentFile=<pasta>/.env\`.
- **Windows (NSSM):** instale dois serviços: \`java.exe -jar backend\\${jarName}\` e \`node.exe server.js\` (diretório: \`frontend\`), informando as variáveis na aba *Environment*.`
    : `- **Linux (systemd):** crie um serviço com \`WorkingDirectory=<pasta>\`, \`EnvironmentFile=<pasta>/.env\` e \`ExecStart=/usr/bin/node server.js\`.
- **Windows (NSSM):** \`nssm install ${info.slug} "C:\\Program Files\\nodejs\\node.exe" server.js\`, com esta pasta como diretório e as variáveis na aba *Environment*.`

  return `# ${info.name} — Pacote compilado (sem Docker)

> Gerado pelo MetaBuilder PRO. Este pacote **já está compilado**: serve para servidor **Windows ou Linux**. O banco (${dbWord}) é o da sua empresa: nada aqui cria ou apaga o banco.

## O que tem na pasta

${tree}

## O que o servidor precisa

${needs}${access}

## Como subir

${run}

## Para subir sozinho com o servidor

${service}

Coloque na frente um proxy com HTTPS (Caddy, nginx ou IIS com ARR) apontando para a porta 3000. O \`DEPLOY.md\` da Entrega (código-fonte ou pacote Docker) traz exemplos completos de serviço e a lista do que o TI do cliente precisa providenciar.

## Atualizar para uma versão nova

Pare o app, substitua esta pasta pelo pacote novo **mantendo o seu \`.env\`**, e suba de novo.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| O app não conecta ao banco | Firewall entre o servidor e o banco, ou ${info.db === 'oracle' ? 'nome do serviço Oracle errado (use o do PDB, ex.: `FREEPDB1`)' : 'host, porta ou usuário errados'} |
| Volta sempre para o login | \`MB_SESSION_SECRET\` diferente ou trocado depois do login |
| ${java ? 'O frontend dá erro ao abrir as telas' : 'A porta 3000 já está em uso'} | ${java ? 'O backend não está no ar, ou `JWT_SECRET` diferente nos dois lados' : 'Outro programa usa a porta: defina `PORT` no `.env`'} |
`
}
