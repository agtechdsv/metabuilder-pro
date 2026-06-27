import { cn } from '@/lib/utils'
import { Plus, Search, ChevronDown, ChevronUp, Table } from 'lucide-react'
import { motion } from 'framer-motion'
import { DraggableItem } from './dnd'

export function FieldSourcePanel({
  dragControls, t, fieldSearchTerm, setFieldSearchTerm,
  formTree, orderedModels, collapsedTables, setCollapsedTables, virtualFields = []
}: any) {
  return (
          <div className="w-full xl:w-80 shrink-0">
            <motion.div
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 flex flex-col xl:fixed xl:w-80 xl:h-[600px] xl:top-64 xl:right-12 z-30 shadow-2xl shadow-indigo-500/10 overflow-hidden ring-1 ring-black/5 transition-colors duration-500 resize both min-w-[280px] min-h-[400px] max-w-[500px]"
            >
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="p-5 border-b border-neutral-200 dark:border-neutral-800 cursor-grab active:cursor-grabbing hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group flex items-center justify-between"
              >
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-indigo-500 transition-colors">{t('wizard.layout.available_fields')}</h3>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-indigo-400"></div>)}
                </div>
              </div>

              {/* Filtro de Campos */}
              <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-950/50 border-b border-neutral-100 dark:border-neutral-800">
                <div className="relative group">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-all" />
                  <input
                    type="text"
                    placeholder="Pesquisar tabelas ou campos..."
                    value={fieldSearchTerm}
                    onChange={e => setFieldSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Ferramentas Virtuais */}
                <div className="border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50/50 dark:bg-neutral-900/20">
                    <div className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-800 dark:text-neutral-200">
                      Ferramentas Virtuais
                    </h4>
                  </div>
                  <div className="p-4 pt-2 flex flex-col gap-2">
                    {/* Generic empty calc field tool */}
                    <DraggableItem id="source-virtual_calc_tool" className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 p-3 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                          <span className="text-indigo-600 dark:text-indigo-400 font-black text-[10px]">fx</span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          Campo Calculado (em branco)
                        </span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-indigo-300 group-hover:text-indigo-500 transition-all" />
                    </DraggableItem>

                    {/* Saved virtual fields from project settings */}
                    {virtualFields.map((vf: any) => (
                      <DraggableItem
                        key={`source-virtdef_${vf.id}`}
                        id={`source-virtdef_${vf.id}`}
                        className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-emerald-400 dark:hover:border-emerald-500 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                            <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px]">∑</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate">
                            {vf.display_name || vf.name}
                          </span>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-emerald-300 group-hover:text-emerald-500 transition-all" />
                      </DraggableItem>
                    ))}
                  </div>
                </div>

                {(() => {
                  const formTreeIds = new Set<string>()
                  const traverse = (nodes: any[]) => {
                    nodes.forEach(n => {
                      formTreeIds.add(n.id)
                      if (n.children) traverse(n.children)
                    })
                  }
                  traverse(formTree)

                  const inTree = orderedModels.filter((m: any) => formTreeIds.has(m.id))
                  const outTree = orderedModels.filter((m: any) => !formTreeIds.has(m.id))
                  const sidebarModels = [...inTree, ...outTree]

                  return sidebarModels
                    .filter((m: any) => {
                      if (!fieldSearchTerm) return true
                      const term = fieldSearchTerm.toLowerCase()
                      const tableMatch = (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                      const fieldMatch = m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(term))
                      return tableMatch || fieldMatch
                    })
                    .map((m: any) => {
                      const isCollapsed = collapsedTables[m.id] ?? !formTreeIds.has(m.id)
                      // Se houver busca e a tabela der match via campo, forçamos a expansão para mostrar os campos
                      const forceExpand = fieldSearchTerm && m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                      const actuallyCollapsed = isCollapsed && !forceExpand

                      return (
                        <div key={`sidebar-table-${m.id}`} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0">
                          <button
                            onClick={() => setCollapsedTables((prev: any) => ({ ...prev, [m.id]: !prev[m.id] }))}
                            className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-1 h-4 rounded-full transition-all",
                                actuallyCollapsed ? "bg-neutral-300" : "bg-indigo-500"
                              )}></div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                                {m.display_name || m.db_table_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{m.fields.length}</span>
                              {actuallyCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />}
                            </div>
                          </button>

                          {!actuallyCollapsed && (
                            <div className="p-4 pt-0 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                              <DraggableItem id={`table-source-${m.id}`} className="bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-2.5 rounded-xl flex items-center justify-center gap-2 group cursor-grab active:cursor-grabbing hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all mb-2">
                                <Table className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{t('wizard.layout.drag_to_add_all', 'Arrastar Todos')}</span>
                              </DraggableItem>

                              {m.fields
                                .filter((f: any) => {
                                  if (!fieldSearchTerm) return true
                                  const term = fieldSearchTerm.toLowerCase()
                                  return (f.display_name || f.db_column_name || '').toLowerCase().includes(term) || (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                                })
                                .map((f: any) => (
                                  <DraggableItem key={`source-${f.id}`} id={`source-${f.id}`} className="bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800/50 p-2.5 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                                    <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 truncate pr-2">
                                      {f.display_name || f.db_column_name}
                                    </span>
                                    <Plus className="w-3 h-3 text-neutral-300 group-hover:text-indigo-500 group-hover:scale-125 transition-all" />
                                  </DraggableItem>
                                ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                })()}
              </div>
            </motion.div>
          </div>
  )
}

