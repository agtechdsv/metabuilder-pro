'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Handshake, Inbox, Loader2, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react'
import { decidePartnerApplication, deletePartnerApplication, listPartnerApplications } from '@/app/actions/partnerApplications'
import { suggestPartnerCode, type ApplicationRow } from '@/lib/partnerApplications'
import {
  createPartnerPayout, getPartnerSettings, listPartnerPayouts, listPartners, releaseStuckPayoutItem, savePartner, savePartnerSettings,
} from '@/app/actions/partners'
import { useToast } from '@/components/ui/Toast'
import { DEFAULT_PARTNER_SETTINGS, type PartnerErrorCode, type PartnerInput, type PartnerRow, type PartnerSettings, type PayoutRow } from '@/lib/partners'
import { PIX_KEY_TYPES } from '../../../supabase/functions/_shared/partnerCommission'

// Tela só do SuperAdmin (como Campanhas e Regras de Preços): textos em português. Quem paga, quanto e quando é decisão do SuperAdmin.

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

const ERRORS: Record<PartnerErrorCode, string> = {
  not_authorized: 'Só o SuperAdmin pode fazer isso.',
  user_not_found: 'Não há conta no MetaBuilder com esse e-mail. O parceiro precisa se cadastrar antes.',
  code_invalid: 'Código inválido: use de 3 a 32 letras, números, hífen ou sublinhado.',
  code_in_use: 'Esse código já está em uso (por outro parceiro ou como código de indicação de um cliente).',
  pix_invalid: 'Chave Pix inválida para o tipo escolhido.',
  document_invalid: 'CPF ou CNPJ inválido.',
  percent_invalid: 'Valor fora do permitido.',
  already_partner: 'Essa conta já é parceira.',
  nothing_to_pay: 'Nenhum dos parceiros escolhidos tem saldo disponível acima do mínimo, ou falta a chave Pix.',
  payout_cap_exceeded: 'O total do lote passa do teto de segurança. Escolha menos parceiros ou aumente o teto.',
  no_partners: 'Escolha ao menos um parceiro.',
  not_found: 'Não encontrado.',
  unknown: 'Não foi possível concluir.',
}
const errText = (r: { code: PartnerErrorCode; error?: string }) => ERRORS[r.code] + (r.code === 'unknown' && r.error ? ` (${r.error})` : '')

const ITEM_LABEL: Record<string, string> = { pending: 'Preparando', sending: 'Enviando', sent: 'Em processamento no Asaas', done: 'Pago', failed: 'Falhou' }
const CHANNEL_LABEL: Record<string, string> = { consulting: 'Consultoria ou software house', freelancer: 'Desenvolvedor ou freelancer', community: 'Comunidade, conteúdo ou instrutor', integrator: 'Integrador ou profissional de TI', other: 'Outro' }
const SKIP_LABEL: Record<string, string> = { suspended: 'suspenso', no_pix_key: 'sem chave Pix', below_minimum: 'abaixo do mínimo' }

const EMPTY: PartnerInput = { userEmail: '', name: '', document: '', pixKey: '', pixKeyType: 'CPF', code: '', commissionPercent: null, status: 'active', notes: '' }

