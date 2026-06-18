import { cn } from '@/lib/utils'
import { Settings2, Search, RefreshCcw, Plus, Pencil, Trash2 } from 'lucide-react'

export function ButtonsConfig({
  config, setConfig, isButtonDisabledByModel, t, setSelectedButtonConfig, setIsButtonPropertiesOpen
}: any) {
  return (
    <>
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2 ml-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.actions.interface_buttons')}</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      (b.id !== 'export' && !isButtonDisabledByModel(b.id)) ? { ...b, visible: true } : b
                    )
                  })
                }}
                className="text-[9px] font-bold px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors uppercase tracking-wider"
              >
                Selecionar Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      (b.id !== 'export' && !isButtonDisabledByModel(b.id)) ? { ...b, visible: false } : b
                    )
                  })
                }}
                className="text-[9px] font-bold px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {config.buttons_config.filter((b: any) => b.id !== 'export').map((btn: any) => {
              const isDisabled = isButtonDisabledByModel(btn.id)
              return (
                <div key={btn.id} className="relative group/btn w-full">
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setConfig({
                        ...config,
                        buttons_config: config.buttons_config.map((b: any) =>
                          b.id === btn.id ? { ...b, visible: !b.visible } : b
                        )
                      })
                    }}
                    className={cn(
                      "w-full p-4 rounded-[1.5rem] border transition-all flex flex-col items-center justify-center gap-3 min-h-[108px] relative",
                      btn.visible
                        ? "bg-white dark:bg-neutral-955 border-indigo-600 shadow-lg shadow-indigo-500/5"
                        : "bg-neutral-50/50 dark:bg-neutral-900/30 border-neutral-200 dark:border-neutral-800 opacity-50",
                      isDisabled && "opacity-30 cursor-not-allowed hover:border-neutral-200 dark:hover:border-neutral-800"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors",
                      btn.visible ? "bg-indigo-500 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                    )}
                      style={btn.visible ? {
                        backgroundColor: btn.bg_color || undefined,
                        color: btn.text_color || undefined
                      } : undefined}
                    >
                      {btn.icon === 'search' && <Search className="w-5 h-5" />}
                      {btn.icon === 'refresh-ccw' && <RefreshCcw className="w-5 h-5" />}
                      {btn.icon === 'plus' && <Plus className="w-5 h-5" />}
                      {btn.icon === 'pencil' && <Pencil className="w-5 h-5" />}
                      {btn.icon === 'trash' && <Trash2 className="w-5 h-5" />}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-black transition-all truncate max-w-full px-2",
                        (btn.custom_label !== undefined && btn.custom_label !== '') ? "" : "capitalize tracking-wider"
                      )}
                      style={btn.visible ? {
                        fontFamily: (btn.font_family && btn.font_family !== 'Inter (Padrão)') ? btn.font_family : undefined,
                        fontSize: btn.font_size || undefined,
                        color: btn.text_color || undefined,
                        textTransform: (btn.text_transform !== undefined ? (btn.text_transform !== 'none' ? btn.text_transform : undefined) : 'capitalize') as any
                      } : undefined}
                    >
                      {btn.custom_label !== undefined && btn.custom_label !== '' ? btn.custom_label : (t(btn.labelKey) || btn.label)}
                    </span>
                  </button>

                  {/* Settings Trigger Icon */}
                  {!isDisabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedButtonConfig({
                          ...btn,
                          custom_label: btn.custom_label !== undefined ? btn.custom_label : (t(btn.labelKey) || btn.label),
                          font_family: btn.font_family || 'Inter (Padrão)',
                          font_size: btn.font_size || '10px',
                          text_color: btn.text_color || '',
                          bg_color: btn.bg_color || '',
                          text_transform: btn.text_transform || 'capitalize'
                        });
                        setIsButtonPropertiesOpen(true);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 opacity-0 group-hover/btn:opacity-100 focus:opacity-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all cursor-pointer z-10"
                      title="Propriedades do Botão"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
    </>
  )
}
