import { describe, it, expect } from 'vitest'
import { applyDelivery, buildEnvExample, isDeliverable, sanitizeProperties, type DeliveryFiles } from '../delivery'

describe('entrega: o que entra', () => {
  it('tira as pastas de trabalho e de compilação em qualquer nível', () => {
    for (const p of ['.git/HEAD', '.metabuilder', 'node_modules/x/y.js', 'frontend/node_modules/m.js', '.next/cache/z', 'backend/target/app.jar', '.trash/a.ts', 'a/.git/config']) {
      expect(isDeliverable(p, false), p).toBe(false)
    }
    for (const p of ['package.json', 'app/page.tsx', 'backend/pom.xml', 'backend/src/main/java/A.java', 'frontend/app/layout.tsx', 'db/access-control.sql']) {
      expect(isDeliverable(p, false), p).toBe(true)
    }
  })

  it('segredos: .env* fica de fora (o .env.example fica), a menos que o dev peça para levar', () => {
    expect(isDeliverable('.env.local', false)).toBe(false)
    expect(isDeliverable('frontend/.env.local', false)).toBe(false)
    expect(isDeliverable('.env', false)).toBe(false)
    expect(isDeliverable('.env.production', false)).toBe(false)
    expect(isDeliverable('.env.example', false)).toBe(true)
    expect(isDeliverable('.env.local', true)).toBe(true)
    expect(isDeliverable('npm-debug.log', true)).toBe(false)
  })
})

describe('entrega: segredos', () => {
  it('.env.example mantém comentários e nomes e esvazia segredos e conexões', () => {
    const ex = buildEnvExample('# comentário\nNEXT_PUBLIC_API_URL=http://localhost:8080\nJWT_SECRET=abc123\nMB_SESSION_SECRET="xyz"\nDATABASE_URL=postgres://u:p@h/db\nPORT=3000\n')
    expect(ex).toBe('# comentário\nNEXT_PUBLIC_API_URL=http://localhost:8080\nJWT_SECRET=\nMB_SESSION_SECRET=\nDATABASE_URL=\nPORT=3000\n')
  })

  it('application.properties: senha, usuário, url do banco e chaves viram variáveis de ambiente', () => {
    const src = '# senha antiga: x\nserver.port=8080\nspring.datasource.url=jdbc:postgresql://h:5432/crm\nspring.datasource.username=crm\nspring.datasource.password=crm123\napp.jwt.secret=abcdef\nspring.jackson.property-naming-strategy=SNAKE_CASE\n'
    const out = sanitizeProperties(src)
    expect(out).toContain('server.port=8080')
    expect(out).toContain('spring.datasource.url=${SPRING_DATASOURCE_URL:}')
    expect(out).toContain('spring.datasource.username=${SPRING_DATASOURCE_USERNAME:}')
    expect(out).toContain('spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:}')
    expect(out).toContain('app.jwt.secret=${APP_JWT_SECRET:}')
    expect(out).toContain('spring.jackson.property-naming-strategy=SNAKE_CASE')
    expect(out).toContain('# senha antiga: x')
    expect(out).not.toMatch(/crm123|abcdef/)
  })

  it('variável de ambiente com valor padrão: o nome fica e o padrão (onde o segredo costuma estar) sai', () => {
    expect(sanitizeProperties('jwt.secret=${JWT_SECRET:abc123}\n')).toBe('jwt.secret=${JWT_SECRET:}\n')
    expect(sanitizeProperties('spring.datasource.password=${DB_PASSWORD}\n')).toBe('spring.datasource.password=${DB_PASSWORD:}\n')
  })

  it('o .env.example do gerador (com valores de uso local) também é esvaziado', () => {
    const r = applyDelivery(new Map([['backend/.env.example', 'JWT_SECRET=segredo-real\nSERVER_PORT=8080\nSPRING_DATASOURCE_PASSWORD=pw\n']]), { includeSecrets: false })
    expect(String(r.files.get('backend/.env.example'))).toBe('JWT_SECRET=\nSERVER_PORT=8080\nSPRING_DATASOURCE_PASSWORD=\n')
  })
})

describe('entrega: conjunto de arquivos', () => {
  const arquivos = (): DeliveryFiles => new Map<string, Uint8Array | string>([
    ['package.json', '{}'],
    ['app/page.tsx', 'x'],
    ['.env.local', 'JWT_SECRET=abc\nPORT=3000\n'],
    ['node_modules/a/b.js', 'x'],
    ['.git/HEAD', 'ref'],
    ['.metabuilder', 'x'],
    ['backend/src/main/resources/application.properties', 'spring.datasource.password=segredo\nserver.port=8080\n'],
    ['frontend/.env.local', 'JWT_SECRET=abc\nNEXT_PUBLIC_API_URL=http://localhost:8080\n'],
    ['frontend/app/layout.tsx', 'x'],
  ])

  it('sem segredos: tira o que é de trabalho, troca .env.local por .env.example e sanitiza o application.properties', () => {
    const r = applyDelivery(arquivos(), { includeSecrets: false })
    const nomes = [...r.files.keys()].sort()
    expect(nomes).toEqual(['.env.example', 'app/page.tsx', 'backend/src/main/resources/application.properties', 'frontend/.env.example', 'frontend/app/layout.tsx', 'package.json'])
    expect(String(r.files.get('.env.example'))).toBe('JWT_SECRET=\nPORT=3000\n')
    expect(String(r.files.get('frontend/.env.example'))).toBe('JWT_SECRET=\nNEXT_PUBLIC_API_URL=http://localhost:8080\n')
    expect(String(r.files.get('backend/src/main/resources/application.properties'))).toContain('${SPRING_DATASOURCE_PASSWORD:}')
    expect(r.skipped).toEqual(expect.arrayContaining(['.env.local', 'node_modules/a/b.js', '.git/HEAD', '.metabuilder', 'frontend/.env.local']))
  })

  it('com segredos: leva o .env.local e o application.properties como estão, mas continua sem o trabalho', () => {
    const r = applyDelivery(arquivos(), { includeSecrets: true })
    expect(r.files.has('.env.local')).toBe(true)
    expect(r.files.has('.env.example')).toBe(false)
    expect(String(r.files.get('backend/src/main/resources/application.properties'))).toContain('spring.datasource.password=segredo')
    expect(r.files.has('.git/HEAD')).toBe(false)
    expect(r.files.has('node_modules/a/b.js')).toBe(false)
  })
})
