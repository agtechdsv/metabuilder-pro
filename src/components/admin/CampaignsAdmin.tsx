'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Flame, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { deleteCampaign, getIClubSettings, listCampaigns, saveCampaign, saveIClubSettings, type CampaignInput } from '@/app/actions/admin'
import { useToast } from '@/components/ui/Toast'
import { campaignOffPercent, localizedText } from '@/lib/campaigns'
import { chargeBreakdown, type Cycle } from '../../../supabase/functions/_shared/pricing'
import { getPricingRules } from '@/app/actions/admin'

// Tela só do SuperAdmin (como a de Regras de Preços): textos em português.

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY: CampaignInput = {
  name: { pt: '', en: '', es: '' }, headline: { pt: '', en: '', es: '' },
  discount_percent: 50, months: 2, starts_at: '', ends_at: '', is_active: true, allowed_emails: [],
}

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

function statusOf(c: any, now = Date.now()): { label: string; cls: string } {
  if (!c.is_active) return { label: 'Desligada', cls: 'bg-neutral-200 text-neutral-600' }
  if (new Date(c.ends_at).getTime() < now) return { label: 'Encerrada', cls: 'bg-neutral-200 text-neutral-600' }
  if (new Date(c.starts_at).getTime() > now) return { label: 'Agendada', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'No ar', cls: 'bg-emerald-100 text-emerald-700' }
}

