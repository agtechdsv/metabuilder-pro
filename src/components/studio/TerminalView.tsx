'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'
import { Terminal as TerminalIcon, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export function TerminalView() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const { t } = useI18n()

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let initialized = false;

    const initTerminal = async () => {
      if (!terminalRef.current || initialized) return
      initialized = true

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: 14,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          selectionBackground: '#4d4d4d'
        }
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      
      term.open(terminalRef.current)
      fitAddon.fit()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      // Start the PTY process in Rust
      try {
        await invoke('spawn_pty', { 
          rows: term.rows, 
          cols: term.cols 
        })
        
        // Listen for output from Rust
        unlisten = await listen<number[]>('pty_output', (event) => {
          const text = new TextDecoder().decode(new Uint8Array(event.payload))
          term.write(text)
        })

        // Send input to Rust
        term.onData((data) => {
          invoke('write_pty', { data }).catch(console.error)
        })

        // Handle resize
        term.onResize(({ cols, rows }) => {
          invoke('resize_pty', { cols, rows }).catch(console.error)
        })

        const handleWindowResize = () => {
          fitAddon.fit()
        }
        window.addEventListener('resize', handleWindowResize)

        setIsInitializing(false)

        return () => {
          window.removeEventListener('resize', handleWindowResize)
        }
      } catch (err) {
        console.error('Failed to spawn PTY', err)
        term.writeln('\x1b[31mFailed to start terminal process.\x1b[0m')
        term.writeln(String(err))
        setIsInitializing(false)
        try {
          const { sendNotification } = await import('@tauri-apps/plugin-notification')
          sendNotification({ 
            title: t('ide.terminal.error_title', 'Erro Crítico no Terminal 🐛'), 
            body: t('ide.terminal.error_body', 'Falha ao iniciar o PTY Nativo: ') + String(err) 
          })
        } catch {}
      }
    }

    initTerminal()

    return () => {
      if (unlisten) unlisten()
      if (xtermRef.current) {
        xtermRef.current.dispose()
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] rounded-xl overflow-hidden border border-neutral-800 shadow-xl relative">
      {/* Header */}
      <div className="h-10 border-b border-neutral-800 bg-[#1e1e1e]/50 flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2 text-neutral-400">
          <TerminalIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Terminal Integrado (PTY)</span>
        </div>
      </div>
      
      {/* Loading state */}
      {isInitializing && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 backdrop-blur-sm z-10">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Terminal Container */}
      <div className="flex-1 w-full h-full p-2 overflow-hidden" ref={terminalRef} />
    </div>
  )
}
