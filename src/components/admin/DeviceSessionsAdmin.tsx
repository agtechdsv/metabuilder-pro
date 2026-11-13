'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, MonitorSmartphone, RefreshCw, Save } from 'lucide-react'
import { adminDeviceOverviewAction, adminRevokeDeviceAction, adminSaveDeviceSettingsAction } from '@/app/actions/deviceSessions'
import { useToast } from '@/components/ui/Toast'
import { askDialog } from '@/utils/askDialog'
import { placeText } from '@/lib/sessions/slotCore'
import { DEFAULT_DEVICE_SETTINGS, type AdminDeviceOverview, type DeviceErrorCode, type DeviceSettingsDto } from '@/lib/sessions/deviceTypes'

// Tela só do SuperAdmin (como Campanhas, Parceiros e Lixeira): textos em português.

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

const MODES: { value: DeviceSettingsDto['mode']; label: string; hint: string }[] = [
  { value: 'off', label: 'Desligado', hint: 'Nada é registrado nem bloqueado.' },
  { value: 'observe', label: 'Observar', hint: 'Registra as sessões e as tentativas em segunda máquina, sem bloquear ninguém. Use por alguns dias antes de valer.' },
  { value: 'enforce', label: 'Valer', hint: 'Uma sessão de IDE e uma de navegador por usuário. Entrar em outra máquina exige escolher qual sessão manter.' },
]

const ERRORS: Partial<Record<DeviceErrorCode, string>> = {
  forbidden: 'Só o SuperAdmin pode fazer isso.',
  invalid_settings: 'Valores fora do permitido.',
  unknown: 'Não foi possível concluir. O script scripts/sessoes-dispositivos.sql já foi rodado?',
}

const EVENT_LABEL: Record<string, string> = {
  takeover: 'Troca de dispositivo',
  conflict: 'Tentativa em 2ª máquina',
  cap_reached: 'Limite de trocas atingido',
  code_failed: 'Código errado demais',
}

/** O conflito pode ser uma 2ª máquina tentando entrar ou a mesma sessão de login aparecendo em outro dispositivo (cookies copiados?). */
const eventLabel = (e: { event: string; meta: Record<string, unknown> }) =>
  e.event === 'conflict' && e.meta?.reason === 'same_session_other_device' ? 'Mesma sessão em outro dispositivo' : EVENT_LABEL[e.event] || e.event

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR')
const kindLabel = (k: string | null) => (k === 'ide' ? 'IDE' : 'Navegador')

