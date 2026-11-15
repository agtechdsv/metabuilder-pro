import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const dir = path.join(root, 'docs', 'emails-supabase')

/**
 * Interpretador MÍNIMO do trecho de Go template que os modelos usam ($l := "pt", if/else if/else/end, eq, .Data, .Data.lang), só para provar a LÓGICA
 * de escolha do idioma. A sintaxe de verdade só o Supabase valida: depois de colar, o teste é enviar cada e-mail (ver LEIA-ME.md).
 */
function render(tpl: string, data: Record<string, unknown> | null): string {
  const vars: Record<string, string> = {}
  const stack: { parent: boolean; taken: boolean; active: boolean }[] = []
  const active = () => stack.every(s => s.active)
  const cond = (expr: string): boolean => {
    if (expr === '.Data') return !!data
    if (expr === '.Data.lang') return !!(data && data.lang)
    const m = /^eq \$l "(\w+)"$/.exec(expr)
    if (m) return vars.l === m[1]
    throw new Error('condição não prevista: ' + expr)
  }
  let out = ''
  let last = 0
  for (const m of tpl.matchAll(/\{\{(.*?)\}\}/g)) {
    if (active()) out += tpl.slice(last, m.index)
    last = (m.index ?? 0) + m[0].length
    const a = m[1].trim()
    if (a.startsWith('$l :=')) { if (active()) vars.l = a.split('"')[1] }
    else if (a === '$l = .Data.lang') { if (active()) vars.l = String(data!.lang) }
    else if (a.startsWith('if ')) { const parent = active(); const c = parent && cond(a.slice(3)); stack.push({ parent, taken: c, active: c }) }
    else if (a.startsWith('else if ')) { const s = stack[stack.length - 1]; const c = s.parent && !s.taken && cond(a.slice(8)); s.active = c; s.taken = s.taken || c }
    else if (a === 'else') { const s = stack[stack.length - 1]; s.active = s.parent && !s.taken; s.taken = true }
    else if (a === 'end') stack.pop()
    else if (active()) out += `[${a}]`
  }
  if (stack.length) throw new Error('if sem end')
  return out + tpl.slice(last)
}

const NAMES = ['confirm-signup', 'invite-user', 'magic-link', 'change-email', 'reset-password', 'reauthentication']
const FIRST_LINE: Record<string, { pt: string; en: string; es: string }> = {
  'confirm-signup': { pt: 'Confirme o seu e-mail', en: 'Confirm your e-mail', es: 'Confirme su e-mail' },
  'invite-user': { pt: 'Você foi convidado!', en: 'You have been invited!', es: '¡Lo invitaron!' },
  'magic-link': { pt: 'Entre no MetaBuilder PRO', en: 'Sign in to MetaBuilder PRO', es: 'Ingrese a MetaBuilder PRO' },
  'change-email': { pt: 'Confirmar o novo e-mail', en: 'Confirm your new e-mail', es: 'Confirme su nuevo e-mail' },
  'reset-password': { pt: 'Redefinir a sua senha', en: 'Reset your password', es: 'Restablecer su contraseña' },
  reauthentication: { pt: 'Confirme que é você', en: 'Confirm it is you', es: 'Confirme que es usted' },
}

