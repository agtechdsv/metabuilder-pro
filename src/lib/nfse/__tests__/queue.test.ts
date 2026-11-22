import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_NFSE_MODE, DEFAULT_WAIT_DAYS, MAX_PDF_BYTES, NFSE_AUTO_AVAILABLE, NFSE_LUNIS_URL, addDays, availableNfseModes, checkPdfBase64, dayInBrasilia,
  daysBetween, dueState, effectiveIssuer, emitOnFrom, formatDateBr, formatDoc, moneyForCopy, onlyDigits, parseNfseMode, parseWaitDays, safePdfName, whoIssues,
} from '../queue'
import { nfseCustomerMail, nfseDigestMail } from '../nfseMail'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('fila de notas: datas (horário de Brasília)', () => {
  it('a nota sai 8 dias depois do pagamento', () => {
    expect(DEFAULT_WAIT_DAYS).toBe(8)
    expect(emitOnFrom('2026-11-25T15:00:00Z')).toBe('2026-12-03')
    expect(emitOnFrom('2026-11-10T15:00:00Z', 3)).toBe('2026-11-13')
  })

  it('o dia é o de Brasília, não o de Greenwich (mesma conta da trigger do banco)', () => {
    expect(dayInBrasilia('2026-12-31T01:00:00Z')).toBe('2026-12-30')
    expect(dayInBrasilia('2026-12-31T03:00:00Z')).toBe('2026-12-31')
    expect(emitOnFrom('2026-12-31T01:00:00Z')).toBe('2027-01-07')
  })

  it('soma dias atravessando mês, ano e fevereiro bissexto', () => {
    expect(addDays('2026-11-25', 8)).toBe('2026-12-03')
    expect(addDays('2026-12-30', 8)).toBe('2027-01-07')
    expect(addDays('2028-02-25', 5)).toBe('2028-03-01')
    expect(daysBetween('2026-11-20', '2026-11-23')).toBe(3)
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3)
  })

  it('prazo inválido ou absurdo vira o padrão ou o limite', () => {
    expect(parseWaitDays(undefined)).toBe(8)
    expect(parseWaitDays('abc')).toBe(8)
    expect(parseWaitDays({ days: 999 })).toBe(60)
    expect(parseWaitDays({ days: -5 })).toBe(0)
    expect(parseWaitDays(3.9)).toBe(3)
    expect(emitOnFrom('2026-11-10T15:00:00Z', 999)).toBe('2027-01-09')
  })

  it('mostra a data em dia/mês/ano', () => {
    expect(formatDateBr('2026-11-20')).toBe('20/11/2026')
    expect(formatDateBr('2026-11-20T10:00:00Z')).toBe('20/11/2026')
    expect(formatDateBr(null)).toBe('')
    expect(formatDateBr('lixo')).toBe('')
  })
})

describe('fila de notas: modos e quem emite', () => {
  it('começa manual e lixo volta a manual', () => {
    expect(DEFAULT_NFSE_MODE).toBe('manual')
    expect(parseNfseMode(undefined)).toBe('manual')
    expect(parseNfseMode({ mode: 'hybrid' })).toBe('hybrid')
    expect(parseNfseMode('auto')).toBe('auto')
    expect(parseNfseMode({ mode: 'qualquer' })).toBe('manual')
  })

  it('manual: tudo é seu', () => {
    expect(whoIssues('manual', '2026-11-05', '2026-11-13')).toBe('me')
    expect(whoIssues('manual', '2026-11-25', '2026-12-03')).toBe('me')
  })

  it('automática: tudo é do app', () => {
    expect(whoIssues('auto', '2026-11-05', '2026-11-13')).toBe('auto')
    expect(whoIssues('auto', '2026-11-25', '2026-12-03')).toBe('auto')
  })

  it('híbrido: emissão no mesmo mês do pagamento é automática; no mês seguinte é sua', () => {
    expect(whoIssues('hybrid', '2026-11-05', '2026-11-13')).toBe('auto')
    expect(whoIssues('hybrid', '2026-11-22', '2026-11-30')).toBe('auto')
    expect(whoIssues('hybrid', '2026-11-23', '2026-12-01')).toBe('me')
    expect(whoIssues('hybrid', '2026-12-28', '2027-01-05')).toBe('me') // virada de ano
  })

  it('enquanto a automática não existe, só o manual pode ser escolhido e tudo cai para você', () => {
    expect(NFSE_AUTO_AVAILABLE).toBe(false)
    expect(availableNfseModes()).toEqual(['manual'])
    expect(effectiveIssuer('auto', '2026-11-05', '2026-11-13')).toBe('me')
    expect(effectiveIssuer('hybrid', '2026-11-05', '2026-11-13')).toBe('me')
  })
})

