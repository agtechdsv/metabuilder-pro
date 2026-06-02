'use client';

import { Zap, Play, GitMerge } from 'lucide-react';

export function FlowSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, nodeLabel: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', nodeLabel);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-4 overflow-y-auto z-10 relative">
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Início do Fluxo</h2>
        <div className="space-y-2">
          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-emerald-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'trigger', 'Gatilho')}
            draggable
          >
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold">Gatilho (Trigger)</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 mt-4">Lógica (Logic)</h2>
        <div className="space-y-2">
          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-amber-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'condition', 'Lógica')}
            draggable
          >
            <GitMerge className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold">Lógica (If/Else)</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 mt-4">Ações (Actions)</h2>
        <div className="space-y-2">
          <div
            className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-grab hover:border-indigo-500 transition-colors flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950"
            onDragStart={(event) => onDragStart(event, 'action', 'Ação')}
            draggable
          >
            <Play className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold">Ação Genérica</span>
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-6 text-[10px] text-neutral-400 text-center uppercase tracking-widest">
        Arraste para o painel
      </div>
    </aside>
  );
}