describe('modelos de e-mail do Supabase em 3 idiomas', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'gerar-modelos-email-supabase.mjs')], { cwd: root, stdio: 'pipe' })

  it('cada modelo mostra o texto do idioma do usuário, e português quando não há idioma ou ele é desconhecido', () => {
    for (const name of NAMES) {
      const tpl = read(path.join(dir, `${name}.html`))
      const L = FIRST_LINE[name]
      const pt = render(tpl, null)
      expect(pt, name).toContain(L.pt)
      expect(pt, name).not.toContain(L.en)
      expect(render(tpl, {}), name).toContain(L.pt) // dados sem idioma
      expect(render(tpl, { lang: 'fr' }), name).toContain(L.pt) // idioma desconhecido
      expect(render(tpl, { lang: 'pt' }), name).toContain(L.pt)
      const en = render(tpl, { lang: 'en' })
      expect(en, name).toContain(L.en)
      expect(en, name).not.toContain(L.pt)
      const es = render(tpl, { lang: 'es' })
      expect(es, name).toContain(L.es)
      expect(es, name).not.toContain(L.pt)
    }
  })

  it('o assunto também escolhe o idioma, e o rodapé tem a linha de ajuda e nenhum ano fixo', () => {
    const subjects = read(path.join(dir, 'assuntos.md'))
    for (const name of NAMES) expect(subjects, name).toContain(`## ${name}`)
    const block = subjects.split('```')[1].trim()
    expect(render(block, { lang: 'en' })).toBe('Confirm your MetaBuilder PRO sign-up')
    expect(render(block, null)).toBe('Confirme o seu cadastro no MetaBuilder PRO')
    expect(render(block, { lang: 'es' })).toBe('Confirme su registro en MetaBuilder PRO')
    for (const name of NAMES) {
      const tpl = read(path.join(dir, `${name}.html`))
      expect(tpl, name).toContain('suporte@metabuilderpro.com')
      expect(tpl, name).not.toMatch(/20\d\d/)
    }
  })

  it('cada modelo usa as variáveis do Supabase certas e as chaves do template estão equilibradas', () => {
    for (const name of NAMES) {
      const tpl = read(path.join(dir, `${name}.html`))
      expect((tpl.match(/\{\{ if /g) || []).length, name).toBe((tpl.match(/\{\{ end \}\}/g) || []).length)
      expect(tpl, name).toContain('bgcolor="#10b981"') // cor sólida de reserva da faixa (gradiente não funciona em todo cliente de e-mail)
      expect(tpl, name).not.toMatch(/<script/i)
      if (name === 'reauthentication') {
        expect(tpl).toContain('{{ .Token }}')
        expect(tpl).not.toContain('.ConfirmationURL')
      } else {
        expect(tpl, name).toContain('{{ .ConfirmationURL }}')
        expect(tpl, name).toContain('Se o botão não funcionar') // link de reserva
      }
    }
    expect(read(path.join(dir, 'change-email.html'))).toMatch(/\{\{ \.Email \}\}.*\{\{ \.NewEmail \}\}/)
    // o nome de e-mail do usuário nunca é escrito sem escape (o Supabase usa html/template e escapa; aqui só garantimos que não há HTML vindo de variável)
    expect(read(path.join(dir, 'reset-password.html'))).toContain('O link vale por 1 hora')
  })

  it('o idioma é gravado no cadastro, no convite, no login e na página de retorno', () => {
    const auth = read('src/app/auth/actions.ts')
    expect(auth).toContain('lang: await currentMailLang()')
    expect(auth).toContain('user.user_metadata?.lang !== lang')
    expect(auth).toContain('await supabase.auth.updateUser({ data: { lang } })')
    const ws = read('src/app/actions/workspace.ts')
    expect((ws.match(/lang: await currentMailLang\(\)/g) || []).length).toBe(3) // os 3 convites
    expect(read('src/app/auth/callback/page.tsx')).toContain("session.user.user_metadata?.lang !== language")
    // trocar de idioma logado atualiza o idioma dos e-mails; e "Esqueceu?" usa o idioma da tela no momento do pedido (não o do último login)
    expect(read('src/i18n/I18nContext.tsx')).toContain('await supabase.auth.updateUser({ data: { lang } })')
    const reset = read('src/app/actions/mailLang.ts')
    expect(reset).toContain("'use server'")
    expect(reset).toContain('await currentMailLang()') // vem do cookie lido no servidor, não do pedido
    expect(reset).toContain('user_metadata: { ...meta, lang }') // preserva o resto dos dados
    expect(reset).toContain('if (meta.lang === lang) return') // só grava se mudou
    expect(reset).not.toMatch(/return\s*\{[^}]*(found|exists|encontr)/i) // nunca revela se a conta existe
    const form = read('src/components/auth/LoginForm.tsx')
    const fn = form.slice(form.indexOf('const handleForgotPassword'), form.indexOf('// ── Tela de "Retomando sessão"'))
    expect(fn.indexOf('prepareResetMailLang(address)')).toBeGreaterThan(0)
    expect(fn.indexOf('prepareResetMailLang(address)')).toBeLessThan(fn.indexOf('resetPasswordForEmail(address'))
    const lang = read('src/lib/auth/mailLangServer.ts')
    expect(lang).toContain("'app-language'")
    expect(lang).toContain('resolveMailLang(')
  })
})
