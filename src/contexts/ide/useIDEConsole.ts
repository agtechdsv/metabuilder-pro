import { useState, useRef, useEffect } from 'react'

export interface ConsoleLog {
  ts: string
  text: string
  type: 'info' | 'error' | 'warn' | 'stdout'
}

export function useIDEConsole() {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [showConsole, setShowConsole] = useState(true)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const addConsoleLog = (text: string, type: 'info' | 'error' | 'warn' | 'stdout' = 'stdout') => {
    setConsoleLogs(prev => [...prev, {
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type
    }])
  }

  const clearConsole = () => setConsoleLogs([])

  // Auto-scroll console to bottom on new logs
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleLogs])

  return {
    consoleLogs,
    showConsole,
    setShowConsole,
    consoleEndRef,
    addConsoleLog,
    clearConsole
  }
}
