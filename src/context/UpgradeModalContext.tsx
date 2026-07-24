'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { UpgradeModal } from '@/components/ui/UpgradeModal'
import { DesktopOnlyModal } from '@/components/ui/DesktopOnlyModal'

interface UpgradeModalContextValue {
  openUpgrade: (featureName: string) => void
  openDesktopOnly: (featureName: string) => void
}

const UpgradeModalContext = createContext<UpgradeModalContextValue>({
  openUpgrade: () => {},
  openDesktopOnly: () => {},
})

export function useUpgradeModal() {
  return useContext(UpgradeModalContext)
}

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null)
  const [desktopFeature, setDesktopFeature] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setUpgradeFeature(null)
    setDesktopFeature(null)
  }, [pathname])

  const openUpgrade = useCallback((featureName: string) => {
    setUpgradeFeature(featureName)
  }, [])

  const openDesktopOnly = useCallback((featureName: string) => {
    setDesktopFeature(featureName)
  }, [])

  return (
    <UpgradeModalContext.Provider value={{ openUpgrade, openDesktopOnly }}>
      {children}
      <UpgradeModal
        isOpen={!!upgradeFeature}
        featureName={upgradeFeature || ''}
        onClose={() => setUpgradeFeature(null)}
      />
      <DesktopOnlyModal
        isOpen={!!desktopFeature}
        featureName={desktopFeature || ''}
        onClose={() => setDesktopFeature(null)}
      />
    </UpgradeModalContext.Provider>
  )
}
