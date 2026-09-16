import React from 'react'
import { TunnelLogConsoleModal } from '@/components/workspace/tunnel/TunnelLogConsoleModal'

export default function TunnelLogsPage() {
  return (
    <div className="w-full h-screen bg-[#0c0c0c] overflow-hidden">
      <TunnelLogConsoleModal
        isOpen={true}
        onClose={() => {}}
        isWindow={true}
      />
    </div>
  )
}
