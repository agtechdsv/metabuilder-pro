import { AppAST } from '../ast'
import { T } from '../layers/design-tokens'
import { getGeneratorDictionary } from '../i18n'
import { rlsAttrColumns } from '../../bi/access'

function toCamel(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (m) => m.toLowerCase())
}

/** Código de lib/session.ts do app exportado: sessão assinada com HMAC-SHA256 (Web Crypto, serve o proxy e o servidor). */
export const SESSION_LIB_SOURCE = `// ARQUIVO GERADO pelo MetaBuilder — sessão assinada (HMAC-SHA256).
// O cookie "mb_session" guarda os dados do usuário e uma assinatura feita com MB_SESSION_SECRET: sem o segredo não dá
// para forjar nem alterar a sessão (antes o cookie era só o e-mail em base64, que qualquer pessoa podia montar).

export const SESSION_COOKIE = 'mb_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export interface SessionUser {
  email: string
  name?: string
  /** colunas do cadastro do usuário que as regras de acesso do BI consultam */
  attrs?: Record<string, string>
  /** expira em (segundos desde 1970) */
  exp: number
}

const enc = new TextEncoder()

function toB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
}

function fromB64Url(str: string): ArrayBuffer {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : ''
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer as ArrayBuffer
}

async function hmacKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const secret = process.env.MB_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('MB_SESSION_SECRET não configurado (mínimo 16 caracteres). Defina a variável de ambiente do app.')
  }
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

export async function signSession(user: Omit<SessionUser, 'exp'>, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const payload: SessionUser = { ...user, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const body = toB64Url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey('sign'), enc.encode(body))
  return body + '.' + toB64Url(sig)
}

/** Devolve o usuário se a assinatura confere e a sessão não expirou; senão null. */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  try {
    // crypto.subtle.verify compara a assinatura em tempo constante
    const ok = await crypto.subtle.verify('HMAC', await hmacKey('verify'), fromB64Url(parts[1]), enc.encode(parts[0]))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(parts[0]))) as SessionUser
    if (!payload || typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}
`

/** Código de lib/session-server.ts: lê a sessão verificada do cookie da requisição (ações de servidor e rotas). */
export const SESSION_SERVER_SOURCE = `// ARQUIVO GERADO pelo MetaBuilder — usuário da sessão assinada, para uso em ações de servidor e rotas.
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession, type SessionUser } from './session'

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}
`

