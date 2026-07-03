'use client'

import { useState, useEffect } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { IDELanding } from './IDELanding'

interface HomeClientRouterProps {
  webContent: React.ReactNode
  user: any
}

export function HomeClientRouter({ webContent, user }: HomeClientRouterProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    setIsDesktop(isTauri())
  }, [])

  if (isDesktop === null) {
    // Show web content initially to support SSR/SEO for the website
    // Once React hydrates, if it's the IDE, it will swap to the IDELanding.
    return <>{webContent}</>
  }

  if (isDesktop) {
    return <IDELanding user={user} />
  }

  return <>{webContent}</>
}
