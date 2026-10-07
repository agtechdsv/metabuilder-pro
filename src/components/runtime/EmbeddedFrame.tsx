'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

/** Mensagem que a tela embutida manda ao pai quando o registro já está carregado no formulário. */
export const EMBEDDED_READY_MESSAGE = 'mb:embedded-ready'

/** Se a tela embutida não avisar (versão antiga, sem registro a carregar), o véu sai sozinho depois deste prazo. */
const GIVE_UP_MS = 6000

/**
 * Tela de um caso de uso aberta dentro de uma modal/gaveta. Antes a modal aparecia com o formulário vazio, "piscava" e só
 * então os dados entravam. Agora um véu com indicador cobre o conteúdo até a tela embutida avisar que o registro chegou
 * (ou o prazo acabar), e o formulário aparece já preenchido.
 */
export function EmbeddedFrame({ src, className = 'w-full h-full border-none' }: { src: string; className?: string }) {
  const { t } = useI18n()
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== frame.current?.contentWindow) return
      if (event.data?.type === EMBEDDED_READY_MESSAGE) setReady(true)
    }
    window.addEventListener('message', onMessage)
    const giveUp = setTimeout(() => setReady(true), GIVE_UP_MS)
    return () => { window.removeEventListener('message', onMessage); clearTimeout(giveUp) }
  }, [src])

  return (
    <div className="relative w-full h-full">
      <iframe ref={frame} src={src} className={className} style={{ opacity: ready ? 1 : 0, transition: 'opacity 150ms ease' }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-950" role="status" aria-label={t('common.loading', 'Carregando...')}>
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}
    </div>
  )
}
