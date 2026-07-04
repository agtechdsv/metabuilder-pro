'use client'

import React, { useEffect, useState } from 'react'
import { MetaVoiceView } from '@/components/client/MetaVoiceView'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { createClient } from '@/utils/supabase/client'

export default function MetaVoicePopoutPage() {
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black p-4 md:p-8 relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-7xl mx-auto mt-12 md:mt-0 pt-12 md:pt-4">
        <MetaVoiceView userId={userId} hideHeader={true} />
      </div>
    </div>
  )
}
