'use client'

import React from 'react'
import CommunityHubView from '@/components/client/CommunityHubView'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export default function CommunityPopoutPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black p-4 md:p-8 relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-7xl mx-auto mt-12 md:mt-0 pt-12 md:pt-4">
        <CommunityHubView hideHeader={true} />
      </div>
    </div>
  )
}
