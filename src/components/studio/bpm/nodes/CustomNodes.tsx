import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Zap, Play, CheckCircle2, GitMerge, Trash2 } from 'lucide-react';

// Common style for node wrappers
const nodeStyle = "px-4 py-3 rounded-xl border shadow-sm min-w-[220px] bg-white dark:bg-neutral-900 transition-all relative group";

const DeleteButton = ({ id, selected }: { id: string, selected: boolean }) => {
  const { deleteElements } = useReactFlow();
  
  if (!selected) return null;
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
      }}
      className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 z-10"
      title="Excluir Nó"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
};

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  return (
    <div className={`${nodeStyle} ${selected ? 'border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/20' : 'border-emerald-500/50 shadow-emerald-500/10'}`}>
      <DeleteButton id={id} selected={!!selected} />
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

export const ActionNode = memo(({ id, data, selected }: NodeProps) => {
  return (
    <div className={`${nodeStyle} ${selected ? 'border-indigo-500 shadow-indigo-500/20 ring-2 ring-indigo-500/20' : 'border-indigo-500/50 shadow-indigo-500/10'}`}>
      <DeleteButton id={id} selected={!!selected} />
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

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  return (
    <div className={`${nodeStyle} ${selected ? 'border-amber-500 shadow-amber-500/20 ring-2 ring-amber-500/20' : 'border-amber-500/50 shadow-amber-500/10'}`}>
      <DeleteButton id={id} selected={!!selected} />
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
      
      {/* Verdadeiro */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="true" 
        className="w-4 h-4 bg-emerald-500 border-2 border-white dark:border-neutral-900"
        style={{ left: '30%' }}
      >
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">
          Sim
        </div>
      </Handle>
      
      {/* Falso */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="false" 
        className="w-4 h-4 bg-red-500 border-2 border-white dark:border-neutral-900"
        style={{ left: '70%' }}
      >
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest">
          Não
        </div>
      </Handle>
    </div>
  );
});
