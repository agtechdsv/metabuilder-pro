import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  MAX_JOIN_DEPTH, type FieldHit, type PathHop, type RelationCtx,
  defaultColumnLabel, describePath, fieldsOfModel, isControlField, isSensitiveField, joinSpecOf, modelLabelOf, nextHops, relatedKey, searchFields,
} from "@/lib/bpm/relationPaths";

/**
 * Escolha das colunas da ação "Consultar dados": à esquerda navega-se pelas tabelas (a base e, entrando pela seta ›, as relacionadas, até
 * MAX_JOIN_DEPTH níveis); à direita ficam as colunas escolhidas, na ordem do resultado, com o caminho completo até cada campo.
 * Edita direto as colunas do nó (queryColumns); a coluna relacionada guarda o caminho em `join`.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
  baseModelId: string;
  ctx: RelationCtx;
  /** campos calculados do caso de uso (só existem na tabela base) */
  virtualFields: { field: string; label: string; plainLabel?: string; type: string }[];
  columns: any[];
  /** junção de uma coluna já escolhida (a gravada nela, ou a do formato antigo de um salto) */
  columnJoin: (c: any) => any;
  onChange: (columns: any[]) => void;
}

const ROW = "flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer rounded px-1.5 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/60";
const SECTION = "text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-3 mb-1";