export function generateLoginPage(ast: AppAST, files: Map<string, string>, opts: { extraAttrColumns?: string[] } = {}) {
  const d = getGeneratorDictionary(ast.targetLanguage)
  // colunas do cadastro do usuário que as regras de acesso do BI pedem: o login as grava na sessão assinada
  const attrColumns = [...new Set([
    ...ast.routes.flatMap(r => rlsAttrColumns(r.analyticsConfig?.rls)),
    ...(opts.extraAttrColumns || []),
  ])]
  files.set('lib/session.ts', SESSION_LIB_SOURCE)
  files.set('lib/session-server.ts', SESSION_SERVER_SOURCE)

  // trecho do login que assina a sessão; sem o segredo configurado, o login responde "config" em vez de quebrar
  const signBlock = (nameExpr: string, attrsExpr: string) => `    let sessionToken: string
    try {
      sessionToken = await signSession({ email, name: ${nameExpr}, attrs: ${attrsExpr} })
    } catch (e) {
      console.error('Sessão: ', e)
      return NextResponse.redirect(new URL('/login?error=config', request.url))
    }
`
  const ATTRS_DB_BLOCK = `    // colunas do cadastro que as regras de acesso do BI consultam (sem diferenciar maiúsculas no nome da coluna)
    const attrs: Record<string, string> = {}
    for (const col of ${JSON.stringify(attrColumns)} as string[]) {
      const key = Object.keys(user).find(k => k.toLowerCase() === col.toLowerCase())
      const val = key ? (user as any)[key] : undefined
      if (val !== undefined && val !== null && String(val) !== '') attrs[col] = String(val)
    }
` + signBlock('userName', 'attrs')
  const ATTRS_MANAGED_BLOCK = `    const meta: Record<string, any> = (data?.user?.user_metadata as Record<string, any>) || {}
    const attrs: Record<string, string> = {}
    for (const col of ${JSON.stringify(attrColumns)} as string[]) {
      const key = Object.keys(meta).find(k => k.toLowerCase() === col.toLowerCase())
      const val = key ? meta[key] : undefined
      if (val !== undefined && val !== null && String(val) !== '') attrs[col] = String(val)
    }
` + signBlock('undefined', 'attrs')
  const iconFallback = ast.projectName.charAt(0).toUpperCase()
  const projectIconSvg = ast.projectIcon && ast.projectIcon.startsWith('<svg') 
    ? ast.projectIcon 
    : `<span className="text-xl font-bold text-white">${iconFallback}</span>`

  files.set('app/(auth)/login/page.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${d.login.title} — ${ast.projectName}',
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = await searchParams
  const error = resolvedSearchParams?.error
  const errorMessage = error === 'invalid'
    ? '${d.login.err_invalid}'
    : error === 'credentials'
    ? '${d.login.err_credentials}'
    : error === 'server'
    ? '${d.login.err_server}'
    : error === 'config'
    ? '${d.login.err_config}'
    : null

  return (
    <main className="${T.LOGIN_PAGE}">
      <div className="w-full max-w-[380px] relative z-10">
        {/* Card */}
        <div className="${T.LOGIN_CARD}">
          {/* Logo */}
          <div className="${T.LOGIN_LOGO}">
            ${projectIconSvg}
          </div>

          <h1 className="${T.LOGIN_TITLE}">${d.login.welcome_back}</h1>
          <p className="${T.LOGIN_SUBTITLE}">${d.login.subtitle}</p>

          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold text-center leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form action="/api/login" method="post" className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="${T.LOGIN_LABEL}">${d.login.email}</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="exemplo@empresa.com"
                className="${T.LOGIN_INPUT}"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="${T.LOGIN_LABEL}">${d.login.password}</label>
                <a href="#" className="text-[10px] text-indigo-600 dark:text-[#4f46e5] hover:text-indigo-700 dark:hover:text-[#6366f1] transition-colors font-bold uppercase tracking-wide">${d.login.forgot_password}</a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Sua senha secreta"
                  className="${T.LOGIN_INPUT}"
                />
              </div>
            </div>

            <button
              type="submit"
              className="${T.LOGIN_BTN}"
            >
              ${d.login.enter_system}
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="/" className="${T.LOGIN_BACK_LINK}">
              ${d.login.back_to_home}
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-3">
             <div className="h-[1px] w-12 bg-slate-200 dark:bg-[#27272a]/50 transition-colors duration-300"></div>
             <p className="text-center text-[9px] text-slate-400 dark:text-[#52525b] tracking-[0.2em] uppercase font-bold transition-colors duration-300">POWERED BY METABUILDER</p>
             <div className="h-[1px] w-12 bg-slate-200 dark:bg-[#27272a]/50 transition-colors duration-300"></div>
          </div>
        </div>
      </div>
    </main>
  )
}
`)



  // app/api/login/route.ts — define o cookie de sessão
  let loginApiContent = `import { NextResponse } from 'next/server'\nimport { signSession } from '@/lib/session'\n`
  
  if (ast.authConfig?.authType === 'database') {
    const table = ast.authConfig.tableName || 'usuarios'
    const emailCol = ast.authConfig.emailColumn || 'email'
    const passCol = ast.authConfig.passwordColumn || 'hash_senha'
    const hashFormat = ast.authConfig.hashFormat || 'bcrypt'
    
    const cleanTable = (table || '').toLowerCase().trim().replace(/^.*\./, '')
    const targetTable = (table || '').toLowerCase().trim()
    
    // Procura estritamente o model da tabela de auth pelo nome exato da tabela
    const authModel = 
      ast.models.find(m => (m.dbTable || '').toLowerCase().trim() === targetTable) ||
      ast.models.find(m => (m.name || '').toLowerCase().trim() === targetTable) ||
      ast.models.find(m => (m.dbTable || '').toLowerCase().trim() === cleanTable) ||
      ast.models.find(m => (m.name || '').toLowerCase().trim() === cleanTable)
    
    if (authModel) {
      loginApiContent += `import { get${authModel.name}ByField } from '@/app/actions/${authModel.name.toLowerCase()}'\n`
      if (hashFormat === 'bcrypt') {
        loginApiContent += `import bcrypt from 'bcryptjs'\n`
      } else if (hashFormat === 'md5' || hashFormat === 'sha256') {
        loginApiContent += `import crypto from 'crypto'\n`
      }
      
      loginApiContent += `
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim()
  const password = formData.get('password') as string || ''
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=credentials', request.url))
  }

  try {
    const rawRes: any = await get${authModel.name}ByField('${emailCol}', email)
    const rows = Array.isArray(rawRes) ? rawRes : (rawRes?.content ?? (rawRes ? [rawRes] : []))
    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }
    
    // Procura o usuário exato pelo e-mail caso a API tenha retornado uma lista de registros
    const cleanTargetEmail = email.toLowerCase().trim()
    const user = rows.find((r: any) => {
      const e = String(
        r?.['${emailCol}'] ?? 
        r?.['${emailCol.toLowerCase()}'] ?? 
        r?.['${toCamel(emailCol)}'] ?? 
        r?.email ?? 
        r?.EMAIL ?? 
        ''
      ).toLowerCase().trim()
      return e === cleanTargetEmail
    }) || rows[0]

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const foundEmail = String(
      user?.['${emailCol}'] ?? 
      user?.['${emailCol.toLowerCase()}'] ?? 
      user?.['${toCamel(emailCol)}'] ?? 
      user?.email ?? 
      user?.EMAIL ?? 
      ''
    ).toLowerCase().trim()

    if (foundEmail && foundEmail !== cleanTargetEmail) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const passCamel = '${toCamel(passCol)}'
    const dbHash = String(
      user['${passCol}'] ?? 
      user[passCamel] ?? 
      user['${passCol.toLowerCase()}'] ?? 
      user['${passCol.toUpperCase()}'] ?? 
      user?.hash_senha ?? 
      user?.hashSenha ?? 
      user?.senha ?? 
      user?.password ?? 
      ''
    )

    let isValid = false
    ${
      hashFormat === 'bcrypt'
        ? `try {
      isValid = await bcrypt.compare(password, dbHash)
    } catch {
      isValid = (password === dbHash)
    }`
        : hashFormat === 'sha256'
        ? `const hash = crypto.createHash('sha256').update(password).digest('hex')\n    isValid = (hash.toLowerCase() === dbHash.toLowerCase())`
        : hashFormat === 'md5'
        ? `const hash = crypto.createHash('md5').update(password).digest('hex')\n    isValid = (hash.toLowerCase() === dbHash.toLowerCase())`
        : `isValid = (password === dbHash)`
    }

    if (!isValid) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const userName = String(
      user['nome'] || 
      user['nome_completo'] || 
      user['nomeCompleto'] || 
      user['name'] || 
      user['NOME'] || 
      email.split('@')[0] || 
      ''
    )


