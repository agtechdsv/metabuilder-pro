import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Zap, Play, CheckCircle2, GitMerge, Trash2, Mail, Edit, PlusCircle, Clock, MousePointer2 } from 'lucide-react';

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
  const types = (data.triggerType as string[]) || (data.triggerType ? [data.triggerType as string] : []);
  let Icon = Zap;
  let title = 'Gatilho não configurado';
  let desc = 'Configure na aba lateral';

  if (types.length === 1) {
    const type = types[0];
    if (type === 'insert') { title = 'Ao Inserir Registro'; desc = 'Gatilho de Banco'; Icon = PlusCircle; }
    else if (type === 'update') { title = 'Ao Atualizar Registro'; desc = 'Gatilho de Banco'; Icon = Edit; }
    else if (type === 'delete') { title = 'Ao Excluir Registro'; desc = 'Gatilho de Banco'; Icon = Trash2; }
    else if (type === 'manual') { title = 'Ação Manual'; desc = 'Por botão'; Icon = MousePointer2; }
    else if (type === 'scheduled') { title = 'Agendado'; desc = 'Cron Job'; Icon = Clock; }
  } else if (types.length > 1) {
    title = 'Múltiplos Gatilhos';
    desc = `${types.length} eventos configurados`;
    Icon = Zap;
  }

  return (
    <div className={`${nodeStyle} ${selected ? 'border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/20' : 'border-emerald-500/50 shadow-emerald-500/10'} ${types.length === 0 && 'border-red-500 border-dashed'}`}>
      <DeleteButton id={id} selected={!!selected} />
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${types.length > 0 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 text-red-600'} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className={`text-sm font-bold ${types.length > 0 ? 'text-neutral-900 dark:text-white' : 'text-red-500'}`}>
            {data.label as string || title}
          </h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
            {data.label ? title : desc}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
});

export const ActionNode = memo(({ id, data, selected }: NodeProps) => {
  const type = data.actionType as string;
  let Icon = Play;
  let title = 'Ação não configurada';
  let desc = 'Configure na aba lateral';

  if (type === 'email') { title = 'Enviar E-mail'; desc = 'Notificação'; Icon = Mail; }
  else if (type === 'update') { title = 'Atualizar Registro'; desc = 'Ação de Banco'; Icon = Edit; }
  else if (type === 'insert') { title = 'Inserir Registro'; desc = 'Ação de Banco'; Icon = PlusCircle; }
  else if (type === 'delete') { title = 'Excluir Registro'; desc = 'Ação de Banco'; Icon = Trash2; }

  return (
    <div className={`${nodeStyle} ${selected ? 'border-indigo-500 shadow-indigo-500/20 ring-2 ring-indigo-500/20' : 'border-indigo-500/50 shadow-indigo-500/10'} ${!type && 'border-red-500 border-dashed'}`}>
      <DeleteButton id={id} selected={!!selected} />
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500" />
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${type ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-red-100 text-red-600'} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className={`text-sm font-bold ${type ? 'text-neutral-900 dark:text-white' : 'text-red-500'}`}>
            {data.label as string || title}
          </h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
            {data.label ? title : desc}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </div>
  );
});

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const groups = (data.conditionGroups as any[]) || [];
  const totalRules = groups.reduce((acc, g) => acc + (g.rules?.length || 0), 0);

  let Icon = GitMerge;
  let title = totalRules > 0 ? 'Múltiplas Condições' : 'Condição (If/Else)';
  let desc = totalRules > 0 ? `${totalRules} Regras em ${groups.length} Grupo(s)` : 'Configure a lógica If/Else';

  return (
    <div className={`${nodeStyle} ${selected ? 'border-amber-500 shadow-amber-500/20 ring-2 ring-amber-500/20' : 'border-amber-500/50 shadow-amber-500/10'}`}>
      <DeleteButton id={id} selected={!!selected} />
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            {data.label as string || title}
          </h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
            {data.label ? title : desc}
          </p>
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
