import { describe, it, expect } from 'vitest'
import type { DeliveryFiles } from '../delivery'
import { ASSEMBLE_NEXT } from '../deliveryBuild'
import { compiledReadme, deliveryDestination, deliveryFolderName, detectProjectInfo, filesForCopyKind, hasDockerPack, isDeployFile, kindFolder, startScripts } from '../deliveryPackage'

const nodeFiles = (): DeliveryFiles => new Map<string, Uint8Array | string>([
  ['package.json', '{}'], ['app/page.tsx', 'x'], ['.env.local', 'DATABASE_URL="postgres://u:p@h:5432/db"\nMB_SESSION_SECRET="abc"\n'],
  ['Dockerfile', 'FROM node'], ['.dockerignore', 'x'], ['docker-compose.prod.yml', 'services:'], ['Caddyfile', 'x'], ['DEPLOY.md', '# guia'], ['.env.example', 'DATABASE_URL=\n'],
  ['db/access-control.sql', 'create table'], ['node_modules/a/b.js', 'x'],
])
const javaFiles = (): DeliveryFiles => new Map<string, Uint8Array | string>([
  ['backend/pom.xml', '<project/>'], ['backend/src/main/resources/application.properties', 'server.port=8085\nspring.datasource.url=jdbc:oracle:thin:@//h:1521/FREEPDB1\n'],
  ['backend/Dockerfile', 'FROM x'], ['frontend/Dockerfile', 'FROM y'], ['frontend/package.json', '{}'], ['docker-compose.prod.yml', 'services:'], ['.env.example', 'JWT_SECRET=\n'],
])

describe('Entrega: tipos', () => {
  it('um tipo só grava na raiz; vários tipos ganham uma pasta cada', () => {
    expect(kindFolder('source', ['source'])).toBe('')
    expect(kindFolder('compiled', ['compiled'])).toBe('')
    expect(kindFolder('source', ['source', 'docker', 'compiled'])).toBe('codigo-fonte')
    expect(kindFolder('docker', ['source', 'docker'])).toBe('docker')
    expect(kindFolder('compiled', ['docker', 'compiled'])).toBe('pacote-compilado')
  })

  it('Código-fonte limpo não leva os arquivos de subida; o Pacote Docker leva tudo (menos trabalho e segredos)', () => {
    const src = filesForCopyKind(nodeFiles(), 'source', false).files
    const dock = filesForCopyKind(nodeFiles(), 'docker', false).files
    for (const n of ['Dockerfile', '.dockerignore', 'docker-compose.prod.yml', 'Caddyfile', 'DEPLOY.md']) {
      expect(src.has(n), `source sem ${n}`).toBe(false)
      expect(dock.has(n), `docker com ${n}`).toBe(true)
    }
    for (const files of [src, dock]) {
      expect(files.has('app/page.tsx')).toBe(true)
      expect(files.has('.env.example')).toBe(true)
      expect(files.has('.env.local')).toBe(false)
      expect(files.has('node_modules/a/b.js')).toBe(false)
    }
    expect(isDeployFile('frontend/Dockerfile')).toBe(true)
    expect(isDeployFile('app/page.tsx')).toBe(false)
  })

  it('só oferece o pacote Docker se o projeto já tem o pacote de produção (senão: sincronizar de novo)', () => {
    expect(hasDockerPack(nodeFiles())).toBe(true)
    expect(hasDockerPack(javaFiles())).toBe(true)
    const velho = nodeFiles(); velho.delete('docker-compose.prod.yml'); velho.delete('Dockerfile')
    expect(hasDockerPack(velho)).toBe(false)
  })
})

describe('Entrega: o que o projeto é', () => {
  it('Node + Postgres, com tabelas de acesso', () => {
    const i = detectProjectInfo(nodeFiles(), 'Vendas', 'vendas')
    expect(i).toMatchObject({ stack: 'node', db: 'postgres', backendPort: 8080, hasAccessAdmin: true })
  })

  it('Java + Oracle, com a porta do backend lida do application.properties', () => {
    const i = detectProjectInfo(javaFiles(), 'Vendas', 'vendas')
    expect(i).toMatchObject({ stack: 'java', db: 'oracle', backendPort: 8085, hasAccessAdmin: false })
  })

  it('Node + Oracle é reconhecido pelas variáveis DB_*', () => {
    const f = nodeFiles(); f.set('.env.local', 'DB_CONNECTION_STRING="h:1521/XE"\nDB_USER="u"\n')
    f.set('.env.example', 'DB_CONNECTION_STRING=\n')
    expect(detectProjectInfo(f, 'V', 'v').db).toBe('oracle')
  })
})