export function DeviceSessionsAdmin() {
  const { toast } = useToast()
  const [overview, setOverview] = useState<AdminDeviceOverview | null>(null)
  const [settings, setSettings] = useState<DeviceSettingsDto>(DEFAULT_DEVICE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminDeviceOverviewAction()
    if (r.success) { setOverview(r.overview); setSettings(r.overview.settings); setError(null) }
    else setError(ERRORS[r.code] || ERRORS.unknown!)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (settings.mode === 'enforce' && overview?.settings.mode !== 'enforce') {
      const ok = await askDialog(
        'Ao ligar o modo "Valer", quem entrar em uma segunda máquina do mesmo tipo terá de escolher qual sessão manter. Você já conferiu os Termos de Serviço e a Política de Privacidade?',
        { kind: 'warning', okLabel: 'Ligar', cancelLabel: 'Cancelar' },
      )
      if (!ok) return
    }
    setBusy(true)
    const r = await adminSaveDeviceSettingsAction(settings)
    setBusy(false)
    if (r.success) { toast('Ajustes das sessões salvos.', 'success'); await load() }
    else toast(ERRORS[r.code] || ERRORS.unknown!, 'error')
  }

  const revoke = async (id: string, who: string) => {
    if (!(await askDialog(`Encerrar a sessão de ${who}? A pessoa será desconectada em até um minuto.`, { kind: 'warning' }))) return
    const r = await adminRevokeDeviceAction(id)
    if (r.success) { toast('Sessão encerrada.', 'success'); await load() } else toast(ERRORS[r.code] || ERRORS.unknown!, 'error')
  }

  const num = (v: string) => Math.trunc(Number(v) || 0)

  return (
    <section className="space-y-6 rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><MonitorSmartphone className="h-6 w-6" /></div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider">Sessões e dispositivos</h3>
            <p className="mt-1 text-xs font-medium text-neutral-500">Uma sessão de IDE e uma de navegador por usuário. O SuperAdmin não ocupa vaga.</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} title="Atualizar" aria-label="Atualizar" className="rounded-xl p-2 text-neutral-400 hover:text-indigo-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {loading && !overview && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>}

      {overview && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-4">
              <span className={labelCls}>Modo</span>
              <div className="grid gap-3 md:grid-cols-3">
                {MODES.map(m => (
                  <label key={m.value} className={`cursor-pointer rounded-2xl border p-4 text-sm transition-colors ${settings.mode === m.value ? 'border-indigo-500 bg-indigo-500/5' : 'border-neutral-200 dark:border-neutral-800'}`}>
                    <input type="radio" name="device-mode" className="mr-2" checked={settings.mode === m.value} onChange={() => setSettings(s => ({ ...s, mode: m.value }))} />
                    <span className="font-black">{m.label}</span>
                    <span className="mt-1 block text-xs text-neutral-500">{m.hint}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><label className={labelCls}>Minutos sem atividade para liberar a vaga</label><input className={inputCls} type="number" min={1} max={1440} value={settings.idleMinutes} onChange={e => setSettings(s => ({ ...s, idleMinutes: num(e.target.value) }))} /></div>
            <div><label className={labelCls}>Trocas por dia antes de pedir código por e-mail</label><input className={inputCls} type="number" min={1} max={50} value={settings.takeoverCap} onChange={e => setSettings(s => ({ ...s, takeoverCap: num(e.target.value) }))} /></div>
            <div><label className={labelCls}>Segundos entre conferências no servidor</label><input className={inputCls} type="number" min={10} max={600} value={settings.ttlSeconds} onChange={e => setSettings(s => ({ ...s, ttlSeconds: num(e.target.value) }))} /></div>
            <div className="flex items-end">
              <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              ['Sessões ativas', overview.totals.active], ['IDE', overview.totals.ide], ['Navegador', overview.totals.web],
              ['Trocas (7 dias)', overview.totals.takeovers7d], ['Tentativas em 2ª máquina (7 dias)', overview.totals.conflicts7d], ['Limite atingido (7 dias)', overview.totals.caps7d],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-2xl font-black">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-widest">Quem trocou mais (7 dias)</h4>
            {overview.swappers.length === 0 ? <p className="text-sm text-neutral-500">Nada a destacar.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-widest text-neutral-400"><tr><th className="py-2">Usuário</th><th>Trocas</th><th>Tentativas em 2ª máquina</th><th>Limite atingido</th></tr></thead>
                <tbody>{overview.swappers.map(s => (
                  <tr key={s.user_id} className={`border-t border-neutral-100 dark:border-neutral-800 ${s.caps > 0 ? 'bg-amber-500/5' : ''}`}>
                    <td className="py-2 font-semibold">{s.email || s.user_id}</td><td>{s.takeovers}</td><td>{s.conflicts}</td><td>{s.caps}</td>
                  </tr>))}</tbody></table></div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-widest">Sessões ativas agora</h4>
            {overview.active.length === 0 ? <p className="text-sm text-neutral-500">Nenhuma sessão registrada ainda. No modo Desligado nada é registrado.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-widest text-neutral-400"><tr><th className="py-2">Usuário</th><th>Tipo</th><th>Dispositivo</th><th>Onde</th><th>Desde</th><th>Última atividade</th><th /></tr></thead>
                <tbody>{overview.active.map(a => (
                  <tr key={a.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 font-semibold">{a.email || a.user_id}</td><td>{kindLabel(a.kind)}</td><td>{a.label || '-'}</td><td>{placeText(a, '-')}</td><td>{when(a.created_at)}</td><td>{when(a.last_seen_at)}</td>
                    <td className="text-right"><button type="button" onClick={() => revoke(a.id, a.email || a.user_id)} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">Encerrar</button></td>
                  </tr>))}</tbody></table></div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-widest">Eventos recentes (7 dias)</h4>
            {overview.events.length === 0 ? <p className="text-sm text-neutral-500">Nenhum evento.</p> : (
              <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white text-[10px] uppercase tracking-widest text-neutral-400 dark:bg-neutral-900"><tr><th className="py-2">Quando</th><th>Evento</th><th>Usuário</th><th>Tipo</th><th>Dispositivo</th><th>Onde</th></tr></thead>
                <tbody>{overview.events.map(e => (
                  <tr key={e.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-2">{when(e.created_at)}</td><td className="font-semibold">{eventLabel(e)}</td><td>{e.email || e.user_id}</td><td>{kindLabel(e.kind)}</td><td>{e.label || '-'}</td><td>{placeText(e, '-')}</td>
                  </tr>))}</tbody></table></div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