export function PartnersAdmin() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_PARTNER_SETTINGS)
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<PartnerInput | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [showDecided, setShowDecided] = useState(false)
  /** candidatura que está sendo aprovada: ao salvar o parceiro, ela é marcada como aprovada */
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, p, o, a] = await Promise.all([getPartnerSettings(), listPartners(), listPartnerPayouts(), listPartnerApplications()])
    if (s.success) setSettings(s.settings)
    if (p.success) setPartners(p.partners)
    if (o.success) setPayouts(o.payouts)
    if (a.success) setApplications(a.applications)
    if (!s.success) toast(errText(s), 'error')
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    setBusy(true)
    const r = await savePartnerSettings(settings)
    setBusy(false)
    toast(r.success ? 'Ajustes dos parceiros salvos.' : errText(r), r.success ? 'success' : 'error')
  }

  const savePartnerForm = async () => {
    if (!form) return
    setBusy(true)
    const r = await savePartner(form)
    setBusy(false)
    if (!r.success) { toast(errText(r), 'error'); return }
    if (approvingId) await decidePartnerApplication(approvingId, 'approved', r.id)
    toast('Parceiro salvo.', 'success')
    setForm(null)
    setApprovingId(null)
    load()
  }

  // aprovar = abrir o cadastro do parceiro já preenchido com o que a pessoa informou (conferir, ajustar e salvar)
  const approve = (a: ApplicationRow) => {
    setApprovingId(a.id)
    setForm({ ...EMPTY, userEmail: a.email, name: a.name, code: suggestPartnerCode(a.name), notes: [a.company, a.audience].filter(Boolean).join(' | ') })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const decide = async (id: string, status: 'rejected' | 'new') => {
    const r = await decidePartnerApplication(id, status)
    toast(r.success ? (status === 'rejected' ? 'Candidatura recusada.' : 'Candidatura reaberta.') : (r.error || 'Não foi possível concluir.'), r.success ? 'success' : 'error')
    load()
  }
  const removeApplication = async (a: ApplicationRow) => {
    if (!window.confirm(`Apagar de vez a candidatura de ${a.name}? Não dá para desfazer.`)) return
    const r = await deletePartnerApplication(a.id)
    toast(r.success ? 'Candidatura apagada.' : (r.error || 'Não foi possível concluir.'), r.success ? 'success' : 'error')
    load()
  }
  const newApps = applications.filter(a => a.status === 'new')
  const shownApps = showDecided ? applications : newApps

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // o que o lote pagaria agora (mesma conta do SQL; a função SQL é quem decide de verdade)
  const plan = useMemo(() => partners.filter(p => selected.has(p.id)).map(p => {
    const reason = p.status !== 'active' ? 'suspended' : !p.pixKey ? 'no_pix_key' : p.summary.payable < settings.minPayout ? 'below_minimum' : null
    return { p, reason }
  }), [partners, selected, settings.minPayout])
  const payable = plan.filter(x => !x.reason)
  const total = payable.reduce((s, x) => s + x.p.summary.payable, 0)

  const send = async () => {
    setBusy(true)
    const r = await createPartnerPayout(payable.map(x => x.p.id), note)
    setBusy(false)
    setConfirming(false)
    if (!r.success) { toast(errText(r), 'error'); load(); return }
    toast(`Lote criado: ${money(r.total)}. ${r.sent} Pix enviado(s)${r.failed ? `, ${r.failed} com falha` : ''}.`, r.failed ? 'info' : 'success')
    setSelected(new Set()); setNote('')
    load()
  }

  const release = async (itemId: string) => {
    if (!window.confirm('Confirme no painel do Asaas que NÃO existe a transferência deste item. Liberar devolve as comissões ao saldo do parceiro.')) return
    const r = await releaseStuckPayoutItem(itemId)
    toast(r.success ? 'Item liberado.' : errText(r), r.success ? 'success' : 'error')
    load()
  }

  const num = (v: string) => (v === '' ? ('' as unknown as number) : Number(v))

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black"><Handshake className="h-5 w-5 text-indigo-500" />Parceiros (indicadores com comissão)</h3>
        <button type="button" onClick={() => { setApprovingId(null); setForm({ ...EMPTY }) }} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"><Plus className="h-3.5 w-3.5" />Novo parceiro</button>
      </div>

      <div className="mb-5 grid gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950 md:grid-cols-5">
        <label className="block"><span className={labelCls}>% padrão da comissão</span>
          <input type="number" min={0} max={100} className={inputCls} value={settings.defaultPercent} onChange={e => setSettings({ ...settings, defaultPercent: num(e.target.value) })} /></label>
        <label className="block"><span className={labelCls}>Carência (dias)</span>
          <input type="number" min={0} max={90} className={inputCls} value={settings.graceDays} onChange={e => setSettings({ ...settings, graceDays: num(e.target.value) })} /></label>
        <label className="block"><span className={labelCls}>Mínimo por parceiro (R$)</span>
          <input type="number" min={1} className={inputCls} value={settings.minPayout} onChange={e => setSettings({ ...settings, minPayout: num(e.target.value) })} /></label>
        <label className="block"><span className={labelCls}>Teto do lote (R$)</span>
          <input type="number" min={1} className={inputCls} value={settings.payoutCap} onChange={e => setSettings({ ...settings, payoutCap: num(e.target.value) })} /></label>
        <div className="flex items-end"><button type="button" disabled={busy} onClick={saveSettings} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-black text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-700"><Save className="h-3.5 w-3.5" />Salvar ajustes</button></div>
        <p className="text-[10px] text-neutral-400 md:col-span-5">A comissão é calculada sobre o valor que o cliente indicado pagou (bruto, sem descontar as taxas do Asaas) em cada pagamento, e só fica disponível depois da carência. Mudar o % padrão vale para as próximas comissões; as já geradas não mudam.</p>
      </div>

      {applications.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 p-4 dark:border-amber-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black"><Inbox className="h-4 w-4 text-amber-500" />Interessados em ser parceiro{newApps.length > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">{newApps.length} nova(s)</span>}</p>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500"><input type="checkbox" checked={showDecided} onChange={e => setShowDecided(e.target.checked)} />Mostrar também as já decididas</label>
          </div>
          {shownApps.length === 0 ? <p className="text-xs text-neutral-400">Nenhuma candidatura nova.</p> : (
            <ul className="space-y-3">{shownApps.map(a => (
              <li key={a.id} className="rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{a.name} <span className="font-normal text-neutral-400">· {a.email}{a.phone ? ` · ${a.phone}` : ''}{a.company ? ` · ${a.company}` : ''}</span></p>
                  <span className="text-[10px] text-neutral-400">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-neutral-500"><b>Perfil:</b> {CHANNEL_LABEL[a.channel] || a.channel}{a.audience ? <> · <b>Divulgação:</b> {a.audience}</> : null}</p>
                {a.message && <p className="mt-1 whitespace-pre-wrap text-neutral-500"><b>Mensagem:</b> {a.message}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {a.status === 'new' ? (<>
                    <button type="button" onClick={() => approve(a)} className="rounded-lg bg-indigo-600 px-3 py-1 font-black text-white hover:bg-indigo-500">Aprovar e cadastrar...</button>
                    <button type="button" onClick={() => decide(a.id, 'rejected')} className="rounded-lg border border-neutral-300 px-3 py-1 font-black text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300">Recusar</button>
                  </>) : (<>
                    <span className={a.status === 'approved' ? 'font-black text-emerald-600' : 'font-black text-neutral-500'}>{a.status === 'approved' ? 'Aprovada' : 'Recusada'}</span>
                    <button type="button" onClick={() => decide(a.id, 'new')} className="rounded-lg border border-neutral-300 px-3 py-1 font-black text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300">Reabrir</button>
                  </>)}
                  <button type="button" onClick={() => removeApplication(a)} aria-label={`Apagar candidatura de ${a.name}`} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>))}</ul>
          )}
          <p className="mt-3 text-[10px] text-neutral-400">Para aprovar, a pessoa precisa já ter conta no MetaBuilder PRO com o mesmo e-mail da candidatura. Se ainda não tiver, o cadastro avisa; peça que ela crie a conta e tente de novo.</p>
        </div>
      )}

      {form && (
        <div className="mb-5 space-y-3 rounded-2xl border border-indigo-200 p-4 dark:border-indigo-900">
          <div className="flex items-center justify-between"><p className="text-sm font-black">{form.id ? 'Editar parceiro' : 'Novo parceiro'}</p><button type="button" onClick={() => { setForm(null); setApprovingId(null) }} aria-label="Fechar"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-3 md:grid-cols-3">
            {!form.id && <label className="block md:col-span-3"><span className={labelCls}>E-mail da conta MetaBuilder do parceiro</span>
              <input className={inputCls} value={form.userEmail} onChange={e => setForm({ ...form, userEmail: e.target.value })} placeholder="parceiro@empresa.com" /></label>}
            <label className="block"><span className={labelCls}>Nome</span><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>CPF ou CNPJ (opcional)</span><input className={inputCls} value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>Código do link (?ref=)</span><input className={inputCls + ' uppercase'} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PAULO10" /></label>
            <label className="block"><span className={labelCls}>Tipo da chave Pix</span>
              <select className={inputCls} value={form.pixKeyType} onChange={e => setForm({ ...form, pixKeyType: e.target.value as PartnerInput['pixKeyType'] })}>{PIX_KEY_TYPES.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="block"><span className={labelCls}>Chave Pix</span><input className={inputCls} value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>% próprio (vazio = padrão)</span>
              <input type="number" min={0} max={100} className={inputCls} value={form.commissionPercent ?? ''} onChange={e => setForm({ ...form, commissionPercent: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label className="block"><span className={labelCls}>Situação</span>
              <select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'suspended' })}><option value="active">Ativo</option><option value="suspended">Suspenso (não gera comissão nem entra em lote)</option></select></label>
            <label className="block md:col-span-2"><span className={labelCls}>Observações (só você vê)</span><input className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <button type="button" disabled={busy} onClick={savePartnerForm} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar parceiro</button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div> : partners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400 dark:border-neutral-800">Nenhum parceiro cadastrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <th className="px-2 py-2" /><th className="px-2 py-2">Parceiro</th><th className="px-2 py-2">Código</th><th className="px-2 py-2">%</th><th className="px-2 py-2">Indicados</th>
              <th className="px-2 py-2">A pagar</th><th className="px-2 py-2">Em carência</th><th className="px-2 py-2">Em lote</th><th className="px-2 py-2">Pago</th><th className="px-2 py-2">Pix</th><th className="px-2 py-2" />
            </tr></thead>
            <tbody>{partners.map(p => (
              <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-2 py-2"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Selecionar ${p.name}`} /></td>
                <td className="px-2 py-2"><p className="font-bold">{p.name}{p.status === 'suspended' && <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[9px] font-black text-neutral-600">SUSPENSO</span>}</p><p className="text-[11px] text-neutral-400">{p.userEmail}</p></td>
                <td className="px-2 py-2 font-mono text-xs">{p.code}</td>
                <td className="px-2 py-2">{p.commissionPercent ?? settings.defaultPercent}%{p.commissionPercent == null && <span className="text-[10px] text-neutral-400"> (padrão)</span>}</td>
                <td className="px-2 py-2">{p.subscribed}/{p.referrals}</td>
                <td className="px-2 py-2 font-black text-emerald-600">{money(p.summary.payable)}{p.summary.clawback > 0 && <span className="block text-[10px] font-bold text-red-500">desconta {money(p.summary.clawback)} de estornos</span>}</td>
                <td className="px-2 py-2 text-amber-600">{money(p.summary.waiting)}</td>
                <td className="px-2 py-2 text-sky-600">{money(p.summary.inPayout)}</td>
                <td className="px-2 py-2">{money(p.summary.paid)}</td>
                <td className="px-2 py-2 text-[11px]">{p.pixKey ? <span className="font-mono">{p.pixKeyType}: {p.pixKey}</span> : <span className="font-bold text-amber-600">sem chave</span>}</td>
                <td className="px-2 py-2"><button type="button" aria-label={`Editar ${p.name}`} onClick={() => setForm({ id: p.id, name: p.name, document: p.document || '', pixKey: p.pixKey || '', pixKeyType: p.pixKeyType || 'CPF', code: p.code, commissionPercent: p.commissionPercent, status: p.status, notes: p.notes || '' })} className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"><Pencil className="h-3.5 w-3.5" /></button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200 p-4 dark:border-emerald-900">
          {!confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold">{selected.size} selecionado(s): {payable.length} entram no lote, <span className="text-emerald-600">{money(total)}</span>{plan.length - payable.length > 0 && <span className="text-neutral-400"> ({plan.length - payable.length} fora: {plan.filter(x => x.reason).map(x => `${x.p.name} (${SKIP_LABEL[x.reason!]})`).join(', ')})</span>}</p>
              <button type="button" disabled={payable.length === 0 || busy} onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"><Send className="h-3.5 w-3.5" />Pagar por Pix...</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-black text-red-600">Confirmar o envio de {money(total)} por Pix, da conta do Asaas, agora? Não dá para desfazer.</p>
              <ul className="space-y-1 text-xs">{payable.map(x => <li key={x.p.id}><b>{x.p.name}</b>: {money(x.p.summary.payable)} para {x.p.pixKeyType} <span className="font-mono">{x.p.pixKey}</span></li>)}</ul>
              <input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="Observação do lote (opcional)" />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={send} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Sim, enviar os Pix</button>
                <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {payouts.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">Últimos lotes</p>
          <div className="space-y-3">{payouts.map(o => (
            <div key={o.id} className="rounded-2xl border border-neutral-200 p-3 text-xs dark:border-neutral-800">
              <p className="font-black">{new Date(o.createdAt).toLocaleString()} · {money(o.total)} · {o.status === 'done' ? 'concluído' : o.status === 'partial' ? 'parcial' : o.status === 'failed' ? 'falhou' : 'em andamento'}{o.note ? ` · ${o.note}` : ''}</p>
              <ul className="mt-1 space-y-1">{o.items.map(i => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{i.partnerName}</span><span>{money(i.amount)}</span><span className="font-mono text-neutral-400">{i.pixKeyType}: {i.pixKey}</span>
                  <span className={i.status === 'done' ? 'font-black text-emerald-600' : i.status === 'failed' ? 'font-black text-red-600' : 'font-black text-amber-600'}>{ITEM_LABEL[i.status] || i.status}</span>
                  {i.failReason && <span className="text-red-500">{i.failReason}</span>}
                  {i.receiptUrl && <a href={i.receiptUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">comprovante</a>}
                  {i.status === 'sending' && !i.asaasTransferId && <button type="button" onClick={() => release(i.id)} className="rounded-lg border border-amber-300 px-2 py-0.5 font-black text-amber-700 hover:bg-amber-50">Liberar (conferi no Asaas)</button>}
                </li>))}</ul>
            </div>))}</div>
        </div>
      )}
    </section>
  )
}
