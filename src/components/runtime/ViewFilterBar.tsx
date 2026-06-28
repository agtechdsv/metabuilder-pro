import React from 'react'
import { Search, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ViewFilterBar({
  filterFields, filterValues, setFilterValues, relationalOptions, parseFixedOptions,
  btnSearch, btnClear, canSearch, canClear, handleSearchClick, handleClear, fetchData,
  t, getButtonStyles, getFontFamily, getFontSize, filterGridColumns
}: any) {
  const labelSearch = btnSearch?.custom_label !== undefined && btnSearch.custom_label !== '' ? btnSearch.custom_label : t('runtime.search');
  const labelClear = btnClear?.custom_label !== undefined && btnClear.custom_label !== '' ? btnClear.custom_label : t('runtime.clear');

  return (
    <>
      {filterFields.length > 0 && (
        <div className="p-6 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner">
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className={cn(
              "flex-1 grid gap-4 w-full",
              ({
                1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
                5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8',
                9: 'grid-cols-9', 10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12'
              } as any)[filterGridColumns || 12] || 'grid-cols-12'
            )}>
              {filterFields.map((field: any, idx: any) => {
                const zoneConfig = field.config?.filter_config || field.config || {}
                let gridSpan = parseInt(zoneConfig.component?.gridSpan || '3') || 3;
                let width = zoneConfig.component?.width || '100%';

                if (typeof width === 'string' && width.endsWith('col')) {
                  const colWidth = parseFloat(width.replace('col', ''));
                  if (!isNaN(colWidth) && gridSpan > 0) {
                    width = `${(colWidth / gridSpan) * 100}%`;
                  } else {
                    width = '100%';
                  }
                }
                
                const colSpanClass = ({
                  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
                  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
                  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12'
                } as any)[gridSpan] || 'col-span-3';

                return (
                  <div key={field.id || field.db_column_name || `filter-${idx}`} className={cn("flex flex-col gap-1.5", colSpanClass)} style={{ width: width }}>
                    <label
                      style={{ fontFamily: zoneConfig.label?.font, fontSize: getFontSize(zoneConfig.label?.size), color: zoneConfig.label?.color }}
                      className={cn("text-[10px] font-black tracking-widest ml-1", !zoneConfig.label?.color && "text-neutral-400")}
                    >
                      {zoneConfig.label?.text || field.display_name}
                    </label>
                    <div className="relative group">
                      {(() => {
                        const comp = zoneConfig.component || { type: 'text' }
                        const fieldType = comp.type || 'text'
                        let options = (comp.options_type === 'relational' || comp.options_type === 'enumeration')
                          ? (relationalOptions[field.id] || [])
                          : parseFixedOptions(comp.fixed_options)

                        if (comp.depends_on && comp.filter_column) {
                          const depValue = filterValues[comp.depends_on]
                          if (depValue !== undefined && depValue !== null && depValue !== '') {
                            options = options.filter((o: any) => String(o.filter_value) === String(depValue))
                          } else {
                            options = []
                          }
                        }

                        const commonClasses = cn(
                          "w-full py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all shadow-sm",
                          !field.config?.content?.color && "text-neutral-900 dark:text-neutral-300",
                          fieldType === 'select' ? "px-4" : "pl-9 pr-4"
                        )
                        const style = { fontFamily: getFontFamily(zoneConfig.content?.font), fontSize: getFontSize(zoneConfig.content?.size), color: zoneConfig.content?.color }

                        if (fieldType === 'select') {
                          return (
                            <select value={filterValues[field.db_column_name] || ''} onChange={e => setFilterValues({ ...filterValues, [field.db_column_name]: e.target.value })} style={style} className={commonClasses}>
                              <option value="">{t('common.all', 'Todos')}</option>
                              {options.map((opt: any, i: number) => <option key={i} value={opt.value}>{opt.label}</option>)}
                            </select>
                          )
                        }

                        if (zoneConfig.content?.filter_operator === 'between') {
                          return (
                            <div className="flex items-center gap-2 w-full">
                              <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'} placeholder="De" value={filterValues[`${field.db_column_name}_start`] || ''} onChange={e => setFilterValues({ ...filterValues, [`${field.db_column_name}_start`]: e.target.value })} style={style} className={commonClasses} />
                              </div>
                              <span className="text-neutral-400 font-bold text-xs">-</span>
                              <div className="relative flex-1">
                                <input type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'} placeholder="Até" value={filterValues[`${field.db_column_name}_end`] || ''} onChange={e => setFilterValues({ ...filterValues, [`${field.db_column_name}_end`]: e.target.value })} style={style} className={cn(commonClasses, "pl-4")} />
                              </div>
                            </div>
                          )
                        }

                        return (
                          <>
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'} placeholder={t('runtime.filter_placeholder').replace('{field}', field.display_name)} value={filterValues[field.db_column_name] || ''} onChange={e => setFilterValues({ ...filterValues, [field.db_column_name]: e.target.value })} style={style} className={commonClasses} />
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-3 mb-[1px]">
              {canSearch && (
                <button onClick={handleSearchClick} style={getButtonStyles(btnSearch)} className={cn("h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2", (btnSearch?.custom_label !== undefined && btnSearch.custom_label !== '') ? "" : "capitalize tracking-wider")}>
                  <Search className="w-4 h-4" />
                  {labelSearch}
                </button>
              )}
              {canClear && (
                <button onClick={() => handleClear(fetchData)} style={getButtonStyles(btnClear)} className={cn("h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2", (btnClear?.custom_label !== undefined && btnClear.custom_label !== '') ? "" : "capitalize tracking-wider")}>
                  <RefreshCcw className="w-4 h-4" />
                  {labelClear}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  )
}
