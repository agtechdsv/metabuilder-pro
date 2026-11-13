'use client'

import React, { useEffect, useState } from 'react'
import { ArrowRight, Handshake, Loader2, Save } from 'lucide-react'
import { getPartnerSettings, savePartnerSettings } from '@/app/actions/partners'
import { useToast } from '@/components/ui/Toast'
import { DEFAULT_PARTNER_SETTINGS, type PartnerSettings } from '@/lib/partners'

// Tela só do SuperAdmin (textos em português). Aqui ficam só as REGRAS da comissão (aba Regras de Preços);
// quem são os parceiros, os interessados e os pagamentos ficam na aba Parceiros.

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

export function PartnerSettingsAdmin({ onOpenPartnersTab }: { onOpenPartnersTab: () => void }) {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_PARTNER_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPartnerSettings().then(r => {
      if (r.success) setSettings(r.settings)
      else toast('Só o SuperAdmin pode ver os ajustes dos parceiros.', 'error')
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true)
    const r = await savePartnerSettings(settings)
    setBusy(false)
    toast(r.success ? 'Ajustes dos parceiros salvos.' : 'Valor fora do permitido.', r.success ? 'success' : 'error')
  }

  const num = (v: string) => (v === '' ? ('' as unknown as number) : Number(v))

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black"><Handshake className="h-5 w-5 text-indigo-500" />Comissão dos parceiros</h3>
        <button type="button" onClick={onOpenPartnersTab} className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:underline">Gerenciar parceiros na aba Parceiros<ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div> : (
        <div className="grid gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950 md:grid-cols-5">
          <label className="block"><span className={labelCls}>% padrão da comissão</span>
            <input type="number" min={0} max={100} className={inputCls} value={settings.defaultPercent} onChange={e => setSettings({ ...settings, defaultPercent: num(e.target.value) })} /></label>
          <label className="block"><span className={labelCls}>Carência (dias)</span>
            <input type="number" min={0} max={90} className={inputCls} value={settings.graceDays} onChange={e => setSettings({ ...settings, graceDays: num(e.target.value) })} /></label>
          <label className="block"><span className={labelCls}>Mínimo por parceiro (R$)</span>
            <input type="number" min={1} className={inputCls} value={settings.minPayout} onChange={e => setSettings({ ...settings, minPayout: num(e.target.value) })} /></label>
          <label className="block"><span className={labelCls}>Teto do lote (R$)</span>
            <input type="number" min={1} className={inputCls} value={settings.payoutCap} onChange={e => setSettings({ ...settings, payoutCap: num(e.target.value) })} /></label>
          <div className="flex items-end"><button type="button" disabled={busy} onClick={save} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-black text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-700"><Save className="h-3.5 w-3.5" />Salvar ajustes</button></div>
          <p className="text-[10px] text-neutral-400 md:col-span-5">A comissão é calculada sobre o valor que o cliente indicado pagou (bruto, sem descontar as taxas do Asaas) em cada pagamento, e só fica disponível depois da carência. Mudar o % padrão vale para as próximas comissões; as já geradas não mudam.</p>
        </div>
      )}
    </section>
  )
}