describe('fila de notas: prazo', () => {
  it('atrasada, hoje, em breve e longe', () => {
    expect(dueState('2026-11-18', '2026-11-20')).toEqual({ state: 'late', days: 2 })
    expect(dueState('2026-11-20', '2026-11-20')).toEqual({ state: 'today', days: 0 })
    expect(dueState('2026-11-21', '2026-11-20')).toEqual({ state: 'soon', days: 1 })
    expect(dueState('2026-11-22', '2026-11-20')).toEqual({ state: 'soon', days: 2 })
    expect(dueState('2026-11-23', '2026-11-20')).toEqual({ state: 'future', days: 3 })
  })
})

describe('fila de notas: campos para copiar', () => {
  it('valor com vírgula e duas casas', () => {
    expect(moneyForCopy(349)).toBe('349,00')
    expect(moneyForCopy('12.5')).toBe('12,50')
    expect(moneyForCopy(1234.5)).toBe('1234,50')
    expect(moneyForCopy('abc')).toBe('')
  })

  it('documento só com números e formatado para ler', () => {
    expect(onlyDigits('19.287.384/0001-01')).toBe('19287384000101')
    expect(onlyDigits(null)).toBe('')
    expect(formatDoc('19287384000101')).toBe('19.287.384/0001-01')
    expect(formatDoc('12345678901')).toBe('123.456.789-01')
    expect(formatDoc('123')).toBe('123')
    expect(formatDoc(null)).toBe('')
  })

  it('o botão abre o emissor do contador já no modelo 92 do MetaBuilderPRO, sem dado de cliente na URL', () => {
    expect(NFSE_LUNIS_URL).toBe('https://cliente.lunis.ia.br/nfse/emitir?cnpj=19287384000101&modelo=92')
    expect(new URL(NFSE_LUNIS_URL).searchParams.get('modelo')).toBe('92')
  })
})

describe('fila de notas: PDF anexado', () => {
  const pdf = (n = 100) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(n, 65)]).toString('base64')

  it('aceita PDF de verdade', () => {
    const r = checkPdfBase64(pdf())
    expect(r.ok).toBe(true)
  })

  it('recusa vazio, arquivo que não é PDF e PDF grande demais', () => {
    expect(checkPdfBase64('')).toEqual({ ok: false, code: 'empty' })
    expect(checkPdfBase64(undefined)).toEqual({ ok: false, code: 'empty' })
    expect(checkPdfBase64(Buffer.from('MZ executavel').toString('base64'))).toEqual({ ok: false, code: 'not_pdf' })
    expect(checkPdfBase64(pdf(MAX_PDF_BYTES + 10))).toEqual({ ok: false, code: 'too_big' })
  })

  it('nome do anexo: só caracteres seguros e sempre .pdf', () => {
    expect(safePdfName('NFSe_2026_11_03_Selbetti.pdf')).toBe('NFSe_2026_11_03_Selbetti.pdf')
    expect(safePdfName('../../etc/passwd')).toBe('etc_passwd.pdf')
    expect(safePdfName('nota fiscal\r\nBcc: x@y.com')).toBe('nota_fiscal_Bcc_x_y.com.pdf')
    expect(safePdfName('', 'NFS-e.pdf')).toBe('NFS-e.pdf')
    expect(safePdfName(undefined)).toBe('NFS-e.pdf')
  })
})

