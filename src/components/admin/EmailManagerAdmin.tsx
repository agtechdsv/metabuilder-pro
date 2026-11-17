'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, RefreshCw, Save, Send } from 'lucide-react'
import { getEmailRoutingAdmin, saveEmailRouting, sendEmailRoutingTest, type EmailRoutingErrorCode, type EmailRoutingOverview } from '@/app/actions/emailRouting'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { SectionToggle } from './SectionToggle'
import { EMAIL_TOPICS, resolveRoute, type EmailRouting, type EmailTopic } from '@/lib/email/routing'

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

type Form = Record<EmailTopic, { from: string; replyTo: string; to: string }>
const emptyForm = (): Form => Object.fromEntries(EMAIL_TOPICS.map(t => [t.id, { from: '', replyTo: '', to: '' }])) as Form
const toForm = (r: EmailRouting): Form => {
  const f = emptyForm()
  for (const t of EMAIL_TOPICS) f[t.id] = { from: r[t.id]?.from || '', replyTo: r[t.id]?.replyTo || '', to: r[t.id]?.to || '' }
  return f
}

/**
 * Gerenciador de e-mails (aba Sistema): para cada ASSUNTO, de qual endereço o e-mail sai, para onde vão as respostas e (avisos à equipe) quem recebe.
 * Vazio = como sempre (conta do SMTP). Só o SuperAdmin. O remetente precisa ser do domínio da conta do SMTP.
 */
export function EmailManagerAdmin({ refreshKey = 0 }: { refreshKey?: number } = {}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const k = (key: string, vars?: Record<string, string>) => {
    let s = t(`admin_email.${key}`)
    for (const [n, v] of Object.entries(vars || {})) s = s.split(`{${n}}`).join(v)
    return s
  }
  const errText = (code: EmailRoutingErrorCode, topic?: EmailTopic) => k(`err_${code}`) + (topic ? ` (${k(`topic_${topic}`)})` : '')

  const [overview, setOverview] = useState<EmailRoutingOverview | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [testTo, setTestTo] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState<EmailTopic | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await getEmailRoutingAdmin()
    if (r.success) { setOverview(r.overview); setForm(toForm(r.overview.routing)); setTestTo(prev => prev || r.overview.userEmail); setError(null) }
    else setError(errText(r.code))
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  useEffect(() => { if (refreshKey > 0) load() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const asRouting = (): EmailRouting => Object.fromEntries(EMAIL_TOPICS.map(tp => [tp.id, { from: form[tp.id].from, replyTo: form[tp.id].replyTo, ...(tp.team ? { to: form[tp.id].to } : {}) }])) as EmailRouting

  const save = async () => {
    setBusy(true)
    const r = await saveEmailRouting(asRouting())
    setBusy(false)
    if (r.success) { toast(k('saved'), 'success'); await load() } else toast(errText(r.code, r.topic), 'error')
  }

  const test = async (topic: EmailTopic) => {
    // o teste usa o que está SALVO: se há mudança na tela, pede para salvar antes
    const saved = overview ? toForm(overview.routing) : emptyForm()
    if (JSON.stringify(saved[topic]) !== JSON.stringify(form[topic])) { toast(k('save_first'), 'info'); return }
    setTesting(topic)
    const r = await sendEmailRoutingTest(topic, testTo)
    setTesting(null)
    if (r.success) toast(k('test_sent', { from: r.from, to: testTo }), 'success')
    else toast(errText(r.code), 'error')
  }

  const preview = useMemo(() => {
    const routing: EmailRouting = Object.fromEntries(EMAIL_TOPICS.map(tp => [tp.id, { from: form[tp.id].from.trim().toLowerCase(), replyTo: form[tp.id].replyTo.trim().toLowerCase(), to: form[tp.id].to.trim().toLowerCase() }])) as EmailRouting
    return (topic: EmailTopic) => resolveRoute(routing, topic, overview?.defaultFrom || '')
  }, [form, overview])

  const set = (topic: EmailTopic, field: 'from' | 'replyTo' | 'to', value: string) => setForm(f => ({ ...f, [topic]: { ...f[topic], [field]: value } }))

  return (
    <section className="space-y-5 rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="email-manager-body" className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10"><Mail className="h-6 w-6" /></div>
          <div className="min-w-0">
            <h3 className="text-lg font-black uppercase tracking-wider">{k('title')}</h3>
            <p className="mt-1 text-xs font-medium text-neutral-500">{k('subtitle')}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center">
          {open && (
            <button type="button" onClick={load} disabled={loading} title={k('refresh')} aria-label={k('refresh')} className="rounded-xl p-2 text-neutral-400 hover:text-indigo-600 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <SectionToggle open={open} onToggle={() => setOpen(o => !o)} controls="email-manager-body" />
        </div>
      </div>

      {/* erro de carga aparece mesmo recolhido, para não ficar escondido */}
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {open && loading && !overview && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>}

      {open && overview && (
        <div id="email-manager-body" className="space-y-5">
        <>
          {!overview.smtpConfigured && <p role="alert" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{k('no_smtp_banner')}</p>}
          <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
            {k('default_info', { from: overview.defaultFrom || '-', domain: overview.domain || '-' })}
          </p>

          <datalist id="email-aliases">{overview.aliases.map(a => <option key={a} value={a} />)}</datalist>

          <div className="max-w-md">
            <label className={labelCls}>{k('test_to')}</label>
            <input className={inputCls} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="voce@exemplo.com" />
            <p className="mt-1 text-[10px] text-neutral-400">{k('test_to_hint')}</p>
          </div>

          <div className="space-y-3">
            {EMAIL_TOPICS.map(tp => {
              const r = preview(tp.id)
              return (
                <div key={tp.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black">{k(`topic_${tp.id}`)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{k(`topic_${tp.id}_desc`)}</p>
                    </div>
                    <button type="button" disabled={testing !== null || !testTo.trim() || !overview.smtpConfigured} onClick={() => test(tp.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-1.5 text-[11px] font-black hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800">
                      {testing === tp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{k('test')}
                    </button>
                  </div>
                  <div className={`mt-3 grid gap-3 ${tp.team ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    <div><label className={labelCls}>{k('from')}</label>
                      <input className={inputCls} type="email" list="email-aliases" value={form[tp.id].from} onChange={e => set(tp.id, 'from', e.target.value)} placeholder={overview.defaultFrom} autoComplete="off" /></div>
                    <div><label className={labelCls}>{k('reply_to')}</label>
                      <input className={inputCls} type="email" list="email-aliases" value={form[tp.id].replyTo} onChange={e => set(tp.id, 'replyTo', e.target.value)} placeholder={k('reply_to_ph')} autoComplete="off" /></div>
                    {tp.team && (
                      <div><label className={labelCls}>{k('to_team')}</label>
                        <input className={inputCls} type="email" list="email-aliases" value={form[tp.id].to} onChange={e => set(tp.id, 'to', e.target.value)} placeholder={k('to_team_ph')} autoComplete="off" /></div>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    {k('effective', { from: r.from || '-' })}{r.replyTo ? ` · ${k('effective_reply', { to: r.replyTo })}` : ''}{tp.team && r.to ? ` · ${k('effective_to', { to: r.to })}` : ''}
                  </p>
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-neutral-500">{k('rules')}</p>

          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {k('save')}
          </button>
        </>
        </div>
      )}
    </section>
  )
}
