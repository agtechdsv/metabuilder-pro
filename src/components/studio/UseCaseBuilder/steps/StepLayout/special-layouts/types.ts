import React from 'react'

export interface SpecialLayoutProps {
  config: any
  setConfig: (config: any) => void
  models?: any
  renderFieldOptions: (models: any, filter?: (f: any) => boolean) => React.ReactNode
  orderedModels: any
  t: (key: string, fallback?: string) => string
}
