'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SessionExpiredPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if we are in Tauri
    const isTauri = !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__ || !!(window as any).__TAURI_IPC__
    
    if (isTauri) {
      router.replace('/')
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
    </div>
  )
}
