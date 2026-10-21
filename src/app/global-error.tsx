'use client'

import { useEffect, useState } from 'react'

/**
 * Tela de erro do app (substitui a padrão do Next, "This page couldn't load", que não diz o motivo). Mostra a mensagem e o local do erro e deixa
 * copiar os detalhes: na janela da IDE Local (desktop) as ferramentas do navegador nem sempre abrem, e sem o motivo não dá para corrigir.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => { console.error('[global-error]', error) }, [error])

  const detalhes = [
    `Mensagem: ${error?.message || '(sem mensagem)'}`,
    error?.digest ? `Código (digest): ${error.digest}` : '',
    `Página: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    `Quando: ${new Date().toISOString()}`,
    error?.stack ? `\n${error.stack}` : '',
  ].filter(Boolean).join('\n')

  const copiar = async () => {
    try { await navigator.clipboard.writeText(detalhes); setCopied(true) } catch { /* sem permissão da área de transferência: o texto está na tela */ }
  }

  const botao = { padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#111' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Esta página não carregou</h1>
          <p style={{ fontSize: 14, color: '#444', margin: '0 0 20px' }}>Ocorreu um erro ao abrir a tela. Tente recarregar. Se continuar, copie os detalhes abaixo e envie ao suporte.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => reset()} style={{ ...botao, background: '#111', color: '#fff', border: 'none' }}>Recarregar</button>
            <button onClick={() => window.history.back()} style={{ ...botao, background: '#fff', color: '#111', border: '1px solid #ccc' }}>Voltar</button>
            <button onClick={copiar} style={{ ...botao, background: '#fff', color: '#111', border: '1px solid #ccc' }}>{copied ? 'Copiado' : 'Copiar detalhes'}</button>
          </div>
          <pre style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, padding: 12, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>{detalhes}</pre>
        </div>
      </body>
    </html>
  )
}
