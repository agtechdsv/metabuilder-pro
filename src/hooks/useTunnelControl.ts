'use client'

import { useState, useEffect, useCallback } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'

export type TunnelStatus = 'stopped' | 'running' | 'loading'

export function useTunnelControl() {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>('loading')
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Envia broadcast de atualização para outras abas / janelas
  const broadcastStatus = (status: 'stopped' | 'running') => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('metabuilder-tunnel-sync')
        bc.postMessage({ type: 'STATUS_CHANGE', status })
        bc.close()
      } catch (_) {}
    }
  }

  const checkStatus = useCallback(async () => {
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        const isRunning = await invoke<boolean>('statuscli')
        const newStatus: TunnelStatus = isRunning ? 'running' : 'stopped'
        setTunnelStatus(newStatus)
        return isRunning
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const data = await res.json()
      const isRunning = !!data.isRunning
      const newStatus: TunnelStatus = isRunning ? 'running' : 'stopped'
      setTunnelStatus(newStatus)
      return isRunning
    } catch (e) {
      setTunnelStatus('stopped')
      return false
    }
  }, [])

  const startTunnel = useCallback(async () => {
    setIsActionLoading(true)
    setTunnelStatus('loading')
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
        const dir = await appLocalDataDir()
        const configPath = await join(dir, 'metabuilder.config.json')

        await invoke('startcli', {
          mode: 1,
          configPath: configPath,
          lang: language,
        })
        toast(t('workspace_components.tunnel_control.tunnel_started_success', 'Túnel iniciado com sucesso.'), 'success')
        setTunnelStatus('running')
        broadcastStatus('running')
        return true
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: 1, lang: language }),
      })
      const data = await res.json()
      if (data.success) {
        toast(t('workspace_components.tunnel_control.tunnel_started_success', 'Túnel iniciado com sucesso.'), 'success')
        setTunnelStatus('running')
        broadcastStatus('running')
        return true
      } else {
        toast(data.message || t('workspace_components.tunnel_control.process_comm_error', 'Erro ao comunicar com o processo.'), 'error')
        await checkStatus()
        return false
      }
    } catch (e) {
      toast(t('workspace_components.tunnel_control.cli_process_failed', 'Falha ao executar processo CLI.'), 'error')
      await checkStatus()
      return false
    } finally {
      setIsActionLoading(false)
    }
  }, [language, t, toast, checkStatus])

  const stopTunnel = useCallback(async () => {
    setIsActionLoading(true)
    setTunnelStatus('loading')
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('stopcli')
        toast(t('workspace_components.tunnel_control.process_stopped_success', 'Processo parado com sucesso'), 'success')
        setTunnelStatus('stopped')
        broadcastStatus('stopped')
        return true
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const data = await res.json()
      if (data.success) {
        toast(t('workspace_components.tunnel_control.tunnel_stopped_success', 'Túnel parado com sucesso'), 'success')
        setTunnelStatus('stopped')
        broadcastStatus('stopped')
        return true
      } else {
        toast(data.message || t('workspace_components.tunnel_control.process_comm_error', 'Erro ao comunicar com o processo.'), 'error')
        await checkStatus()
        return false
      }
    } catch (e) {
      toast(t('workspace_components.tunnel_control.cli_process_failed', 'Falha ao executar processo CLI.'), 'error')
      await checkStatus()
      return false
    } finally {
      setIsActionLoading(false)
    }
  }, [t, toast, checkStatus])

  const toggleTunnel = useCallback(async () => {
    if (isActionLoading) return
    if (tunnelStatus === 'running') {
      await stopTunnel()
    } else {
      await startTunnel()
    }
  }, [isActionLoading, tunnelStatus, stopTunnel, startTunnel])

  useEffect(() => {
    checkStatus()

    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('metabuilder-tunnel-sync')
      bc.onmessage = (event) => {
        if (event.data?.type === 'STATUS_CHANGE') {
          setTunnelStatus(event.data.status)
        }
      }
    }

    let unlistenLog: (() => void) | null = null
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('tunnel-log', (event) => {
          if (event.payload?.includes('Encerrado') || event.payload?.includes('Terminated')) {
            setTunnelStatus('stopped')
          }
        }).then(unlisten => {
          unlistenLog = unlisten
        }).catch(() => {})
      }).catch(() => {})
    }

    const interval = setInterval(checkStatus, 4000)

    return () => {
      if (bc) bc.close()
      if (unlistenLog) unlistenLog()
      clearInterval(interval)
    }
  }, [checkStatus])

  return {
    tunnelStatus,
    isActionLoading,
    startTunnel,
    stopTunnel,
    toggleTunnel,
    checkStatus,
  }
}
