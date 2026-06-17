import { useState, useMemo } from 'react'
import {
  Sliders,
  Compass,
  Database,
  Code,
  Activity,
} from 'lucide-react'

interface UseClientActivityProps {
  activityLogs: any[]
  toast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export function useClientActivity({
  activityLogs = [],
  toast
}: UseClientActivityProps) {
  const [prodFilterProject, setProdFilterProject] = useState<string>('all')
  const [prodFilterUser, setProdFilterUser] = useState<string>('all')
  const [prodFilterPeriod, setProdFilterPeriod] = useState<string>('all')
  const [prodSubTab, setProdSubTab] = useState<'summary' | 'detailed'>('summary')

  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [modalTab, setModalTab] = useState<'visual' | 'raw'>('visual')
  const [copied, setCopied] = useState(false)

  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (prodFilterProject !== 'all' && log.project_id !== prodFilterProject) return false
      if (prodFilterUser !== 'all' && log.user_id !== prodFilterUser) return false
      if (prodFilterPeriod !== 'all') {
        const logDate = new Date(log.session_start)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - logDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (prodFilterPeriod === '7d' && diffDays > 7) return false
        if (prodFilterPeriod === '30d' && diffDays > 30) return false
      }
      return true
    })
  }, [activityLogs, prodFilterProject, prodFilterUser, prodFilterPeriod])

  const handleCloseLogModal = () => {
    setSelectedLog(null)
    setModalTab('visual')
    setCopied(false)
  }

  const handleCopyJson = (events: any) => {
    if (!events) return
    const text = JSON.stringify(events, null, 2)
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        toast('JSON copiado com sucesso!', 'success')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => {
        toast('Erro ao copiar JSON.', 'error')
        console.error('Erro ao copiar:', err)
      })
  }

  const handleDownloadJson = (events: any) => {
    if (!events) return
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session_log_${selectedLog?.id || 'export'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getEventMeta = (action: string) => {
    const normalized = String(action || '').toUpperCase()
    switch (normalized) {
      case 'CONFIG_CHANGE':
        return {
          icon: Sliders,
          label: 'Configuração',
          color: {
            bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50',
            text: 'text-amber-600 dark:text-amber-400',
            badge: 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-750 dark:text-amber-300'
          }
        }
      case 'NAVIGATION':
        return {
          icon: Compass,
          label: 'Navegação',
          color: {
            bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50',
            text: 'text-blue-600 dark:text-blue-400',
            badge: 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-750 dark:text-blue-300'
          }
        }
      case 'SQL_QUERY':
        return {
          icon: Database,
          label: 'Query SQL',
          color: {
            bg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50',
            text: 'text-purple-600 dark:text-purple-400',
            badge: 'bg-purple-50/50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/50 text-purple-750 dark:text-purple-300'
          }
        }
      case 'CODE_GEN':
        return {
          icon: Code,
          label: 'Código',
          color: {
            bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250/50 dark:border-emerald-800/50',
            text: 'text-emerald-600 dark:text-emerald-400',
            badge: 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          }
        }
      default:
        return {
          icon: Activity,
          label: 'Ação',
          color: {
            bg: 'bg-neutral-500/10 dark:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400 border border-neutral-250/50 dark:border-neutral-850/50',
            text: 'text-neutral-600 dark:text-neutral-400',
            badge: 'bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-750 dark:text-neutral-300'
          }
        }
    }
  }

  const eventsArray = useMemo(() => {
    if (!selectedLog?.events) return []
    if (Array.isArray(selectedLog.events)) return selectedLog.events
    if (typeof selectedLog.events === 'string') {
      try {
        const parsed = JSON.parse(selectedLog.events)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        return []
      }
    }
    return []
  }, [selectedLog])

  return {
    prodFilterProject,
    setProdFilterProject,
    prodFilterUser,
    setProdFilterUser,
    prodFilterPeriod,
    setProdFilterPeriod,
    prodSubTab,
    setProdSubTab,
    selectedLog,
    setSelectedLog,
    modalTab,
    setModalTab,
    copied,
    setCopied,
    filteredActivityLogs,
    handleCloseLogModal,
    handleCopyJson,
    handleDownloadJson,
    getEventMeta,
    eventsArray
  }
}
