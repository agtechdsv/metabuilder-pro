import React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCcw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import DynamicGrid from '@/components/DynamicGrid'

export function ViewListRenderer({
  displayFields, paginatedData, buttonsConfig, customActions, handleCustomAction,
  relationalOptions, handleSort, sortConfig, onView, onEdit, onDelete,
  isFetchingBackground, isLoading, itemsPerPage, setItemsPerPage, currentPage, setCurrentPage,
  totalServerRows, totalPages, fetchData, filterValues, data,
  t, getFontFamily, getFontSize
}: any) {
  return (
        <div className={cn("bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm flex flex-col w-full transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="sticky left-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 w-[60px] border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)]">
                    <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 transition-all" />
                  </th>
                  {displayFields.filter((f: any) => !f.hidden).map((field: any) => (
                    <th
                      key={field.id}
                      onClick={() => field.is_sortable !== false && handleSort(field.db_column_name)}
                      style={{
                        fontFamily: getFontFamily(field.config?.label?.font),
                        fontSize: getFontSize(field.config?.label?.size),
                        color: field.config?.label?.color,
                        fontWeight: field.config?.label?.bold ? 'bold' : undefined,
                        fontStyle: field.config?.label?.italic ? 'italic' : undefined,
                        textTransform: field.config?.label?.uppercase ? 'uppercase' : undefined,
                      }}
                      className={cn(
                        "px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap transition-colors",
                        field.is_sortable !== false ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 group/th" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {field.display_name}
                        {field.is_primary_key && <span className="text-indigo-500" title={t('runtime.primary_key')}>🔑</span>}
                        {field.is_sortable !== false && (
                          <div className="opacity-0 group-hover/th:opacity-100 transition-opacity">
                            {sortConfig && sortConfig.key === field.db_column_name ? (
                              sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            ) : <ArrowUpDown className="w-3 h-3" />}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">
                    {t('runtime.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                <DynamicGrid
                  fields={displayFields.filter((f: any) => !f.hidden)}
                  data={paginatedData}
                  buttonsConfig={buttonsConfig}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  customActions={customActions}
                  onCustomAction={handleCustomAction}
                  relationalOptions={relationalOptions}
                />
              </tbody>
            </table>
          </div>

          <div className="px-8 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
              <span className="opacity-60">{t('runtime.show')}</span>
              <select
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="bg-transparent border-none outline-none text-indigo-600 focus:ring-0 cursor-pointer"
              >
                <option value={10}>10 {t('runtime.rows')}</option>
                <option value={15}>15 {t('runtime.rows')}</option>
                <option value={25}>25 {t('runtime.rows')}</option>
                <option value={50}>50 {t('runtime.rows')}</option>
              </select>
              <span className="mx-2 opacity-20">|</span>
              <span className="opacity-60">{t('runtime.total')}: <span className="text-neutral-900 dark:text-white">{totalServerRows}</span></span>
              {data.length >= 100 && (data.length % 100 === 0) && (
                <button
                  onClick={() => fetchData(filterValues, false, true)}
                  disabled={isLoading}
                  className="ml-4 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black capitalize tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                  {t('runtime.load_more', 'Carregar mais 100')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p: any) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-[10px] font-black transition-all",
                      currentPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    )}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
              </div>
              <button
                onClick={() => setCurrentPage((p: any) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
  )
}
