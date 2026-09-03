import { AppAST } from '../ast'
import { T } from '../layers/design-tokens'

export function generateLoginPage(ast: AppAST, files: Map<string, string>) {
  const iconFallback = ast.projectName.charAt(0).toUpperCase()
  const projectIconSvg = ast.projectIcon && ast.projectIcon.startsWith('<svg') 
    ? ast.projectIcon 
    : `<span className="text-xl font-bold text-white">${iconFallback}</span>`

  files.set('app/(auth)/login/page.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — ${ast.projectName}',
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = await searchParams
  const error = resolvedSearchParams?.error
  const errorMessage = error === 'invalid'
    ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
    : error === 'credentials'
    ? 'Por favor, preencha o e-mail e a senha.'
    : error === 'server'
    ? 'Erro ao processar login. Verifique a conexão com o banco de dados.'
    : error === 'config'
    ? 'Tabela de autenticação não encontrada nos modelos do projeto.'
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

          <h1 className="${T.LOGIN_TITLE}">Bem-vindo de volta!</h1>
          <p className="${T.LOGIN_SUBTITLE}">Entre com suas credenciais para acessar o sistema.</p>

          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold text-center leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form action="/api/login" method="post" className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="${T.LOGIN_LABEL}">E-mail</label>
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
                <label htmlFor="password" className="${T.LOGIN_LABEL}">Senha</label>
                <a href="#" className="text-[10px] text-indigo-600 dark:text-[#4f46e5] hover:text-indigo-700 dark:hover:text-[#6366f1] transition-colors font-bold uppercase tracking-wide">Esqueci minha senha?</a>
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
              ENTRAR NO SISTEMA
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="/" className="${T.LOGIN_BACK_LINK}">
              &larr; VOLTAR AO INÍCIO
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
  let loginApiContent = `import { NextResponse } from 'next/server'\n`
  
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
    const rows = await get${authModel.name}ByField('${emailCol}', email)
    if (!rows || rows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }
    
    const user = rows[0]
    const dbHash = String(user['${passCol}'] ?? user['${passCol.toLowerCase()}'] ?? user['${passCol.toUpperCase()}'] ?? '')

    let isValid = false
    ${
      hashFormat === 'bcrypt'
        ? `isValid = await bcrypt.compare(password, dbHash)`
        : hashFormat === 'sha256'
        ? `const hash = crypto.createHash('sha256').update(password).digest('hex')\n    isValid = (hash.toLowerCase() === dbHash.toLowerCase())`
        : hashFormat === 'md5'
        ? `const hash = crypto.createHash('md5').update(password).digest('hex')\n    isValid = (hash.toLowerCase() === dbHash.toLowerCase())`
        : `isValid = (password === dbHash)`
    }

    if (!isValid) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const response = NextResponse.redirect(new URL(redirect, request.url))
    response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    response.cookies.set('mb_user', JSON.stringify({ email, name: user['nome'] || user['nome_completo'] || user['name'] || user['NOME'] || '' }), {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url))
    }

    const response = NextResponse.redirect(new URL(redirect, request.url))
    response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
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
  const response = NextResponse.redirect(new URL(redirect, request.url))
  response.cookies.set('mb_session', Buffer.from(email).toString('base64'), {
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

  // middleware.ts â€” intercepta toda requisição e redireciona para /login se não autenticado
  files.set('middleware.ts', `import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const session = request.cookies.get('mb_session')?.value
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
`)
}


export function generateDownloadsPage(ast: AppAST, files: Map<string, string>) {
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
  // Dados mockados estruturais (O frontend farÃ¡ fetch real na API em v2)
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Gerenciador de Downloads</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">Central de exportAções assíncronas do sistema.</p>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-amber-500">FILA DE GERAÇÃO DE ARQUIVOS</h4>
          <p className="text-xs text-amber-500/80 mt-1 leading-relaxed">
            As exportAções com mais de 1.000 registros são processadas em background para não travar o uso da aplicação. VocÃª pode continuar trabalhando normalmente e voltar aqui quando o status estiver Concluído.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Solicitado', value: metrics.total, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Download Concluído', value: metrics.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'Em Processamento', value: metrics.processing, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: 'Falhas', value: metrics.failed, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
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
        <div className="pb-3 border-b-2 border-indigo-500 font-semibold text-sm text-white">Todas ({metrics.total})</div>
        <div className="pb-3 border-b-2 border-transparent font-medium text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer">Concluídas ({metrics.completed})</div>
        <div className="pb-3 border-b-2 border-transparent font-medium text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer">Pendentes ({metrics.processing})</div>
      </div>

      {/* List */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[var(--card-border)] bg-neutral-900/40 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 flex items-center gap-2 text-xs font-black tracking-widest text-[var(--muted)] uppercase"><ArrowUpDown className="w-3 h-3"/> Arquivo</div>
          <div className="col-span-3 text-xs font-black tracking-widest text-[var(--muted)] uppercase">Registros</div>
          <div className="col-span-3 text-xs font-black tracking-widest text-[var(--muted)] uppercase">Status</div>
          <div className="col-span-1 text-center text-xs font-black tracking-widest text-[var(--muted)] uppercase">Ações</div>
        </div>

        <div className="divide-y divide-[var(--card-border)]">
          {jobs.length === 0 ? (
             <div className="p-12 text-center flex flex-col items-center">
               <Download className="w-12 h-12 text-[var(--muted)] opacity-20 mb-4" />
               <h3 className="text-white font-semibold mb-1">Nenhuma exportação encontrada</h3>
               <p className="text-[var(--muted)] text-sm">Gere arquivos nas telas de listagem clicando em "Exportar".</p>
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
                     {job.file_size && <span className="opacity-50">Â· {(job.file_size / 1024).toFixed(2)} KB</span>}
                   </div>
                 </div>
               </div>

               <div className="col-span-3 text-sm text-[var(--foreground)]">
                 <span className="bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-md text-xs font-medium">
                   {job.record_count?.toLocaleString()} linhas
                 </span>
               </div>

               <div className="col-span-3">
                 {job.status === 'completed' && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold ring-1 ring-emerald-500/20">
                     <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                   </span>
                 )}
                 {job.status === 'processing' && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold ring-1 ring-amber-500/20">
                     <Loader2 className="w-3.5 h-3.5 animate-spin" /> Em Processamento {job.progress}%
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
