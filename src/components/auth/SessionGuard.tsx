'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { signOut } from '@/app/auth/actions'
import { isTauri } from '@/utils/tauriUtils'
import { KIND_COOKIE, chooseUrl, isProtectedPath, placeText, revokedUrl, type SlotOther } from '@/lib/sessions/slotCore'

const BEAT_MS = 60_000
const MIN_GAP_MS = 15_000

/**
 * Cuida da regra "1 sessão de IDE + 1 de navegador por usuário" no lado do cliente:
 *  - na IDE (Tauri), marca o cookie `mb_kind=ide` para o servidor saber qual vaga usar;
 *  - nas áreas da plataforma, bate no servidor a cada minuto (e ao voltar o foco da aba): mantém a vaga viva e descobre se esta sessão
 *    foi encerrada por outro login, mostrando o aviso em vez de deixar o usuário descobrir por um erro.
 */
export function SessionGuard() {
  const pathname = usePathname()
  const { t, language } = useI18n()
  const [revoked, setRevoked] = useState<SlotOther | null | false>(false)
  const [leaving, setLeaving] = useState(false)
  const lastBeat = useRef(0)

  useEffect(() => {
    if (!isTauri()) return
    const host = window.location.hostname
    const domain = host.endsWith('metabuilderpro.com') ? '; domain=.metabuilderpro.com' : ''
    document.cookie = `${KIND_COOKIE}=ide; path=/; max-age=31536000; SameSite=Lax${domain}`
  }, [])

  useEffect(() => {
    if (!pathname || !isProtectedPath(pathname) || revoked !== false) return
    let stopped = false

    const beat = async () => {
      const now = Date.now()
      if (stopped || now - lastBeat.current < MIN_GAP_MS) return
      lastBeat.current = now
      try {
        const res = await fetch('/api/session/heartbeat', { cache: 'no-store', credentials: 'same-origin' })
        if (!res.ok) return
        const body = await res.json() as { status?: string; by?: SlotOther | null }
        if (stopped) return
        if (body.status === 'revoked') setRevoked(body.by ?? null)
        else if (body.status === 'occupied') window.location.href = chooseUrl(window.location.pathname + window.location.search)
      } catch {
        // sem rede: tenta de novo no próximo batimento
      }
    }

    void beat()
    const id = window.setInterval(beat, BEAT_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void beat() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [pathname, revoked])

  if (revoked === false) return null

  const k = (key: string) => t(`device_sessions.${key}`)
  const place = placeText(revoked)
  const when = revoked?.since ? new Date(revoked.since).toLocaleString(language) : ''
  const message = place && when
    ? k('kicked_desc_place').replace('{place}', place).replace('{time}', when)
    : k('kicked_desc')

  const leave = async () => {
    setLeaving(true)
    try {
      await signOut()
      document.cookie = 'passkey_authenticated=; path=/; max-age=0; SameSite=Lax'
    } finally {
      window.location.href = revokedUrl(revoked)
    }
  }

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="session-kicked-title" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-[2rem] border border-neutral-200 bg-white p-8 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><LogOut className="h-6 w-6" /></div>
        <div className="space-y-2">
          <h2 id="session-kicked-title" className="text-xl font-black tracking-tight">{k('kicked_title')}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{k('kicked_local')}</p>
        </div>
        <button
          type="button" onClick={leave} disabled={leaving}
          className="w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {k('kicked_btn')}
        </button>
      </div>
    </div>
  )
}
