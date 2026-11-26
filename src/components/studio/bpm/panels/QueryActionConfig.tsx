import React from "react";
import { Plus, X } from "lucide-react";

/**
 * Configuração da ação "Consultar dados" (relatórios agendados): tabela, colunas (ou agrupar e calcular), filtros com data
 * relativa, ordem, limite e o nome do resultado. O motor (cli/bpmCore.js, runQueryAction) lê exatamente estes campos do nó:
 * queryModelId, queryColumns [{field,label,type}], queryFilters [{field,operator,valueType,value|relKind,relAmount,relUnit}],
 * queryOrderBy/queryOrderDir, queryLimit, queryGroupBy, queryAggregate, queryAggregateField, queryGroupLabelModelId,
 * queryGroupLabelField, queryGroupTitle, queryValueTitle, queryValueType, queryName, querySkipWhenEmpty.
 */

const INPUT = "w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500";
const LABEL = "text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1";
const CARD = "bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3 shadow-sm";

const NUMERIC_TYPE = /numeric|decimal|double|real|float|money|^(small|big)?int(eger)?\d*$|serial/i;
const LABEL_FIELD_GUESS = ['nome', 'name', 'nome_empresa', 'razao_social', 'titulo', 'descricao'];

const RELATIVE_KINDS = [
  { value: 'now_minus', key: 'query_rel_now_minus', fallback: 'Agora menos…' },
  { value: 'start_of_today', key: 'query_rel_start_of_today', fallback: 'Início de hoje' },
  { value: 'start_of_week', key: 'query_rel_start_of_week', fallback: 'Início desta semana (segunda)' },
  { value: 'start_of_last_week', key: 'query_rel_start_of_last_week', fallback: 'Início da semana passada' },
  { value: 'start_of_month', key: 'query_rel_start_of_month', fallback: 'Início deste mês' },
  { value: 'start_of_last_month', key: 'query_rel_start_of_last_month', fallback: 'Início do mês passado' },
  { value: 'start_of_year', key: 'query_rel_start_of_year', fallback: 'Início deste ano' },
];

