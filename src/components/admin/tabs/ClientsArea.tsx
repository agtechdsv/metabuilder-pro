'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { ClientsTab } from './ClientsTab'
import { NfseTab } from './NfseTab'
import { ChargesTab } from './ChargesTab'
import { attentionCount, useNfseQueue } from '../hooks/useNfseQueue'
import { useAdminCharges } from '../hooks/useAdminCharges'
import type { useClientsAdmin } from '../hooks/useClientsAdmin'

type Sub = 'clients' | 'charges' | 'nfse'

const LABEL: Record<Sub, string> = { clients: 'admin_nfse.tab_clients', charges: 'admin_charges.tab', nfse: 'admin_nfse.tab_nfse' }

/** Aba Clientes do painel: três subabas, Clientes (a tela de sempre), Cobranças (todas as cobranças) e Notas Fiscais (a fila de emissão). */
export function ClientsArea({ hook, refreshKey = 0 }: { hook: ReturnType<typeof useClientsAdmin>; refreshKey?: number }) {
  const { t } = useI18n()
  const [sub, setSub] = useState<Sub>('clients')
  const [chargesUserLabel, setChargesUserLabel] = useState('')
  const nfse = useNfseQueue(refreshKey)
  const charges = useAdminCharges(refreshKey, sub === 'charges')
  const attention = attentionCount(nfse.overview)

  // atalho "Cobranças" na linha de um cliente: abre a subaba já filtrada por ele
  const viewCharges = (userId: string, name: string) => {
    setChargesUserLabel(name)
    charges.update({ userId, status: 'all', q: '', from: '', to: '', method: 'all', dateField: 'due' })
    setSub('charges')
  }

  return (
    <div className="space-y-6">
      <div className="flex w-fit gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-950" role="tablist">
        {(['clients', 'charges', 'nfse'] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={sub === s} data-testid={`clients-sub-${s}`} onClick={() => setSub(s)}
            className={cn('flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold transition-all',
              sub === s ? 'bg-white text-indigo-500 shadow-sm dark:bg-neutral-850 dark:text-indigo-400' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300')}>
            {t(LABEL[s])}
            {s === 'nfse' && attention > 0 && (
              <span data-testid="nfse-attention" className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">{attention}</span>
            )}
          </button>
        ))}
      </div>
      {sub === 'clients' ? <ClientsTab hook={hook} onViewCharges={viewCharges} />
        : sub === 'charges' ? <ChargesTab hook={charges} userLabel={chargesUserLabel} onClearUser={() => setChargesUserLabel('')} />
          : <NfseTab hook={nfse} />}
    </div>
  )
}