describe('Pacote compilado: scripts de início', () => {
  it('Node: um script para Windows e um para Linux, que leem o .env e sobem o server.js', () => {
    const s = startScripts({ stack: 'node', backendPort: 8080 }, '')
    expect([...s.keys()].sort()).toEqual(['iniciar.cmd', 'iniciar.sh'])
    expect(s.get('iniciar.cmd')).toContain('for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env")')
    expect(s.get('iniciar.cmd')).toContain('\r\n') // Windows: fim de linha CRLF
    expect(s.get('iniciar.cmd')).toContain('node server.js')
    expect(s.get('iniciar.sh')).toContain('while IFS= read -r line')
    expect(s.get('iniciar.sh')).toContain(String.raw`case "$line" in ''|\#*) continue ;; esac`) // comentário não vira variável
    expect(s.get('iniciar.sh')).toContain(String.raw`printf '\r'`) // tira o CR de um .env editado no Windows
    expect(s.get('iniciar.sh')).not.toContain('. ".env"') // nunca executa o .env como shell: senha com $ ou & não quebra
    expect(s.get('iniciar.sh')).not.toContain('\r')
    expect(s.get('iniciar.sh')!.startsWith('#!/bin/sh')).toBe(true)
  })

  it('Java: backend e frontend separados, com a porta e a URL do backend', () => {
    const s = startScripts({ stack: 'java', backendPort: 8085 }, 'vendas-1.0.0.jar')
    expect([...s.keys()].sort()).toEqual(['iniciar-backend.cmd', 'iniciar-backend.sh', 'iniciar-frontend.cmd', 'iniciar-frontend.sh'])
    expect(s.get('iniciar-backend.sh')).toContain('-jar "backend/vendas-1.0.0.jar"')
    expect(s.get('iniciar-backend.sh')).toContain('JAVA_HOME') // Java fora do PATH: JAVA_HOME (do ambiente ou do .env)
    expect(s.get('iniciar-backend.cmd')).toContain('-jar "backend\\vendas-1.0.0.jar"')
    expect(s.get('iniciar-backend.cmd')).toContain('%JAVA_HOME%')
    expect(s.get('iniciar-backend.sh')).toContain('SERVER_PORT:-8085')
    expect(s.get('iniciar-frontend.sh')).toContain('API_URL:-http://localhost:8085')
    expect(s.get('iniciar-frontend.cmd')).toContain('cd frontend')
  })
})

describe('Pacote compilado: manual', () => {
  it('Node + Postgres: variáveis, requisitos e passos certos', () => {
    const m = compiledReadme(detectProjectInfo(nodeFiles(), 'Vendas', 'vendas'), '')
    expect(m).toContain('# Vendas — Pacote compilado (sem Docker)')
    expect(m).toContain('`DATABASE_URL`')
    expect(m).toContain('**Node.js 22 LTS**')
    expect(m).not.toContain('JRE')
    expect(m).toContain('iniciar.cmd')
    expect(m).toContain('node scripts/setup-access.mjs')
    expect(m).toContain('PostgreSQL')
    expect(m).toContain('/api/health')
  })

  it('Java + Oracle: backend e frontend, jar e o nome do serviço Oracle', () => {
    const m = compiledReadme(detectProjectInfo(javaFiles(), 'Vendas', 'vendas'), 'vendas-1.0.0.jar')
    expect(m).toContain('backend/vendas-1.0.0.jar')
    expect(m).toContain('`SPRING_DATASOURCE_URL`')
    expect(m).toContain('Java (JRE ou JDK) 21')
    expect(m).toContain('iniciar-backend.cmd')
    expect(m).toContain('iniciar-frontend.cmd')
    expect(m).toContain('FREEPDB1')
    expect(m).not.toContain('scripts/setup-access.mjs')
  })
})

describe('Pacote compilado: montagem', () => {
  const ps = ASSEMBLE_NEXT('C:\build', 'C:\pacote', true)

  it('tira do pacote o código-fonte que o Next rastreou e os mapas de origem (fora do node_modules)', () => {
    expect(ps).toContain("'.ts', '.tsx', '.map'")
    expect(ps).toContain('node_modules')
    expect(ps).toContain("*.d.ts") // tipos de dependências ficam
    expect(ps).toContain('Remove-Item')
  })

  it('tira o sharp nativo (um pacote serve para Windows e Linux) e confere que o server.js existe', () => {
    expect(ps).toContain('@img')
    expect(ps).toContain('server.js')
  })

  it('só o app Node leva scripts/ e db/ (tabelas de acesso)', () => {
    expect(ps).toContain("@('scripts', 'db')")
    expect(ASSEMBLE_NEXT('C:\b', 'C:\o', false)).not.toContain("@('scripts', 'db')")
  })
})

describe('Entrega: pasta de destino dentro da pasta-base', () => {
  const BS = String.fromCharCode(92)
  it('cria <base>/<nome da pasta do Sincronizar>, com o separador da base', () => {
    expect(deliveryDestination(`C:${BS}Users${BS}Ana${BS}Downloads`, 'vendas-ora-java')).toBe(`C:${BS}Users${BS}Ana${BS}Downloads${BS}vendas-ora-java`)
    expect(deliveryDestination('/home/ana/entregas/', 'vendas-ora-java')).toBe('/home/ana/entregas/vendas-ora-java')
    expect(deliveryDestination(`C:${BS}x${BS}y${BS}`, 'p')).toBe(`C:${BS}x${BS}y${BS}p`)
  })

  it('se a pasta escolhida já tem esse nome, grava nela mesma (sem repetir o nome)', () => {
    expect(deliveryDestination(`C:${BS}Entregas${BS}Vendas-ORA-Java`, 'vendas-ora-java')).toBe(`C:${BS}Entregas${BS}Vendas-ORA-Java`)
    expect(deliveryDestination(`C:${BS}Entregas${BS}vendas-ora-java${BS}`, 'vendas-ora-java')).toBe(`C:${BS}Entregas${BS}vendas-ora-java`)
  })

  it('o nome vem da pasta do Sincronizar; se não servir, do slug limpo; por último "app"', () => {
    expect(deliveryFolderName('vendas-ora-java', 'vendas-ora')).toBe('vendas-ora-java')
    expect(deliveryFolderName(undefined, 'vendas-ora')).toBe('vendas-ora')
    expect(deliveryFolderName('a b/../c', 'Minha Loja!')).toBe('Minha-Loja')
    expect(deliveryFolderName('', '***')).toBe('app')
  })
})
