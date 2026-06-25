'use client';

import { Zap, Play, GitMerge } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

export function FlowSidebar() {
  const { t } = useI18n();

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeLabel: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', nodeLabel);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-4 overflow-y-auto z-10 relative">
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">{t('bpm.sidebar.flow_start')}</h2>
        <div className="space-y-2">
          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-emerald-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'trigger', 'Gatilho')}
            draggable
          >
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold">{t('bpm.sidebar.trigger')}</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 mt-4">{t('bpm.sidebar.logic')}</h2>
        <div className="space-y-2">
          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-amber-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'condition', 'Lógica')}
            draggable
          >
            <GitMerge className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold">{t('bpm.sidebar.logic_ifelse')}</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 mt-4">{t('bpm.sidebar.actions')}</h2>
        <div className="space-y-2">
          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-indigo-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'action', 'Ação')}
            draggable
          >
            <Play className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold">{t('bpm.sidebar.generic_action')}</span>
          </div>

          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-rose-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'response', 'Resposta / Bloqueio')}
            draggable
          >
            <GitMerge className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-bold">{t('bpm.sidebar.response_node', 'Resposta / Bloqueio')}</span>
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-6 text-[10px] text-neutral-400 text-center uppercase tracking-widest">
        {t('bpm.sidebar.drag_to_panel')}
      </div>
    </aside>
  );
}
