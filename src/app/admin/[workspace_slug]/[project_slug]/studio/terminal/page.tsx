import { TerminalView } from '@/components/studio/TerminalView'

export default function TerminalPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex-none p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Terminal Integrado</h1>
        <p className="text-neutral-500 mt-1">Execute comandos locais diretamente no diretório do projeto via PTY Nativo.</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <TerminalView />
      </div>
    </div>
  )
}