export function QueryColumnsModal({ isOpen, onClose, t, baseModelId, ctx, virtualFields, columns, columnJoin, onChange }: Props) {
  const [path, setPath] = useState<PathHop[]>([]);
  const [search, setSearch] = useState("");
  const [showControl, setShowControl] = useState(false);

  const baseLabel = modelLabelOf(ctx.dbModels.find((m) => m.id === baseModelId)) || "";
  const currentModelId = path.length ? path[path.length - 1].modelId : baseModelId;
  const fields = useMemo(() => fieldsOfModel(ctx, currentModelId).filter((f) => !isSensitiveField(f.field)), [ctx, currentModelId]);
  const normalFields = fields.filter((f) => !isControlField(f.field));
  const controlFields = fields.filter((f) => isControlField(f.field));
  const hops = useMemo(() => nextHops(ctx, baseModelId, path), [ctx, baseModelId, path]);
  const hits = useMemo(() => searchFields(ctx, baseModelId, search), [ctx, baseModelId, search]);
  const searching = search.trim().length >= 2;

  const has = (key: string) => columns.some((c) => c.field === key);
  const keyFor = (p: PathHop[], field: string) => (p.length ? relatedKey(p, field) : field);
  const columnOf = (p: PathHop[], f: { field: string; label: string; type: string }) => ({
    field: keyFor(p, f.field),
    label: defaultColumnLabel(p, f.label),
    type: f.type,
    ...(p.length ? { join: joinSpecOf(p, f.field) } : {}),
  });
  const toggle = (p: PathHop[], f: { field: string; label: string; type: string }) => {
    const key = keyFor(p, f.field);
    onChange(has(key) ? columns.filter((c) => c.field !== key) : [...columns, columnOf(p, f)]);
  };
  const toggleVirtual = (v: { field: string; label: string; plainLabel?: string; type: string }) =>
    onChange(has(v.field) ? columns.filter((c) => c.field !== v.field) : [...columns, { field: v.field, label: v.plainLabel || v.label, type: v.type }]);
  const selectAllHere = () => {
    const missing = normalFields.filter((f) => !has(keyFor(path, f.field))).map((f) => columnOf(path, f));
    onChange([...columns, ...missing]);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const rename = (index: number, label: string) => onChange(columns.map((c, i) => (i === index ? { ...c, label } : c)));

  const pathText = (c: any) => {
    const join = columnJoin(c);
    if (join) return describePath(ctx, baseModelId, join);
    const virt = virtualFields.find((v) => v.field === c.field);
    return virt ? `ƒ ${t("bpm.canvas.query_modal_calc", "Campos calculados")}` : `${baseLabel} › ${c.field}`;
  };

  const fieldRow = (p: PathHop[], f: { field: string; label: string; type: string }, extra?: string) => (
    <label key={`${p.length}-${f.field}`} className={ROW}>
      <input type="checkbox" checked={has(keyFor(p, f.field))} onChange={() => toggle(p, f)} className="rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500" />
      <span className="flex-1 truncate">{f.label}</span>
      {extra && <span className="text-[9px] text-neutral-400 truncate max-w-[45%]">{extra}</span>}
      <span className="text-[9px] text-neutral-400 font-mono">{f.field}</span>
    </label>
  );

  // o drawer de propriedades tem transformação (animação): um modal "fixed" dentro dele fica preso a ele; no body ocupa a tela toda
  if (typeof document === "undefined") return null;
  return createPortal(
    <Modal isOpen={isOpen} onClose={onClose} title={t("bpm.canvas.query_modal_title", "Colunas do resultado")} size="5xl" zIndex={10000}>
      <div className="space-y-4" data-testid="query-columns-modal">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("bpm.canvas.query_modal_search", "Buscar um campo em qualquer tabela relacionada…")}
            className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Esquerda: navegar */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 max-h-[55vh] overflow-y-auto">
            {searching ? (
              hits.length === 0 ? (
                <p className="text-xs text-neutral-400 italic p-2">{t("bpm.canvas.query_modal_no_results", "Nenhum campo encontrado.")}</p>
              ) : (
                hits.map((h: FieldHit) => (
                  <label key={h.key} className={ROW}>
                    <input type="checkbox" checked={has(h.key)} onChange={() => toggle(h.path, { field: h.field, label: h.label, type: h.type })} className="rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500" />
                    <span className="flex-1 truncate">{h.label}</span>
                    <span className="text-[9px] text-indigo-500 truncate max-w-[55%]">{[baseLabel, ...h.path.map((x) => x.modelLabel)].join(" › ")}</span>
                  </label>
                ))
              )
            ) : (
              <>
                <nav className="flex flex-wrap items-center gap-1 text-[11px] font-bold mb-2" aria-label="path">
                  <button type="button" onClick={() => setPath([])} className={path.length === 0 ? "text-indigo-600" : "text-neutral-500 hover:text-indigo-600"}>{baseLabel}</button>
                  {path.map((h, i) => (
                    <React.Fragment key={h.fk + i}>
                      <ChevronRight className="w-3 h-3 text-neutral-400" />
                      <button type="button" onClick={() => setPath(path.slice(0, i + 1))} className={i === path.length - 1 ? "text-indigo-600" : "text-neutral-500 hover:text-indigo-600"}>{h.modelLabel}</button>
                    </React.Fragment>
                  ))}
                </nav>

                <div className="flex items-center justify-between">
                  <p className={SECTION + " !mt-0"}>{t("bpm.canvas.query_modal_here", "Campos desta tabela")}</p>
                  <button type="button" onClick={selectAllHere} className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline">{t("bpm.canvas.query_modal_select_here", "Marcar todos desta tabela")}</button>
                </div>
                {normalFields.map((f) => fieldRow(path, f))}

                {path.length === 0 && virtualFields.length > 0 && (
                  <>
                    <p className={SECTION}>ƒ {t("bpm.canvas.query_modal_calc", "Campos calculados")}</p>
                    {virtualFields.map((v) => (
                      <label key={v.field} className={ROW}>
                        <input type="checkbox" checked={has(v.field)} onChange={() => toggleVirtual(v)} className="rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500" />
                        <span className="flex-1 truncate">{v.plainLabel || v.label}</span>
                      </label>
                    ))}
                  </>
                )}

                {controlFields.length > 0 && (
                  <>
                    <button type="button" onClick={() => setShowControl(!showControl)} className={`${SECTION} flex items-center gap-1 hover:text-indigo-600`}>
                      <ChevronRight className={`w-3 h-3 transition-transform ${showControl ? "rotate-90" : ""}`} /> {t("bpm.canvas.query_modal_control", "Campos de controle")}
                    </button>
                    {showControl && controlFields.map((f) => fieldRow(path, f))}
                  </>
                )}

                <p className={SECTION}>{t("bpm.canvas.query_modal_relations", "Tabelas relacionadas (clique para entrar)")}</p>
                {hops.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 italic px-1.5">
                    {path.length >= MAX_JOIN_DEPTH ? t("bpm.canvas.query_modal_depth_max", "Limite de 4 níveis de relacionamento.") : t("bpm.canvas.query_modal_no_relations", "Esta tabela não tem outras tabelas relacionadas.")}
                  </p>
                ) : (
                  hops.map((h) => (
                    <button key={h.fk} type="button" onClick={() => setPath([...path, h])} className={`${ROW} w-full text-left`}>
                      <span className="flex-1 truncate font-bold">{h.fkLabel}</span>
                      <span className="text-[10px] text-neutral-400 truncate">{h.modelLabel}</span>
                      <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0" />
                    </button>
                  ))
                )}
              </>
            )}
          </div>

          {/* Direita: escolhidas, na ordem do resultado */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 max-h-[55vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className={SECTION + " !mt-0"}>{t("bpm.canvas.query_modal_chosen", "Colunas escolhidas (ordem do resultado)")}</p>
              {columns.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 hover:text-red-500 hover:underline">{t("bpm.canvas.query_clear_all", "Limpar")}</button>}
            </div>
            {columns.length === 0 ? (
              <p className="text-xs text-red-500">{t("bpm.canvas.query_columns_required", "Escolha ao menos uma coluna.")}</p>
            ) : (
              <ol className="space-y-2">
                {columns.map((c, i) => (
                  <li key={c.field} className="rounded-xl border border-neutral-100 dark:border-neutral-800 p-2">
                    <div className="flex items-center gap-1">
                      <span className="w-4 text-[9px] text-neutral-400 font-mono">{i + 1}</span>
                      <input
                        type="text"
                        value={c.label || ""}
                        placeholder={t("bpm.canvas.query_modal_header_ph", "Título da coluna")}
                        onChange={(e) => rename(i, e.target.value)}
                        className="flex-1 min-w-0 text-xs font-bold bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
                      />
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title={t("bpm.canvas.query_move_up", "Subir")} className="px-1.5 text-neutral-500 hover:text-indigo-600 disabled:opacity-30">↑</button>
                      <button type="button" disabled={i === columns.length - 1} onClick={() => move(i, 1)} title={t("bpm.canvas.query_move_down", "Descer")} className="px-1.5 text-neutral-500 hover:text-indigo-600 disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => onChange(columns.filter((_, j) => j !== i))} title={t("bpm.canvas.remove_schedule", "Remover")} className="px-1 text-neutral-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <p className="text-[10px] text-neutral-400 pl-5 truncate">{pathText(c)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-neutral-400">{t("bpm.canvas.query_modal_hint", "Os campos de outras tabelas seguem os relacionamentos do projeto (até 4 níveis, sempre trazendo um valor por registro).")}</p>
          <button type="button" onClick={onClose} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl">{t("bpm.canvas.query_modal_done", "Concluir")}</button>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