${ATTRS_DB_BLOCK}    const response = NextResponse.redirect(new URL(redirect, request.url))
    response.cookies.set('mb_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    response.cookies.set('mb_user', JSON.stringify({ email, name: userName }), {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response

  } catch (err) {
    console.error('Login DB Error:', err)
    return NextResponse.redirect(new URL('/login?error=server', request.url))
  }
}
`
    } else {
      loginApiContent += `
export async function POST(request: Request) {
  console.error('Tabela de autenticação "${table}" não encontrada nos modelos do projeto.')
  return NextResponse.redirect(new URL('/login?error=config', request.url))
}
`
    }
  } else if (ast.authConfig?.authType === 'managed' && ast.dbStack === 'supabase') {
    loginApiContent += `import { createClient } from '@/app/actions/db'\n
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim()
  const password = formData.get('password') as string || ''
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=credentials', request.url))
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }


${ATTRS_MANAGED_BLOCK}    const response = NextResponse.redirect(new URL(redirect, request.url))
    response.cookies.set('mb_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    response.cookies.set('mb_user', JSON.stringify({ email }), {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Login Supabase Error:', err)
    return NextResponse.redirect(new URL('/login?error=server', request.url))
  }
}
`
  } else {
    loginApiContent += `
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim() || 'user@example.com'
  const redirect = new URL(request.url).searchParams.get('redirect') || '/'

  // Autenticação desativada ou mock
  let sessionToken: string
  try {
    sessionToken = await signSession({ email, name: email.split('@')[0] })
  } catch (e) {
    console.error('Sessão: ', e)
    return NextResponse.redirect(new URL('/login?error=config', request.url))
  }
  const response = NextResponse.redirect(new URL(redirect, request.url))
  response.cookies.set('mb_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  response.cookies.set('mb_user', JSON.stringify({ email, name: email.split('@')[0] }), {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
`
  }

  files.set('app/api/login/route.ts', loginApiContent)

  // app/api/logout/route.ts â€” limpa o cookie de sessão
  files.set('app/api/logout/route.ts', `import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete('mb_session')
  response.cookies.delete('mb_user')
  return response
}
`)

  // proxy.ts (antigo middleware.ts) — intercepta toda requisição e redireciona para /login se não autenticado
  files.set('proxy.ts', `import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // só passa quem tem uma sessão assinada válida (um cookie montado à mão é recusado)
  const user = await verifySession(request.cookies.get('mb_session')?.value)
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const res = NextResponse.redirect(loginUrl)
    if (request.cookies.get('mb_session')) res.cookies.delete('mb_session')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
`)
}


export function generateDownloadsPage(ast: AppAST, files: Map<string, string>) {
  const d = getGeneratorDictionary(ast.targetLanguage)

  files.set('app/(protected)/downloads/page.tsx', `import Link from 'next/link'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react'

