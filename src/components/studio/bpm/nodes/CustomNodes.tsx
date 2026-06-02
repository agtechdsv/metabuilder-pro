import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap, Play, CheckCircle2, GitMerge } from 'lucide-react';

// Common style for node wrappers
const nodeStyle = "px-4 py-3 rounded-xl border shadow-sm min-w-[220px] bg-white dark:bg-neutral-900 transition-all";

export const TriggerNode = memo(({ data }: NodeProps) => {
  return (
    <div className={`${nodeStyle} border-emerald-500/50 shadow-emerald-500/10`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{data.label as string || 'Gatilho'}</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{data.description as string || 'Evento Inicial'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
});

export const ActionNode = memo(({ data }: NodeProps) => {
  return (
    <div className={`${nodeStyle} border-indigo-500/50 shadow-indigo-500/10`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Play className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{data.label as string || 'Ação'}</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{data.description as string || 'Executar Tarefa'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </div>
  );
});

export const ConditionNode = memo(({ data }: NodeProps) => {
  return (
    <div className={`${nodeStyle} border-amber-500/50 shadow-amber-500/10`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <GitMerge className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{data.label as string || 'Condição'}</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{data.description as string || 'If / Else'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-emerald-500 left-1/4" />
      <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-red-500 left-3/4" />
    </div>
  );
});
