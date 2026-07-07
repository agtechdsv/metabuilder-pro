'use client'

import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { isTauri } from '@/utils/tauriUtils'

export function IdeUpdaterButton() {
  const [showButton, setShowButton] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [latestVersion, setLatestVersion] = useState('')

  useEffect(() => {
    async function checkUpdate() {
      if (!isTauri()) return

      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const localVersion = await getVersion()
        
        const res = await fetch('/api/releases/latest')
        if (res.ok) {
          const data = await res.json()
          if (data && data.version) {
            const latest = data.version.replace('v', '')
            if (localVersion !== latest) {
              setLatestVersion(latest)
              setShowButton(true)
            }
          }
        }
      } catch (e) {
        console.error('Failed to check for updates', e)
      }
    }

    checkUpdate()
  }, [])

  if (!showButton) return null

  return (
    <div className="relative flex items-center justify-center mb-8 z-10 w-full">
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 p-4 rounded-2xl w-full border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Nova atualização disponível!</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">A versão {latestVersion} do MetaBuilder PRO já está disponível. Atualize agora para obter as novidades e correções mais recentes.</p>
        </div>
        <button 
          onClick={async () => {
            try {
              setIsUpdating(true)
              const { check } = await import('@tauri-apps/plugin-updater')
              const update = await check()
              if (update?.available) {
                await update.downloadAndInstall((event: any) => {
                  if (event.event === 'Finished') {
                    // done
                  }
                })
              } else {
                alert('Não foi possível iniciar a atualização automaticamente. Tente via Central de Downloads.')
                setIsUpdating(false)
              }
            } catch (e: any) {
              console.error('Update failed', e)
              alert(`Erro na atualização: ${e?.message || String(e)}`)
              setIsUpdating(false)
            }
          }}
          disabled={isUpdating}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          {isUpdating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Atualizando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Atualizar para v{latestVersion}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
