/**
 * Entrega do projeto (IDE Desktop): gera uma cópia LIMPA do app, de uma vez, para entregar a um cliente, publicar ou rodar em CI.
 * Diferente do Sincronizar (que mantém um repositório Git e mescla as edições do dev), a entrega não leva nada de trabalho:
 *   - sem .git, ramos de sandbox, .metabuilder, lixeira, node_modules, .next, target;
 *   - sem os segredos: .env* fica de fora e vira um .env.example só com os nomes; no backend Java, senha e chaves do application.properties
 *     viram variáveis de ambiente (${NOME:}).
 * O código vem da pasta do projeto (com as edições do dev) ou do Studio (como o gerador faz agora).
 */

export type DeliveryFormat = 'folder' | 'zip'
/** O que a Entrega gera: código-fonte limpo, pacote Docker ou pacote compilado (sem Docker). Pode escolher mais de um. */
export type DeliveryKind = 'source' | 'docker' | 'compiled'

export interface DeliveryOptions {
  kinds: DeliveryKind[]
  format: DeliveryFormat
  /** leva o .env.local e o application.properties como estão (com os segredos). Padrão: não. Só vale para código-fonte e Docker: o pacote compilado nunca leva segredos. */
  includeSecrets: boolean
  /** só no formato pasta: apaga o que já está na pasta de destino (com confirmação e travas) antes de gravar */
  cleanBefore: boolean
}

export const DEFAULT_DELIVERY: DeliveryOptions = { kinds: ['source'], format: 'folder', includeSecrets: false, cleanBefore: false }

/** Pastas de trabalho e de compilação: nunca entram na entrega, em qualquer nível. */
export const DELIVERY_EXCLUDED_DIRS = ['.git', '.metabuilder', '.trash', 'node_modules', '.next', 'target'] as const

const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '')
const base = (p: string) => norm(p).split('/').pop() || ''

/** O arquivo entra na entrega? (caminho relativo à raiz do app) */
export function isDeliverable(relPath: string, includeSecrets: boolean): boolean {
  const parts = norm(relPath).split('/')
  if (parts.some(seg => (DELIVERY_EXCLUDED_DIRS as readonly string[]).includes(seg))) return false
  const name = parts[parts.length - 1]
  if (name === '.DS_Store' || name.endsWith('.log')) return false
  if (!includeSecrets && /^\.env(\..*)?$/.test(name) && name !== '.env.example') return false
  return true
}

const SECRET_KEY = /(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE|CREDENTIAL|CONNECTION|DATABASE_URL|DB_URL)/i

/** .env.local → .env.example: mantém os comentários e os nomes; esvazia o valor do que é segredo ou conexão. */
export function buildEnvExample(text: string): string {
  return text.split(/\r?\n/).map(line => {
    const m = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!m) return line
    return SECRET_KEY.test(m[2]) ? `${m[1]}${m[2]}=` : line
  }).join('\n')
}

/**
 * application.properties: senha, usuário do banco e chaves viram variáveis de ambiente do Spring (${NOME:}), o app continua configurável sem
 * ter o segredo no código. Ex.: spring.datasource.password=abc -> spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:}
 */
export function sanitizeProperties(text: string): string {
  return text.split(/\r?\n/).map(line => {
    const m = /^(\s*)([A-Za-z0-9_.-]+)\s*=(.*)$/.exec(line)
    if (!m || line.trimStart().startsWith('#')) return line
    const key = m[2]
    const secret = /(password|secret|token|api[-_.]?key|private[-_.]?key|credential)/i.test(key) || /^spring\.datasource\.(username|url)$/i.test(key)
    if (!secret) return line
    // já é uma variável de ambiente: mantém o nome e tira o valor padrão (o segredo costuma estar no padrão: ${JWT_SECRET:abc})
    const ph = /^\$\{([A-Za-z0-9_.-]+)(?::.*)?\}$/.exec(m[3].trim())
    if (ph) return `${m[1]}${key}=\${${ph[1]}:}`
    const env = key.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()
    return `${m[1]}${key}=\${${env}:}`
  }).join('\n')
}

export type DeliveryFiles = Map<string, Uint8Array | string>

const asText = (v: Uint8Array | string): string => (typeof v === 'string' ? v : new TextDecoder().decode(v))

/**
 * Aplica as regras da entrega a um conjunto de arquivos (caminho relativo -> conteúdo): tira o que é de trabalho, esvazia os segredos e
 * acrescenta o .env.example no lugar do .env.local. Devolve o novo conjunto e o que foi deixado de fora (para o relatório).
 */
export function applyDelivery(files: DeliveryFiles, opts: Pick<DeliveryOptions, 'includeSecrets'>): { files: DeliveryFiles; skipped: string[]; sanitized: string[] } {
  const out: DeliveryFiles = new Map()
  const skipped: string[] = []
  const sanitized: string[] = []
  for (const [rawPath, content] of files) {
    const rel = norm(rawPath)
    if (!isDeliverable(rel, opts.includeSecrets)) { skipped.push(rel); continue }
    // os .env.example que o gerador deixa no projeto trazem valores de uso local (inclusive a chave JWT): na entrega ficam só os nomes
    if (!opts.includeSecrets && /^\.env\.(example|sample|template)$/.test(base(rel))) {
      const t = asText(content)
      const clean = buildEnvExample(t)
      if (clean !== t) sanitized.push(rel)
      out.set(rel, clean)
      continue
    }
    if (!opts.includeSecrets && base(rel) === 'application.properties') {
      const t = asText(content)
      const clean = sanitizeProperties(t)
      if (clean !== t) sanitized.push(rel)
      out.set(rel, clean)
      continue
    }
    out.set(rel, content)
  }
  if (!opts.includeSecrets) {
    for (const [rawPath, content] of files) {
      const rel = norm(rawPath)
      if (base(rel) !== '.env.local' && base(rel) !== '.env') continue
      if (rel.split('/').some(seg => (DELIVERY_EXCLUDED_DIRS as readonly string[]).includes(seg))) continue
      const exemplo = rel.replace(/(^|\/)\.env(\.local)?$/, '$1.env.example')
      if (!out.has(exemplo)) { out.set(exemplo, buildEnvExample(asText(content))); sanitized.push(exemplo) }
    }
  }
  return { files: out, skipped, sanitized }
}
