import React from "react";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { SystemVariableOptions } from "../SystemVariableOptions";

export function ResponsePropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, t } = props;
  const dbModels: any[] = props.dbModels || [];
  const dbFields: any[] = props.dbFields || [];
  
  const allowAction = selectedNode.data?.responseAllowAction !== false; // default is true
  const message = selectedNode.data?.responseMessage || '';

  return (
    <div className="space-y-4 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
      <h4 className="text-xs font-black text-rose-600 dark:text-rose-500 uppercase tracking-widest flex items-center gap-2">
        {t('bpm.canvas.response_config', 'Configuração de Resposta')}
      </h4>

      <div>
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">
          {t('bpm.canvas.action_allowed', 'Ação Permitida?')}
        </label>
        <div className="flex bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-1">
          <button
            onClick={() => updateNodeData(selectedNode.id, { responseAllowAction: true })}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition-all ${allowAction ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-sm' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('bpm.canvas.yes_allow', 'Sim, Permitir')}
          </button>
          <button
            onClick={() => updateNodeData(selectedNode.id, { responseAllowAction: false })}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition-all ${!allowAction ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 shadow-sm' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
          >
            <ShieldAlert className="w-4 h-4" />
            {t('bpm.canvas.no_block', 'Não, Bloquear')}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">
            {t('bpm.canvas.response_message', 'Mensagem de Retorno (Toast/Alerta)')}
          </label>
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              const newText = message ? `${message} {{${val}}}` : `{{${val}}}`;
              updateNodeData(selectedNode.id, { responseMessage: newText });
              e.target.value = '';
            }}
            className="bg-transparent border-none text-[9px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-28 text-right p-0"
          >
            <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">{t('bpm.canvas.plus_variable', '+ Variável')}</option>
            <SystemVariableOptions t={t} queryNames={props.queryNames} />
            {[...dbModels].sort((a, b) => (a.display_name || a.db_table_name || a.name).localeCompare(b.display_name || b.db_table_name || b.name)).map((m: any) => {
              const tableName = m.display_name || m.db_table_name || m.name;
              const fields = dbFields.filter((f: any) => f.model_id === m.id);
              if (fields.length === 0) return null;
              return (
                <optgroup key={m.id} label={tableName} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                  {[...fields].sort((a, b) => (a.display_name || a.db_column_name || a.name).localeCompare(b.display_name || b.db_column_name || b.name)).map((f: any) => (
                    <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                      {f.display_name || f.db_column_name || f.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <p className="text-[9px] text-neutral-400 mb-2 leading-relaxed">
          {t('bpm.canvas.response_message_desc', 'Mensagem que será exibida para o usuário. Útil para explicar o motivo do bloqueio ou dar feedback de sucesso.')} {t('bpm.canvas.response_message_vars', 'Aceita variáveis, como {{pedidos.id}}.')}
        </p>
        <textarea
          value={message}
          onChange={(e) => updateNodeData(selectedNode.id, { responseMessage: e.target.value })}
          rows={3}
          placeholder={t('bpm.canvas.response_message_placeholder', 'Ex: O CPF informado é inválido.')}
          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-rose-500 resize-none"
        />
      </div>
    </div>
  );
}
