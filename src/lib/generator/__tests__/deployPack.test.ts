import { describe, it, expect } from 'vitest'
import { parseMetaBuilderJSON } from '../parser'
import { generateJavaSpringProject } from '../emitter/java-spring-project'
import { generateNodeProject } from '../emitter/node-project'

/**
 * Pacote de produção de cada entrega (Node e Java, Postgres e Oracle): Dockerfile, compose com HTTPS, .env.example, rota de saúde e DEPLOY.md.
 * Regras que importam: o banco NUNCA entra no compose de produção, nenhum segredo vai escrito nos arquivos, o frontend Java lê a URL do backend
 * ao subir (API_URL) e a rota de saúde é pública.
 */
const f = (id: string, model: string, col: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, ...extra })

const raw = (oracle: boolean) => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [{ id: 'm1', db_table_name: oracle ? 'CLIENTES' : 'clientes', display_name: 'Clientes', db_schema_name: oracle ? 'CRM' : 'public' }],
  fields: [f('a1', 'm1', oracle ? 'ID' : 'id', oracle ? 'NUMBER' : 'uuid', { is_primary_key: true }), f('a2', 'm1', oracle ? 'NOME' : 'nome', oracle ? 'VARCHAR2' : 'text')],
  relations: [], views: [],
})


/** Serviços de um compose (lê o texto: sem depender de uma biblioteca de YAML). */
const services = (compose: string): string[] => {
  const ini = compose.indexOf('services:')
  const fim = compose.search(/^volumes:/m)
  return [...compose.slice(ini, fim).matchAll(/^  ([a-z][a-z0-9-]*):\s*$/gm)].map(m => m[1]).sort()
}
/** Trecho de um serviço (até o próximo). */
const serviceBlock = (compose: string, name: string): string => {
  const linhas = compose.split(/\r?\n/)
  const ini = linhas.findIndex(l => l === `  ${name}:`)
  const resto = linhas.slice(ini + 1)
  const fim = resto.findIndex(l => /^  [a-z][a-z0-9-]*:$/.test(l) || /^[a-z]/.test(l))
  return resto.slice(0, fim < 0 ? resto.length : fim).join('\n')
}

const node = (db: 'postgres' | 'oracle') => generateNodeProject(parseMetaBuilderJSON(raw(db === 'oracle'), db, { backendStack: 'nodejs' } as any))
const java = (db: 'postgres' | 'oracle', extra: Record<string, unknown> = {}) => generateJavaSpringProject(parseMetaBuilderJSON(raw(db === 'oracle'), db, { backendStack: 'java-spring', javaGroupId: 'com.vendas', ...extra } as any))

describe('pacote de produção: Node', () => {
  for (const db of ['postgres', 'oracle'] as const) {
    describe(db, () => {
      const files = node(db)

      it('traz Dockerfile, .dockerignore, compose, Caddyfile, .env.example, rota de saúde e guia', () => {
        for (const n of ['Dockerfile', '.dockerignore', 'docker-compose.prod.yml', 'Caddyfile', '.env.example', 'app/api/health/route.ts', 'DEPLOY.md']) expect(files.has(n), n).toBe(true)
      })

      it('o compose tem só o app e o proxy, SEM banco de dados', () => {
        const c = files.get('docker-compose.prod.yml')!
        expect(services(c)).toEqual(['app', 'proxy'])
        expect(serviceBlock(c, 'app')).toContain('env_file: .env')
        expect(serviceBlock(c, 'proxy')).toContain('- "80:80"')
        expect(serviceBlock(c, 'proxy')).toContain('- "443:443"')
        expect(serviceBlock(c, 'proxy')).toMatch(/depends_on:\s+app:\s+condition: service_healthy/)
        expect(c).not.toMatch(/image: postgres|oracle|gvenzl/i)
      })

      it('Dockerfile: multi-stage, Next em standalone só no build, usuário sem privilégios e health check', () => {
        const d = files.get('Dockerfile')!
        expect(d.match(/^FROM /gm)!.length).toBe(3)
        expect(d).toContain('MB_STANDALONE=1')
        expect(d).toContain('USER app')
        expect(d).toContain('HEALTHCHECK')
        expect(d).toContain('/api/health')
        expect(d).toContain('if [ -f package-lock.json ]') // o ZIP gerado não traz o lock
        expect(d).toContain('CMD ["node", "server.js"]')
      })

      it('next.config liga o standalone só com MB_STANDALONE (next start e testes seguem iguais)', () => {
        expect(files.get('next.config.js')).toContain("process.env.MB_STANDALONE === '1'")
      })

      it('.env.example só tem nomes: sem segredo, sem a chave de sessão gerada', () => {
        const e = files.get('.env.example')!
        expect(e).toMatch(/^MB_SESSION_SECRET=$/m)
        expect(e).toMatch(db === 'oracle' ? /^DB_PASSWORD=$/m : /^DATABASE_URL=$/m)
        expect(e).not.toMatch(/MB_SESSION_SECRET=.+/)
      })

      it('a rota de saúde é pública (o proxy de login não a barra)', () => {
        expect(files.get('app/api/health/route.ts')).toContain("status: 'ok'")
        expect(files.get('proxy.ts') ?? '').toContain("'/api/health'")
      })

      it('o guia cobre Docker Compose, Windows Server e Kubernetes e cita o banco certo', () => {
        const g = files.get('DEPLOY.md')!
        expect(g).toContain('Caminho A')
        expect(g).toContain('Caminho B')
        expect(g).toContain('Caminho C')
        expect(g).toContain(db === 'oracle' ? 'Oracle' : 'PostgreSQL')
        expect(g).toContain(db === 'oracle' ? 'DB_CONNECTION_STRING' : 'DATABASE_URL')
      })
    })
  }
})

