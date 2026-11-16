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