export function QueryActionConfig(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, t } = props;
  const d: any = selectedNode.data || {};
  const set = (patch: any) => updateNodeData(selectedNode.id, patch);

  const labelOf = (f: any) => f?.widget_options?.label?.text || f?.display_name || f?.db_column_name || f?.name;
  const fieldsOf = (modelId: string) =>
    (dbFields as any[])
      .filter((f) => f.model_id === modelId)
      .map((f) => ({ field: f.db_column_name || f.name, label: labelOf(f), type: f.data_type || 'text' }));

  const modelId: string = d.queryModelId || '';
  const fields = modelId ? fieldsOf(modelId) : [];
  const columns: any[] = d.queryColumns || [];
  const filters: any[] = d.queryFilters || [];
  const grouping = d.queryMode === 'group';
  const aggregate: string = d.queryAggregate || 'count';
  const numericFields = fields.filter((f) => NUMERIC_TYPE.test(String(f.type)));
  const labelFields = d.queryGroupLabelModelId ? fieldsOf(d.queryGroupLabelModelId) : [];

  const setFilter = (index: number, patch: any) => set({ queryFilters: filters.map((f, i) => (i === index ? { ...f, ...patch } : f)) });

  const toggleColumn = (f: { field: string; label: string; type: string }) => {
    const has = columns.some((c) => c.field === f.field);
    set({ queryColumns: has ? columns.filter((c) => c.field !== f.field) : [...columns, { field: f.field, label: f.label, type: f.type }] });
  };

  // ao escolher o campo de agrupamento, sugere a tabela e o campo que mostram o nome (ex.: funcionario_id → funcionarios.nome)
  const pickGroupField = (field: string) => {
    const meta = fields.find((f) => f.field === field);
    const patch: any = { queryGroupBy: field, queryGroupTitle: meta?.label || '', queryGroupLabelModelId: '', queryGroupLabelField: '' };
    if (field.endsWith('_id')) {
      const base = field.slice(0, -3);
      const target = (dbModels as any[]).find((m) => [base + 's', base, base + 'es'].includes(m.db_table_name));
      if (target) {
        patch.queryGroupLabelModelId = target.id;
        const guess = fieldsOf(target.id).find((f) => LABEL_FIELD_GUESS.includes(f.field));
        if (guess) patch.queryGroupLabelField = guess.field;
      }
    }
    set(patch);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-indigo-500/20">
      <div>
        <label className={LABEL}>{t('bpm.canvas.query_table', 'Tabela')}</label>
        <select
          value={modelId}
          onChange={(e) => set({
            queryModelId: e.target.value, queryColumns: [], queryFilters: [], queryOrderBy: '',
            queryGroupBy: '', queryGroupLabelModelId: '', queryGroupLabelField: '', queryAggregateField: '',
          })}
          className={INPUT}
        >
          <option value="">{t('bpm.canvas.select_table_option')}</option>
          {(dbModels as any[]).map((m) => (
            <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
          ))}
        </select>
      </div>

      {!!modelId && (
        <>
          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
            {[
              { v: 'list', label: t('bpm.canvas.query_mode_list', 'Listar registros') },
              { v: 'group', label: t('bpm.canvas.query_mode_group', 'Agrupar e calcular') },
            ].map((opt) => {
              const active = (opt.v === 'group') === grouping;
              return (
                <button
                  key={opt.v}
                  onClick={() => set(opt.v === 'group' ? { queryMode: 'group' } : { queryMode: 'list', queryGroupBy: '' })}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${active ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {!grouping && (
            <div className={CARD}>
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.query_columns', 'Colunas do resultado')}</span>
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {fields.map((f) => (
                  <label key={f.field} className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    <input type="checkbox" checked={columns.some((c) => c.field === f.field)} onChange={() => toggleColumn(f)} className="rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500" />
                    <span>{f.label}</span>
                    <span className="text-[9px] text-neutral-400 font-mono">{f.field}</span>
                  </label>
                ))}
              </div>
              {columns.length === 0 && <p className="text-[9px] text-red-500 mt-2">{t('bpm.canvas.query_columns_required', 'Escolha ao menos uma coluna.')}</p>}
            </div>
          )}

          {grouping && (
            <div className={`${CARD} space-y-3`}>
              <div>
                <label className={LABEL}>{t('bpm.canvas.query_group_by', 'Agrupar por')}</label>
                <select value={d.queryGroupBy || ''} onChange={(e) => pickGroupField(e.target.value)} className={INPUT}>
                  <option value="">{t('bpm.canvas.select_field')}</option>
                  {fields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                </select>
              </div>

              {!!d.queryGroupBy && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>{t('bpm.canvas.query_group_label_table', 'Nome vem da tabela')}</label>
                    <select
                      value={d.queryGroupLabelModelId || ''}
                      onChange={(e) => set({ queryGroupLabelModelId: e.target.value, queryGroupLabelField: '' })}
                      className={INPUT}
                    >
                      <option value="">{t('bpm.canvas.query_group_no_label', '(mostrar o valor do campo)')}</option>
                      {(dbModels as any[]).map((m) => <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>{t('bpm.canvas.query_group_label_field', 'Campo do nome')}</label>
                    <select
                      value={d.queryGroupLabelField || ''}
                      onChange={(e) => set({ queryGroupLabelField: e.target.value })}
                      disabled={!d.queryGroupLabelModelId}
                      className={`${INPUT} disabled:opacity-50`}
                    >
                      <option value="">{t('bpm.canvas.select_field')}</option>
                      {labelFields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>{t('bpm.canvas.query_calculate', 'Calcular')}</label>
                  <select
                    value={aggregate}
                    onChange={(e) => set({ queryAggregate: e.target.value, ...(e.target.value === 'count' ? { queryAggregateField: '', queryValueType: 'integer' } : {}) })}
                    className={INPUT}
                  >
                    <option value="count">{t('bpm.canvas.query_agg_count', 'Contar registros')}</option>
                    <option value="sum">{t('bpm.canvas.query_agg_sum', 'Somar')}</option>
                    <option value="avg">{t('bpm.canvas.query_agg_avg', 'Média')}</option>
                    <option value="min">{t('bpm.canvas.query_agg_min', 'Menor valor')}</option>
                    <option value="max">{t('bpm.canvas.query_agg_max', 'Maior valor')}</option>
                  </select>
                </div>
                {aggregate !== 'count' && (
                  <div>
                    <label className={LABEL}>{t('bpm.canvas.query_agg_field', 'Do campo')}</label>
                    <select
                      value={d.queryAggregateField || ''}
                      onChange={(e) => set({ queryAggregateField: e.target.value, queryValueType: fields.find((f) => f.field === e.target.value)?.type || 'numeric' })}
                      className={INPUT}
                    >
                      <option value="">{t('bpm.canvas.select_field')}</option>
                      {numericFields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>{t('bpm.canvas.query_group_title', 'Título da 1ª coluna')}</label>
                  <input type="text" value={d.queryGroupTitle || ''} onChange={(e) => set({ queryGroupTitle: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>{t('bpm.canvas.query_value_title', 'Título do valor')}</label>
                  <input
                    type="text"
                    value={d.queryValueTitle || ''}
                    placeholder={aggregate === 'count' ? t('bpm.canvas.query_quantity', 'Quantidade') : t('bpm.canvas.query_total', 'Total')}
                    onChange={(e) => set({ queryValueTitle: e.target.value })}
                    className={INPUT}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={CARD}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{t('bpm.canvas.query_filters', 'Filtros')}</span>
              <button
                onClick={() => set({ queryFilters: [...filters, { field: '', operator: '>=', valueType: 'fixed', value: '' }] })}
                className="text-[9px] bg-indigo-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-indigo-600 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> {t('bpm.canvas.query_add_filter', 'Filtro')}
              </button>
            </div>
            {filters.length === 0 && <p className="text-[10px] text-neutral-400 italic">{t('bpm.canvas.query_no_filters', 'Sem filtros: traz todos os registros (até o limite).')}</p>}
            <div className="space-y-3">
              {filters.map((flt, index) => (
                <div key={index} className="relative bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 space-y-2">
                  <button
                    onClick={() => set({ queryFilters: filters.filter((_, i) => i !== index) })}
                    className="absolute top-1 right-1 text-neutral-400 hover:text-red-500 p-0.5"
                    title={t('bpm.canvas.remove_schedule', 'Remover')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="grid grid-cols-[2fr_1fr] gap-2 pr-4">
                    <select value={flt.field || ''} onChange={(e) => setFilter(index, { field: e.target.value })} className={INPUT}>
                      <option value="">{t('bpm.canvas.select_field')}</option>
                      {fields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                    </select>
                    <select value={flt.operator || '>='} onChange={(e) => setFilter(index, { operator: e.target.value })} className={INPUT}>
                      <option value="==">{t('bpm.canvas.op_equal')}</option>
                      <option value="!=">{t('bpm.canvas.op_not_equal')}</option>
                      <option value=">">{t('bpm.canvas.op_greater')}</option>
                      <option value=">=">{t('bpm.canvas.op_greater_equal')}</option>
                      <option value="<">{t('bpm.canvas.op_less')}</option>
                      <option value="<=">{t('bpm.canvas.op_less_equal')}</option>
                      <option value="contains">{t('bpm.canvas.op_contains')}</option>
                    </select>
                  </div>
                  <select value={flt.valueType || 'fixed'} onChange={(e) => setFilter(index, { valueType: e.target.value })} className={INPUT}>
                    <option value="fixed">{t('bpm.canvas.query_value_fixed', 'Valor fixo')}</option>
                    <option value="relative">{t('bpm.canvas.query_value_relative', 'Data relativa')}</option>
                  </select>
                  {(flt.valueType || 'fixed') === 'fixed' ? (
                    <input
                      type="text"
                      value={flt.value || ''}
                      placeholder={t('bpm.canvas.query_value_placeholder', 'Valor (aceita {{sistema.data}})')}
                      onChange={(e) => setFilter(index, { value: e.target.value })}
                      className={INPUT}
                    />
                  ) : (
                    <div className="space-y-2">
                      <select value={flt.relKind || 'now_minus'} onChange={(e) => setFilter(index, { relKind: e.target.value })} className={INPUT}>
                        {RELATIVE_KINDS.map((k) => <option key={k.value} value={k.value}>{t(`bpm.canvas.${k.key}`, k.fallback)}</option>)}
                      </select>
                      {(flt.relKind || 'now_minus') === 'now_minus' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={0}
                            value={flt.relAmount ?? 1}
                            onChange={(e) => setFilter(index, { relAmount: Number(e.target.value) })}
                            className={INPUT}
                          />
                          <select value={flt.relUnit || 'days'} onChange={(e) => setFilter(index, { relUnit: e.target.value })} className={INPUT}>
                            <option value="hours">{t('bpm.canvas.query_unit_hours', 'horas')}</option>
                            <option value="days">{t('bpm.canvas.query_unit_days', 'dias')}</option>
                            <option value="weeks">{t('bpm.canvas.query_unit_weeks', 'semanas')}</option>
                            <option value="months">{t('bpm.canvas.query_unit_months', 'meses')}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-neutral-400 mt-3 leading-relaxed">{t('bpm.canvas.query_filters_hint', 'Para "a semana passada": data >= início da semana passada E data < início desta semana (dois filtros).')}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {!grouping && (
              <div>
                <label className={LABEL}>{t('bpm.canvas.query_order_by', 'Ordenar por')}</label>
                <select value={d.queryOrderBy || ''} onChange={(e) => set({ queryOrderBy: e.target.value })} className={INPUT}>
                  <option value="">{t('bpm.canvas.query_order_none', '(sem ordem)')}</option>
                  {fields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={LABEL}>{t('bpm.canvas.query_order_dir', 'Sentido')}</label>
              <select value={d.queryOrderDir || (grouping ? 'desc' : 'asc')} onChange={(e) => set({ queryOrderDir: e.target.value })} className={INPUT}>
                <option value="asc">{t('bpm.canvas.query_dir_asc', 'Crescente')}</option>
                <option value="desc">{t('bpm.canvas.query_dir_desc', 'Decrescente')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>{t('bpm.canvas.query_limit', 'Máximo de linhas')}</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={d.queryLimit ?? 200}
                onChange={(e) => set({ queryLimit: Math.max(1, Math.min(5000, Number(e.target.value) || 200)) })}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>{t('bpm.canvas.query_name', 'Nome do resultado')}</label>
              <input
                type="text"
                value={d.queryName ?? 'consulta'}
                onChange={(e) => set({ queryName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>

          <p className="text-[10px] text-neutral-500 leading-relaxed bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg p-2">
            {t('bpm.canvas.query_usage', 'No e-mail use')} <code className="font-mono text-indigo-600 dark:text-indigo-400">{`{{${d.queryName || 'consulta'}.tabela}}`}</code>{' '}
            {t('bpm.canvas.query_usage_and', 'e')} <code className="font-mono text-indigo-600 dark:text-indigo-400">{`{{${d.queryName || 'consulta'}.total}}`}</code>.{' '}
            {t('bpm.canvas.query_usage_attach', 'Para mandar a planilha, marque o anexo na ação de e-mail.')}
          </p>

          <label className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={!!d.querySkipWhenEmpty}
              onChange={(e) => set({ querySkipWhenEmpty: e.target.checked })}
              className="mt-0.5 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500"
            />
            <span>{t('bpm.canvas.query_skip_when_empty', 'Não continuar o fluxo se não houver nenhum registro (por exemplo, não enviar e-mail vazio)')}</span>
          </label>
        </>
      )}
    </div>
  );
}
