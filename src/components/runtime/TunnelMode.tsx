'use client'

import { setPrivateTunnel, setRelayMode } from '@/lib/tunnel/relayClient'

/**
 * Informa ao navegador como falar com o túnel nesta tela: pelo servidor (relay) e, com a assinatura ligada, por um
 * tópico privado da aba. Não desenha nada. Definido já na renderização, antes de qualquer filho abrir um canal.
 */
export function TunnelMode({ relay, privateTunnel }: { relay: boolean; privateTunnel: boolean }) {
  setRelayMode(relay)
  setPrivateTunnel(privateTunnel)
  return null
}
