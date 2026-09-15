import { useState, useRef, useEffect } from 'react'

export interface ConsoleLog {
  ts: string
  text: string
  type: 'info' | 'error' | 'warn' | 'stdout'
  isDb?: boolean
}

export function isDatabaseLog(text: string): boolean {
  if (!text) return false
  const t = text.trim()

  // Spring Boot / Hibernate / HikariCP / JDBC logs
  if (
    t.includes('Hibernate:') ||
    t.includes('org.hibernate.SQL') ||
    t.includes('org.hibernate.orm.jdbc.bind') ||
    t.includes('org.hibernate.type.descriptor') ||
    t.includes('org.hibernate.engine') ||
    t.includes('com.zaxxer.hikari') ||
    t.includes('HikariPool') ||
    t.includes('HikariDataSource') ||
    t.includes('HikariConfig') ||
    t.includes('binding parameter [')
  ) {
    return true
  }

  // Node.js database clients (pg, oracledb, actions)
  if (
    t.includes('Executed query') ||
    t.includes('[DB SQL]') ||
    t.includes('[DB]') ||
    t.includes('[SQL]') ||
    t.includes('Database query error')
  ) {
    return true
  }

  // Raw SQL statement fragments
  if (
    /^\s*(select|insert\s+into|update|delete\s+from|alter\s+table|create\s+table|drop\s+table)\b/i.test(t) ||
    /^\s*(from|where|order\s+by|group\s+by|left\s+join|inner\s+join|right\s+join|values)\b/i.test(t)
  ) {
    return true
  }

  return false
}

export function useIDEConsole() {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [showConsole, setShowConsole] = useState(true)
  const [isDetailedConsole, setIsDetailedConsoleState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ide_console_detailed') === 'true'
    }
    return false
  })
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const setIsDetailedConsole = (val: boolean | ((prev: boolean) => boolean)) => {
    setIsDetailedConsoleState(prev => {
      const nextVal = typeof val === 'function' ? val(prev) : val
      if (typeof window !== 'undefined') {
        localStorage.setItem('ide_console_detailed', String(nextVal))
      }
      return nextVal
    })
  }

  const addConsoleLog = (text: string, type: 'info' | 'error' | 'warn' | 'stdout' = 'stdout') => {
    const isDb = isDatabaseLog(text)
    setConsoleLogs(prev => [...prev, {
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type,
      isDb
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
    clearConsole,
    isDetailedConsole,
    setIsDetailedConsole
  }
}