describe('pacote de produção: Java', () => {
  for (const db of ['postgres', 'oracle'] as const) {
    describe(db, () => {
      const files = java(db)

      it('traz os Dockerfiles do backend e do frontend, compose, Caddyfile, .env.example, rota de saúde e guia', () => {
        for (const n of ['backend/Dockerfile', 'backend/.dockerignore', 'frontend/Dockerfile', 'frontend/.dockerignore', 'docker-compose.prod.yml', 'Caddyfile', '.env.example', 'frontend/app/api/health/route.ts', 'DEPLOY.md']) expect(files.has(n), n).toBe(true)
      })

      it('o compose de produção é válido, sem banco, com backend interno e só o proxy exposto', () => {
        const c = files.get('docker-compose.prod.yml')!
        expect(services(c)).toEqual(['backend', 'frontend', 'proxy'])
        expect(serviceBlock(c, 'backend')).not.toMatch(/^\s+ports:/m)
        expect(serviceBlock(c, 'frontend')).not.toMatch(/^\s+ports:/m)
        expect(serviceBlock(c, 'proxy')).toMatch(/^\s+ports:/m) // contraprova: o proxy é o único com porta publicada
        expect(serviceBlock(c, 'proxy')).toContain('- "443:443"')
        expect(serviceBlock(c, 'frontend')).toContain('API_URL: http://backend:8080')
        expect(serviceBlock(c, 'frontend')).toMatch(/depends_on:\s+backend:\s+condition: service_healthy/)
        expect(c).not.toMatch(/image: postgres|gvenzl/i)
        // sem senha escrita: tudo vem do .env (e falha com mensagem se faltar)
        expect(serviceBlock(c, 'backend')).toContain('SPRING_DATASOURCE_PASSWORD: ${SPRING_DATASOURCE_PASSWORD:?defina')
      })

      it('o frontend lê a URL do backend ao SUBIR (API_URL), sem recompilar', () => {
        const api = files.get('frontend/lib/api-client.ts')!
        expect(api).toContain('process.env.API_URL || process.env.NEXT_PUBLIC_API_URL')
        expect(files.get('frontend/next.config.ts')).toContain("process.env.MB_STANDALONE === '1'")
      })

      it('o .env.example mostra o formato da conexão do banco certo e não traz segredo', () => {
        const e = files.get('.env.example')!
        expect(e).toContain(db === 'oracle' ? 'jdbc:oracle:thin:@//' : 'jdbc:postgresql://')
        expect(e).toMatch(/^SPRING_DATASOURCE_PASSWORD=$/m)
        expect(e).toMatch(/^JWT_SECRET=$/m)
        expect(e).toMatch(/^MB_SESSION_SECRET=$/m)
      })

      it('o README do frontend não diz mais Next 14 e explica o API_URL', () => {
        const r = files.get('frontend/README.md')!
        expect(r).toContain('Next.js 16')
        expect(r).not.toContain('Next.js 14')
        expect(r).toContain('API_URL')
        expect(r).toContain('DEPLOY.md')
      })

      it('o docker-compose.yml de desenvolvimento avisa que não é para produção', () => {
        expect(java(db, { generateDockerCompose: true, generateDockerfile: true }).get('docker-compose.yml') ?? '').toContain('SÓ PARA DESENVOLVIMENTO')
      })
    })
  }
})
