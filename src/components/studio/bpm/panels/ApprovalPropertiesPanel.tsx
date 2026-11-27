import React from "react";
import { UserCheck } from "lucide-react";
import { SystemVariableOptions } from "../SystemVariableOptions";

/**
 * Bloco "Aguardar aprovação": o fluxo para aqui e espera alguém decidir. Quem aprova usa a MESMA escolha do e-mail
 * (grupos inteiros ou usuários específicos, guardada em emailGroupsUsers) e também recebe o e-mail de aviso.
 */
export function ApprovalPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, t, roles, openGroupUsersModal } = props;
  const dbModels: any[] = props.dbModels || [];
  const dbFields: any[] = props.dbFields || [];
  const title: string = selectedNode.data?.approvalTitle || '';
  const sel: Record<string, any> = selectedNode.data?.emailGroupsUsers || {};
  const allowSelf = !!selectedNode.data?.approvalAllowSelf;

  return (
    <div className="space-y-4 p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl">
      <h4 className="text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-2">
        <UserCheck className="w-4 h-4" />
        {t('bpm.approval.panel_title', 'Aguardar aprovação')}
      </h4>
      <p className="text-[10px] text-neutral-500 leading-relaxed">
        {t('bpm.approval.intro', 'O fluxo para aqui e espera uma pessoa decidir. Se aprovar, segue pela saída verde; se rejeitar, pela vermelha.')}
      </p>

      <div>
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.approval.approvers', 'Quem pode aprovar')}</label>
        <p className="text-[9px] text-neutral-400 mb-2 leading-relaxed">
          {t('bpm.approval.approvers_desc', 'Escolha um perfil inteiro (qualquer pessoa do perfil pode aprovar) ou usuários específicos. Eles também recebem um e-mail de aviso.')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(roles || []).length > 0 ? (roles as any[]).map((grupo: any) => {
            const selection = sel[grupo.name];
            const isSelected = !!selection;
            const status = isSelected ? (selection === 'all' ? `(${t('bpm.canvas.send_to_all', 'Todos')})` : `(${selection.length} sel.)`) : '';
            return (
              <button
                key={grupo.id}
                type="button"
                onClick={() => openGroupUsersModal(grupo)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1 ${isSelected ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-violet-300'}`}
              >
                {grupo.name}
                {status && <span className={isSelected ? 'text-violet-200 font-normal' : 'text-neutral-400 font-normal'}>{status}</span>}
              </button>
            );
          }) : <span className="text-[10px] text-neutral-400">{t('bpm.canvas.no_groups_found', 'Nenhum grupo encontrado')}</span>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">{t('bpm.approval.title_label', 'Título da tarefa')}</label>
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              updateNodeData(selectedNode.id, { approvalTitle: title ? `${title} {{${val}}}` : `{{${val}}}` });
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
        <input
          type="text"
          value={title}
          onChange={(e) => updateNodeData(selectedNode.id, { approvalTitle: e.target.value })}
          placeholder={t('bpm.approval.title_placeholder', 'Ex.: Pedido {{pedidos.id}} aguarda aprovação')}
          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-violet-500"
        />
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allowSelf}
          onChange={(e) => updateNodeData(selectedNode.id, { approvalAllowSelf: e.target.checked })}
          className="mt-0.5"
        />
        <span className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">{t('bpm.approval.allow_self', 'Quem pediu também pode aprovar o próprio pedido')}</span>
      </label>

      <div className="space-y-1 text-[9px] text-neutral-400 leading-relaxed">
        <p>{t('bpm.approval.after_save_only', 'Use um gatilho de depois de salvar, agendado ou botão. Não funciona em "Antes de salvar", que precisa responder na hora.')}</p>
        <p>{t('bpm.approval.vars_hint', 'Depois da decisão, os textos das ações seguintes aceitam {{aprovacao.decisao}}, {{aprovacao.comentario}} e {{aprovacao.por}}.')}</p>
      </div>
    </div>
  );
}