describe('fila de notas: e-mails', () => {
  it('e-mail ao cliente: em português, com o valor, e o nome vindo de fora é escapado', () => {
    const m = nfseCustomerMail({ customerName: '<script>x</script> Ana', amount: 349, number: '15', issuedOn: '2026-12-03' })
    expect(m.subject).toContain('NFS-e 15')
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.html).toContain('R$')
    expect(m.text).toContain('03/12/2026')
  })

  it('o assunto não aceita quebra de linha (nada de injetar cabeçalho)', () => {
    const m = nfseCustomerMail({ customerName: 'x', amount: 1, number: '1\r\nBcc: a@b.com', issuedOn: '2026-12-03' })
    expect(m.subject).not.toMatch(/[\r\n]/)
  })

  it('aviso diário só existe se há nota atrasada ou para hoje', () => {
    expect(nfseDigestMail({ late: 0, today: 0, soon: 5 })).toBeNull()
    expect(nfseDigestMail({ late: 0, today: 2, soon: 0 })?.subject).toContain('2 para emitir hoje')
    const m = nfseDigestMail({ late: 1, today: 1, soon: 3 })
    expect(m?.subject).toContain('1 atrasada(s)')
    expect(m?.text).toContain('3 nos próximos 2 dias')
  })
})

describe('fila de notas: ligação no site', () => {
  it('as ações só funcionam para o SuperAdmin e a identidade vem da sessão', () => {
    const src = read('src/app/actions/nfse.ts')
    expect(src).toContain("is_super_admin")
    expect(src).toContain('supabase.auth.getUser()')
    for (const fn of ['nfseOverviewAction', 'nfseSaveSettingsAction', 'nfseIssueAction', 'nfseSetStatusAction']) {
      const body = src.slice(src.indexOf(`export async function ${fn}`))
      expect(body.slice(0, 400), fn).toContain('requireSuperAdmin()')
    }
  })

  it('só marca como emitida se o e-mail saiu; e só mexe em nota ainda pendente', () => {
    const src = read('src/app/actions/nfse.ts')
    expect(src.indexOf('sendNfseEmail(')).toBeLessThan(src.indexOf("status: 'issued'"))
    expect(src).toContain("if (!sent) return fail('mail_failed')")
    expect(src).toContain(".eq('status', 'pending')")
  })

  it('a subaba Notas Fiscais está dentro de Clientes e o painel usa a nova área', () => {
    expect(read('src/components/admin/PlatformAdminClient.tsx')).toContain('<ClientsArea hook={clientsHook}')
    const area = read('src/components/admin/tabs/ClientsArea.tsx')
    expect(area).toContain('<ClientsTab hook={hook}')
    expect(area).toContain('<NfseTab hook={nfse} />')
  })

  it('a tela abre o emissor pelo navegador do sistema e não guarda login do emissor', () => {
    const tab = read('src/components/admin/tabs/NfseTab.tsx')
    expect(tab).toContain('openExternalUrl(NFSE_LUNIS_URL)')
    expect(tab.toLowerCase()).not.toContain('senha')
    expect(tab).not.toContain('password')
  })

  it('o aviso diário está agendado e a rota é protegida pelo segredo do cron', () => {
    expect(read('vercel.json')).toContain('/api/cron/nfse-due')
    expect(read('src/app/api/cron/nfse-due/route.ts')).toContain('isCronAuthorized(req)')
  })

  it('o SQL fecha a tabela para o navegador e protege o webhook', () => {
    const sql = read('scripts/nfse-fila.sql')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on public.mb_nfse_queue from public, anon, authenticated')
    expect(sql).toContain('revoke all on function public.mb_nfse_enqueue() from public, anon, authenticated')
    expect(sql).toContain('exception when others then')
  })

  it('os textos existem nos 3 idiomas, com as mesmas chaves', () => {
    const keys = (l: string) => Object.keys(JSON.parse(read(`src/i18n/translations/${l}.json`)).admin_nfse).sort()
    expect(keys('en')).toEqual(keys('pt'))
    expect(keys('es')).toEqual(keys('pt'))
    expect(keys('pt').length).toBeGreaterThan(60)
  })
})