export function CampaignsAdmin() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<(CampaignInput & { emails: string }) | null>(null)
  const [rules, setRules] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listCampaigns()
    if (res.success) setCampaigns((res as any).campaigns || [])
    else toast(res.error || 'Não foi possível carregar as campanhas.', 'error')
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); getPricingRules().then(r => { if (r.success) setRules(r.rules) }) }, [load])

  const edit = (c?: any) => setForm(c
    ? { id: c.id, name: { pt: c.name?.pt || '', en: c.name?.en || '', es: c.name?.es || '' }, headline: { pt: c.headline?.pt || '', en: c.headline?.en || '', es: c.headline?.es || '' },
        discount_percent: Number(c.discount_percent), months: Number(c.months), starts_at: toLocalInput(c.starts_at), ends_at: toLocalInput(c.ends_at),
        is_active: !!c.is_active, allowed_emails: c.allowed_emails || [], emails: (c.allowed_emails || []).join(', ') }
    : { ...EMPTY, emails: '' })

  const save = async () => {
    if (!form) return
    setSaving(true)
    const { emails, ...input } = form
    const res = await saveCampaign({ ...input, allowed_emails: emails.split(/[,\s;]+/).filter(Boolean) })
    setSaving(false)
    if (res.success) { toast('Campanha salva.', 'success'); setForm(null); load() }
    else toast(res.error || 'Não foi possível salvar.', 'error')
  }

  const remove = async (c: any) => {
    if (!window.confirm(`Excluir a campanha "${localizedText(c.name, 'pt')}"? Quem já comprou nela mantém o que contratou.`)) return
    const res = await deleteCampaign(c.id)
    if (res.success) { toast('Campanha excluída.', 'success'); load() } else toast(res.error || 'Não foi possível excluir.', 'error')
  }

  // prévia com a tabela de preços atual: 1 licença em cada ciclo (a mesma conta que o checkout usa)
  const preview = form && rules && Number(form.discount_percent) > 0 && Number(form.months) > 0
    ? (['monthly', 'semiannual', 'yearly'] as Cycle[]).map(cycle => ({
        cycle,
        first: chargeBreakdown({ rules, licenses: 1, cycle, campaign: { percent: Number(form.discount_percent), months: Number(form.months), licenses: 1 } }).total,
        regular: chargeBreakdown({ rules, licenses: 1, cycle }).total,
      }))
    : null
  const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const cycleName: Record<string, string> = { monthly: 'Mensal', semiannual: 'Semestral', yearly: 'Anual' }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40" data-help-id="platform.campaigns">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500"><Flame className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-neutral-900 dark:text-white">Campanhas de preço</h3>
            <p className="mt-1 text-xs text-neutral-500">Ex.: Black November. Nos primeiros meses de uso o cliente paga uma % da tabela por licença; esse preço substitui os descontos de volume e ciclo (vale o menor). Só para quem nunca pagou. A condição fica gravada na assinatura.</p>
          </div>
        </div>
        {!form && (
          <button type="button" onClick={() => edit()} className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"><Plus className="h-4 w-4" /> Nova campanha</button>
        )}
      </div>

      {form && (
        <div className="mt-5 space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="grid gap-3 md:grid-cols-3">
            {(['pt', 'en', 'es'] as const).map(l => (
              <label key={l} className="block"><span className={labelCls}>Nome ({l})</span>
                <input className={inputCls} value={form.name[l]} onChange={e => setForm({ ...form, name: { ...form.name, [l]: e.target.value } })} placeholder={l === 'pt' ? 'Black November' : ''} /></label>
            ))}
            {(['pt', 'en', 'es'] as const).map(l => (
              <label key={'h' + l} className="block"><span className={labelCls}>Chamada da faixa ({l})</span>
                <input className={inputCls} value={form.headline[l]} onChange={e => setForm({ ...form, headline: { ...form.headline, [l]: e.target.value } })} placeholder={l === 'pt' ? 'Black November: pague metade' : ''} /></label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block"><span className={labelCls}>% da tabela cobrado</span>
              <input type="number" min={1} max={100} className={inputCls} value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} />
              <span className="mt-1 block text-[10px] text-neutral-400">50 = metade do preço ({campaignOffPercent({ discount_percent: form.discount_percent })}% de desconto)</span></label>
            <label className="block"><span className={labelCls}>Meses de uso</span>
              <input type="number" min={1} max={36} className={inputCls} value={form.months} onChange={e => setForm({ ...form, months: Number(e.target.value) })} /></label>
            <label className="block"><span className={labelCls}>Início</span>
              <input type="datetime-local" className={inputCls} value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>Fim</span>
              <input type="datetime-local" className={inputCls} value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
          </div>
          <label className="block"><span className={labelCls}>Só para estes e-mails (opcional, para testar)</span>
            <input className={inputCls} value={form.emails} onChange={e => setForm({ ...form, emails: e.target.value })} placeholder="vazio = todos; ou seu@email.com, outro@email.com" />
            <span className="mt-1 block text-[10px] text-neutral-400">Com e-mails aqui, a campanha só aparece e só vale para essas contas. Use para testar em produção antes de abrir para todos.</span></label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Campanha ligada</label>

          {preview && (
            <div className="rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-950">
              <p className="mb-1 font-black uppercase tracking-widest text-neutral-400">Prévia: 1 licença, primeira cobrança (com a tabela de preços de hoje)</p>
              {preview.map(p => (
                <p key={p.cycle} className="font-bold text-neutral-700 dark:text-neutral-200">{cycleName[p.cycle]}: <span className="text-emerald-600">{money(p.first)}</span> <span className="text-neutral-400">(sem campanha: {money(p.regular)})</span></p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar campanha
            </button>
            <button type="button" onClick={() => setForm(null)} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"><X className="h-4 w-4" /> Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
          : campaigns.length === 0 ? <p className="py-4 text-center text-sm text-neutral-400">Nenhuma campanha criada.</p>
          : campaigns.map(c => {
            const st = statusOf(c)
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-neutral-900 dark:text-white">{localizedText(c.name, 'pt')} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black ${st.cls}`}>{st.label}</span>
                    {c.allowed_emails?.length > 0 && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">restrita a {c.allowed_emails.length} e-mail(s)</span>}</p>
                  <p className="text-[11px] text-neutral-500">{campaignOffPercent(c)}% de desconto nos primeiros {c.months} meses · {new Date(c.starts_at).toLocaleString('pt-BR')} até {new Date(c.ends_at).toLocaleString('pt-BR')}</p>
                </div>
                <button type="button" onClick={() => edit(c)} className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-indigo-600 dark:hover:bg-neutral-800" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(c)} className="rounded-xl p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
      </div>
    </div>
  )
}

/** Teto e carência do desconto de indicação do iClub. */
export function IClubSettingsAdmin() {
  const { toast } = useToast()
  const [cap, setCap] = useState('30')
  const [grace, setGrace] = useState('7')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getIClubSettings().then(r => { if (r.success) { setCap(String((r as any).capPercent)); setGrace(String((r as any).graceDays)) } setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await saveIClubSettings(Number(cap), Number(grace))
    setSaving(false)
    if (res.success) toast('Ajustes do iClub salvos.', 'success'); else toast(res.error || 'Não foi possível salvar.', 'error')
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40" data-help-id="platform.iclub_settings">
      <h3 className="text-base font-black text-neutral-900 dark:text-white">iClub: desconto de indicação</h3>
      <p className="mt-1 text-xs text-neutral-500">O desconto de quem indicou vale enquanto o indicado seguir assinante e soma entre indicados, até o teto abaixo. Começa só depois da carência (para o caso de reembolso por arrependimento). Subir o teto depois é fácil; baixar tira desconto de quem já tem.</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block"><span className={labelCls}>Teto do desconto (%)</span>
          <input type="number" min={0} max={100} disabled={loading} className={inputCls + ' w-32'} value={cap} onChange={e => setCap(e.target.value)} /></label>
        <label className="block"><span className={labelCls}>Carência (dias)</span>
          <input type="number" min={0} max={60} disabled={loading} className={inputCls + ' w-32'} value={grace} onChange={e => setGrace(e.target.value)} /></label>
        <button type="button" disabled={saving || loading} onClick={save} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
      </div>
    </div>
  )
}
