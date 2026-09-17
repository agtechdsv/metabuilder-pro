'use client'

import React, { Suspense } from 'react'
import { InternalBrowser } from '@/components/preview/InternalBrowser'

export default function AppPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen bg-neutral-900 flex items-center justify-center text-indigo-400">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      }
    >
      <InternalBrowser isWindow={true} />
    </Suspense>
  )
}
