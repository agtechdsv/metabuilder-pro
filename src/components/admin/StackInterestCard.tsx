'use client'

import React, { useEffect, useState } from 'react'
import { ArrowLeft, Send, Loader2, X, Mail, MessageCircle, Check, AlertTriangle, Layers } from 'lucide-react'
import {
  getStackInterestSummary,
  getStackInterestUsers,
  sendStackInterestMessage,
} from '@/app/actions/stack-interest'
import {
  STACK_INTEREST_STACKS,
  STACK_MESSAGE_TEMPLATES,
  type StackInterestSummaryRow,
  type StackInterestUser,
  type StackMessageResult,
} from '@/lib/stackInterest'

type Recipient = { userIds: string[]; label: string }

/** Totais de interessados por stack (botão "Quero ser avisado" do Eject & Sync) + lista e envio de mensagem */
export function StackInterestCard() {
  const [rows, setRows] = useState<StackInterestSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stack, setStack] = useState<string | null>(null)
  const [users, setUsers] = useState<StackInterestUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [useEmail, setUseEmail] = useState(true)
  const [useChat, setUseChat] = useState(true)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<StackMessageResult[] | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const loadSummary = async () => {
    setLoading(true)
    const r = await getStackInterestSummary()
    if (r.success) { setRows(r.rows || []); setError(null) } else setError(r.error || 'Erro ao carregar')
    setLoading(false)
  }
  useEffect(() => { loadSummary() }, [])

  const stackInfo = (id: string) => STACK_INTEREST_STACKS.find(s => s.id === id)
  const totalByStack = (id: string) => rows.find(r => r.stack === id)?.total || 0
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  const openStack = async (id: string) => {
    setStack(id)
    setUsers([])
    setUsersLoading(true)
    const r = await getStackInterestUsers(id)
    if (r.success) setUsers(r.users || []); else setError(r.error || 'Erro ao carregar')
    setUsersLoading(false)
  }

  const openCompose = (r: Recipient) => {
    setRecipient(r)
    setUseEmail(true)
    setUseChat(true)
    setResults(null)
    setSendError(null)
    applyTemplate('progress')
  }

  const applyTemplate = (id: string) => {
    const tpl = STACK_MESSAGE_TEMPLATES.find(t => t.id === id)
    if (!tpl) return
    setSubject(tpl.subject)
    setMessage(tpl.message)
  }

  const send = async () => {
    if (!recipient || !stack) return
    setSending(true)
    setSendError(null)
    const r = await sendStackInterestMessage({ stack, userIds: recipient.userIds, subject, message, channels: { email: useEmail, chat: useChat } })
    setSending(false)
    if (r.success) setResults(r.results || []); else setSendError(r.error || 'Erro ao enviar')
  }

  const okCount = (k: 'email' | 'chat') => (results || []).filter(r => r[k].ok).length

  return (
    <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col h-[300px] lg:col-span-2">
      {!stack ? (
        <>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider mb-2">Interesse por Stack</h4>
              <p className="text-[10px] text-neutral-400 font-medium">Quem pediu para ser avisado no Eject & Sync. Clique em uma stack para ver a lista.</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0"><Layers className="w-5 h-5" /></div>
          </div>
          {error && <p className="text-[11px] text-red-500 mb-2">{error}</p>}
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 overflow-y-auto">
              {STACK_INTEREST_STACKS.map(s => {
                const total = totalByStack(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openStack(s.id)}
                    className="flex items-center justify-between gap-2 p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850 hover:border-indigo-400 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-[11px] font-bold dark:text-white"><span className="text-base">{s.icon}</span>{s.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${total > 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'text-neutral-400 bg-neutral-100 dark:bg-neutral-900'}`}>{total}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-auto pt-3 text-[10px] text-neutral-400 font-medium text-center border-t border-neutral-100 dark:border-neutral-850/60">
            {grandTotal} {grandTotal === 1 ? 'interesse registrado' : 'interesses registrados'}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-3">
            <button type="button" onClick={() => { setStack(null); loadSummary() }} className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 hover:text-indigo-500">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider">{stackInfo(stack)?.icon} {stackInfo(stack)?.label} — {users.length} {users.length === 1 ? 'interessado' : 'interessados'}</h4>
            <button
              type="button"
              disabled={users.length === 0}
              onClick={() => openCompose({ userIds: users.map(u => u.userId), label: `todos (${users.length})` })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-bold"
            >
              <Send className="w-3.5 h-3.5" /> Enviar para todos
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {usersLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>}
            {!usersLoading && users.length === 0 && <p className="text-[11px] text-neutral-400 text-center py-6">Ninguém registrou interesse nesta stack ainda.</p>}
            {users.map(u => (
              <div key={u.userId} className="flex items-center justify-between gap-3 p-2.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
                <div className="flex items-center gap-3 min-w-0">
                  {u.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xs font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold dark:text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{u.email || 'sem e-mail'} · {new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  title="Enviar mensagem (e-mail + MetaBuilders)"
                  onClick={() => openCompose({ userIds: [u.userId], label: u.name })}
                  className="p-2 rounded-xl text-neutral-400 hover:text-indigo-500 hover:bg-indigo-500/10 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {recipient && (
        <div className="fixed inset-0 z-[100000] bg-black/60 flex items-center justify-center p-4" onClick={() => !sending && setRecipient(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black dark:text-white">Enviar mensagem para {recipient.label}</h3>
              <button type="button" disabled={sending} onClick={() => setRecipient(null)} className="p-1.5 text-neutral-400 hover:text-neutral-700"><X className="w-4 h-4" /></button>
            </div>

            {!results ? (
              <>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Enviar por</p>
                  <div className="flex items-center gap-2">
                    {([
                      { key: 'email', label: 'E-mail', icon: Mail, on: useEmail, set: setUseEmail },
                      { key: 'chat', label: 'Chat do MetaBuilders', icon: MessageCircle, on: useChat, set: setUseChat },
                    ] as const).map(c => (
                      <button
                        key={c.key}
                        type="button"
                        role="checkbox"
                        aria-checked={c.on}
                        onClick={() => c.set(!c.on)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${c.on ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300' : 'border-neutral-200 dark:border-neutral-700 text-neutral-400'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${c.on ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                          {c.on && <Check className="w-3 h-3" />}
                        </span>
                        <c.icon className="w-3.5 h-3.5" /> {c.label}
                      </button>
                    ))}
                  </div>
                  {!useEmail && !useChat && <p className="text-[10px] text-amber-600">Marque ao menos um canal.</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Modelo de mensagem</label>
                  <select
                    defaultValue="progress"
                    onChange={e => applyTemplate(e.target.value)}
                    className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 dark:text-neutral-200"
                  >
                    {STACK_MESSAGE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <p className="text-[10px] text-neutral-400">Você pode editar o texto. <code>{'{nome}'}</code> vira o primeiro nome de cada pessoa e <code>{'{stack}'}</code> vira a linguagem.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Assunto</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 dark:text-neutral-200" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Mensagem</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 dark:text-neutral-200 resize-none" placeholder="Escreva a mensagem..." />
                </div>
                {sendError && <p className="text-[11px] text-red-500">{sendError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={sending} onClick={() => setRecipient(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">Cancelar</button>
                  <button type="button" disabled={sending || !subject.trim() || !message.trim() || (!useEmail && !useChat)} onClick={send} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold">
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
                    <p className="text-[10px] font-black uppercase text-neutral-400">E-mails enviados</p>
                    <p className="text-xl font-black dark:text-white">{useEmail ? `${okCount('email')}/${results.length}` : '—'}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
                    <p className="text-[10px] font-black uppercase text-neutral-400">Mensagens no chat</p>
                    <p className="text-xl font-black dark:text-white">{useChat ? `${okCount('chat')}/${results.length}` : '—'}</p>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {results.filter(r => (!r.email.ok && !r.email.skipped) || (!r.chat.ok && !r.chat.skipped)).map(r => (
                    <div key={r.userId} className="flex items-start gap-2 text-[11px] text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span><strong>{r.name}</strong>: {[!r.email.ok && !r.email.skipped && `e-mail (${r.email.error})`, !r.chat.ok && !r.chat.skipped && `chat (${r.chat.error})`].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))}
                  {results.every(r => (r.email.ok || r.email.skipped) && (r.chat.ok || r.chat.skipped)) && (
                    <p className="flex items-center gap-2 text-[11px] text-emerald-600"><Check className="w-3.5 h-3.5" /> Tudo enviado.</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setRecipient(null)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Fechar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
