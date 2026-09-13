import React, { useState } from 'react'
import CommunityHubView from './CommunityHubView'
import { CheckMetaView } from './CheckMetaView'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Gamepad2, BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'

type LoungeTab = 'hub' | 'checkmeta' | 'devmind'

export function LoungeView() {
  const [activeTab, setActiveTab] = useState<LoungeTab>('hub')

  const tabs = [
    { id: 'hub', label: 'Community Hub', icon: Users, description: 'Rede social e networking' },
    { id: 'checkmeta', label: 'CheckMeta', icon: Gamepad2, description: 'Arena de xadrez multijogador' },
    { id: 'devmind', label: 'Psicologia do Dev', icon: BrainCircuit, description: 'Saúde mental e bem-estar (Em breve)' },
  ] as const

  return (
    <div className="flex flex-col w-full h-full gap-6">
      
      {/* Lounge Header & Navigation */}
      <div className="flex flex-col gap-4">
        <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-full sm:w-fit overflow-x-auto no-scrollbar mx-auto sm:mx-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as LoungeTab)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap min-w-[140px] sm:min-w-0',
                activeTab === tab.id
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
            >
              <tab.icon className={cn(
                "w-4 h-4",
                activeTab === tab.id && tab.id === 'hub' ? "text-blue-500" : "",
                activeTab === tab.id && tab.id === 'checkmeta' ? "text-indigo-500" : "",
                activeTab === tab.id && tab.id === 'devmind' ? "text-emerald-500" : ""
              )} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'hub' && <CommunityHubView />}
            {activeTab === 'checkmeta' && <CheckMetaView />}
            {activeTab === 'devmind' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mb-6">
                  <BrainCircuit className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">Psicologia do Dev</h2>
                <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                  Um espaço seguro para cuidar da sua saúde mental, com artigos, exercícios de respiração e dicas para lidar com o burnout e o estresse da vida de desenvolvedor. Em breve.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  )
}
