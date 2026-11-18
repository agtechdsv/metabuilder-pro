'use client'

import { useState, useEffect } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { IDELanding } from './IDELanding'

interface HomeClientRouterProps {
  webContent: React.ReactNode
  user: any
  /** aviso mostrado dentro do cartão de entrada da IDE (ex.: sessão encerrada por outro login) */
  ideNotice?: React.ReactNode
}

export function HomeClientRouter({ webContent, user, ideNotice }: HomeClientRouterProps) {
  // Rede de segurança: quem escolhe entre a página da IDE e a do site é a classe `is-tauri` no <html>, posta pelo script do <head> ao carregar.
  // Em 18/11/2026, na IDE, o botão "Entrar novamente" do aviso de sessão encerrada caiu na página do SITE (a de "Permanecer lá" caiu certo): a classe
  // não foi posta a tempo. Aqui conferimos de novo logo depois de carregar (e algumas vezes em seguida, caso o ambiente do Tauri apareça com atraso).
  useEffect(() => {
    const mark = () => {
      if (isTauri()) document.documentElement.classList.add('is-tauri')
      return document.documentElement.classList.contains('is-tauri')
    }
    if (mark()) return
    const timers = [100, 300, 800, 2000].map(ms => window.setTimeout(mark, ms))
    return () => timers.forEach(window.clearTimeout)
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .is-tauri .web-only-content { display: none !important; }
        html:not(.is-tauri) .ide-only-content { display: none !important; }
      `}} />
      <div className="web-only-content">
        {webContent}
      </div>
      <div className="ide-only-content">
        <IDELanding user={user} notice={ideNotice} />
      </div>
    </>
  )
}
