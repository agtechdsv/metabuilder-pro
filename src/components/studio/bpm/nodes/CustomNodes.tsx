import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Zap, Play, CheckCircle2, GitMerge, Trash2, Mail, Edit, PlusCircle, Clock, MousePointer2, Webhook, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

// Common style for node wrappers
const nodeStyle = "px-4 py-3 rounded-xl border shadow-sm min-w-[220px] bg-white dark:bg-neutral-900 transition-all relative group";

const DeleteButton = ({ id, selected }: { id: string, selected: boolean }) => {
  const { deleteElements } = useReactFlow();
  const { t } = useI18n();
  
  if (!selected) return null;
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
      }}
      className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 z-10"
      title={t('bpm.nodes.delete_node')}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
};

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const { t } = useI18n();
  const types = (data.triggerType as string[]) || (data.triggerType ? [data.triggerType as string] : []);
  let Icon = Zap;
  let title = t('bpm.nodes.trigger_not_configured');
  let desc = t('bpm.nodes.configure_sidebar');

  if (types.length === 1) {
    const type = types[0];
    if (type === 'insert') { title = t('bpm.nodes.on_insert'); desc = t('bpm.nodes.db_trigger'); Icon = PlusCircle; }
    else if (type === 'update') { title = t('bpm.nodes.on_update'); desc = t('bpm.nodes.db_trigger'); Icon = Edit; }
    else if (type === 'delete') { title = t('bpm.nodes.on_delete'); desc = t('bpm.nodes.db_trigger'); Icon = Trash2; }
    else if (type === 'manual') { title = t('bpm.nodes.manual_action'); desc = t('bpm.nodes.by_button'); Icon = MousePointer2; }
    else if (type === 'scheduled') { title = t('bpm.nodes.scheduled'); desc = t('bpm.nodes.cron_job'); Icon = Clock; }
    else if (type === 'webhook') { title = t('bpm.nodes.webhook_inbound', 'Webhook Inbound'); desc = t('bpm.nodes.external_api', 'Chamada API Externa'); Icon = Webhook; }
  } else if (types.length > 1) {
    title = t('bpm.nodes.multiple_triggers');
    desc = t('bpm.nodes.events_configured').replace('{count}', String(types.length));
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
  const { t } = useI18n();
  const type = data.actionType as string;
  let Icon = Play;
  let title = t('bpm.nodes.action_not_configured');
  let desc = t('bpm.nodes.configure_sidebar');

  if (type === 'email') { title = t('bpm.nodes.send_email'); desc = t('bpm.nodes.notification'); Icon = Mail; }
  else if (type === 'update') { 
    const fields = (data.actionFields as any[])?.length || 0;
    title = t('bpm.nodes.update_record'); 
    desc = fields > 0 ? t('bpm.nodes.fields_count').replace('{count}', String(fields)) : t('bpm.nodes.db_action'); 
    Icon = Edit; 
  }
  else if (type === 'insert') { 
    const fields = (data.actionFields as any[])?.length || 0;
    title = t('bpm.nodes.insert_record'); 
    desc = fields > 0 ? t('bpm.nodes.fields_count').replace('{count}', String(fields)) : t('bpm.nodes.db_action'); 
    Icon = PlusCircle; 
  }
  else if (type === 'delete') { 
    const filters = (data.actionFilters as any[])?.length || 0;
    title = t('bpm.nodes.delete_record'); 
    desc = filters > 0 ? t('bpm.nodes.filters_count').replace('{count}', String(filters)) : t('bpm.nodes.warning_no_filters'); 
    Icon = Trash2; 
  }
  else if (type === 'webhook') { 
    const method = data.webhookMethod as string || 'POST';
    title = t('bpm.nodes.api_call'); 
    desc = `${method} ${t('bpm.nodes.webhook')}`; 
    Icon = Webhook; 
  }

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
  const { t } = useI18n();
  const groups = (data.conditionGroups as any[]) || [];
  const totalRules = groups.reduce((acc, g) => acc + (g.rules?.length || 0), 0);

  let Icon = GitMerge;
  let title = totalRules > 0 ? t('bpm.nodes.multiple_triggers') : t('bpm.nodes.condition_ifelse');
  let desc = totalRules > 0 
    ? t('bpm.nodes.rules_groups_count').replace('{rules}', String(totalRules)).replace('{groups}', String(groups.length))
    : t('bpm.nodes.configure_logic');

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
          {t('bpm.nodes.yes')}
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
          {t('bpm.nodes.no')}
        </div>
      </Handle>
    </div>
  );
});

export const ResponseNode = memo(({ id, data, selected }: NodeProps) => {
  const { t } = useI18n();
  const allowAction = data.responseAllowAction !== false; // default is true
  let Icon = allowAction ? CheckCircle2 : ShieldAlert;
  
  let title = data.label as string || (allowAction ? t('bpm.nodes.response_allow', 'Permitir e Continuar') : t('bpm.nodes.response_block', 'Bloquear Ação'));
  let desc = data.responseMessage ? t('bpm.nodes.with_message', 'Com Mensagem') : t('bpm.nodes.silent', 'Silencioso');

  return (
    <div className={`${nodeStyle} ${selected ? 'border-rose-500 shadow-rose-500/20 ring-2 ring-rose-500/20' : 'border-rose-500/50 shadow-rose-500/10'}`}>
      <DeleteButton id={id} selected={!!selected} />
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-rose-500" />
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allowAction ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            {title}
          </h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
});