export default function DownloadsPage() {
  // Dados mockados estruturais
  const jobs = [
    { id: '1', file_name: 'clientes_export.csv', status: 'completed', progress: 100, record_count: 1450, file_size: 45020, created_at: new Date().toISOString() },
    { id: '2', file_name: 'pedidos_relatorio.xlsx', status: 'processing', progress: 45, record_count: 8500, created_at: new Date().toISOString() },
  ]

  const metrics = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    failed: jobs.filter(j => j.status === 'failed').length
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-500/20">
            <Download className="w-5 h-5 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">${d.downloads.title}</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">${d.downloads.subtitle}</p>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-amber-500">${d.downloads.queue_title}</h4>
          <p className="text-xs text-amber-500/80 mt-1 leading-relaxed">
            ${d.downloads.queue_desc}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '${d.downloads.total_requested}', value: metrics.total, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: '${d.downloads.download_completed}', value: metrics.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: '${d.downloads.in_processing}', value: metrics.processing, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: '${d.downloads.failures}', value: metrics.failed, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
        ].map((m, idx) => (
          <div key={idx} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{m.label}</span>
              <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${m.bg} \${m.color}\`}>
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <span className={\`text-3xl font-bold \${m.color}\`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs placeholder */}
      <div className="border-b border-[var(--card-border)] flex gap-6 mt-8">
        <div className="pb-3 border-b-2 border-indigo-500 font-semibold text-sm text-white">${d.downloads.tab_all} ({metrics.total})</div>
        <div className="pb-3 border-b-2 border-transparent font-medium text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer">${d.downloads.tab_completed} ({metrics.completed})</div>
        <div className="pb-3 border-b-2 border-transparent font-medium text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer">${d.downloads.tab_pending} ({metrics.processing})</div>
      </div>

      {/* List */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[var(--card-border)] bg-neutral-900/40 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 flex items-center gap-2 text-xs font-black tracking-widest text-[var(--muted)] uppercase"><ArrowUpDown className="w-3 h-3"/> ${d.downloads.col_file}</div>
          <div className="col-span-3 text-xs font-black tracking-widest text-[var(--muted)] uppercase">${d.downloads.col_records}</div>
          <div className="col-span-3 text-xs font-black tracking-widest text-[var(--muted)] uppercase">${d.downloads.col_status}</div>
          <div className="col-span-1 text-center text-xs font-black tracking-widest text-[var(--muted)] uppercase">${d.downloads.col_actions}</div>
        </div>

        <div className="divide-y divide-[var(--card-border)]">
          {jobs.length === 0 ? (
             <div className="p-12 text-center flex flex-col items-center">
               <Download className="w-12 h-12 text-[var(--muted)] opacity-20 mb-4" />
               <h3 className="text-white font-semibold mb-1">${d.downloads.empty_title}</h3>
               <p className="text-[var(--muted)] text-sm">${d.downloads.empty_desc}</p>
             </div>
          ) : jobs.map((job) => (
             <div key={job.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-white/5 transition-colors group">
               <div className="col-span-5 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center ring-1 ring-neutral-700 group-hover:bg-indigo-600/10 group-hover:ring-indigo-500/30 transition-all">
                    {job.file_name.endsWith('csv') ? <FileText className="w-5 h-5 text-indigo-400" /> : <FileSpreadsheet className="w-5 h-5 text-emerald-400" />}
                 </div>
                 <div>
                   <div className="font-semibold text-white text-sm">{job.file_name}</div>
                   <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                     <Calendar className="w-3 h-3" />
                     {new Date(job.created_at).toLocaleString()}
                     {job.file_size && <span className="opacity-50">· {(job.file_size / 1024).toFixed(2)} KB</span>}
                   </div>
                 </div>
               </div>

               <div className="col-span-3 text-sm text-[var(--foreground)]">
                 <span className="bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-md text-xs font-medium">
                   {job.record_count?.toLocaleString()} ${d.list.lines.toLowerCase()}
                 </span>
               </div>

               <div className="col-span-3">
                 {job.status === 'completed' && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold ring-1 ring-emerald-500/20">
                     <CheckCircle2 className="w-3.5 h-3.5" /> ${d.downloads.tab_completed.slice(0, -1)}o
                   </span>
                 )}
                 {job.status === 'processing' && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold ring-1 ring-amber-500/20">
                     <Loader2 className="w-3.5 h-3.5 animate-spin" /> ${d.downloads.in_processing} {job.progress}%
                   </span>
                 )}
               </div>

               <div className="col-span-1 flex justify-center">
                 {job.status === 'completed' ? (
                   <button className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95">
                     <Download className="w-4 h-4" />
                   </button>
                 ) : (
                   <div className="w-8 h-8 flex items-center justify-center text-[var(--muted)]">
                     <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                   </div>
                 )}
               </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  )
}
`)
}
