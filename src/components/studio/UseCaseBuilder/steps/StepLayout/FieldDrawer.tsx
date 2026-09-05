'use client'

import React from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

import { DrawerTabsConfig } from './drawer/DrawerTabsConfig'
import { DrawerGeneralTab } from './drawer/DrawerGeneralTab'
import { DrawerFormulaTab } from './drawer/DrawerFormulaTab'
import { DrawerStylesTab } from './drawer/DrawerStylesTab'

export function FieldDrawer({
  isDrawerOpen,
  setIsDrawerOpen,
  editingFieldId,
  getFieldName,
  currentFieldMeta,
  drawerActiveTab,
  setDrawerActiveTab,
  updateMeta,
  config,
  setConfig,
  models,
  relations,
  enumerations,
  editingTabId,
  editingFieldZone,
  handleApplyStylesToZone,
  reloadFieldDefaults,
  t
}: any) {
  return (
    <Drawer
      isOpen={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      title={`${t('wizard.layout.drawer.title')}: ${editingFieldId ? getFieldName(editingFieldId) : ''}`}
    >
      {currentFieldMeta && (
        <div className="flex flex-col h-full">
          {editingFieldId !== 'TABS' && (
            <div className="flex border-b border-neutral-100 dark:border-neutral-800 mb-6">
              <button
                onClick={() => setDrawerActiveTab('geral')}
                className={cn(
                  'flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative',
                  drawerActiveTab === 'geral' ? 'text-indigo-600' : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                {t('wizard.layout.drawer.tabs.general', 'Geral')}
                {drawerActiveTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
              </button>
              <button
                onClick={() => setDrawerActiveTab('estilos')}
                className={cn(
                  'flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative',
                  drawerActiveTab === 'estilos' ? 'text-indigo-600' : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                {t('wizard.layout.drawer.tabs.styles', 'Estilos')}
                {drawerActiveTab === 'estilos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
              </button>
              <button
                onClick={() => setDrawerActiveTab('logica')}
                className={cn(
                  'flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative',
                  drawerActiveTab === 'logica' ? 'text-indigo-600' : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                {t('wizard.layout.drawer.tabs.formula', 'Fórmula')}
                {drawerActiveTab === 'logica' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
              </button>
            </div>
          )}

          {editingFieldId !== 'TABS' && (
            <div className="flex justify-end px-6 mt-3">
              <button
                onClick={() => reloadFieldDefaults(editingFieldId)}
                className="text-[9px] text-indigo-500 font-bold hover:underline flex items-center gap-1.5 transition-all opacity-80 hover:opacity-100"
              >
                <RefreshCw className="w-3 h-3" />
                {t('wizard.layout.drawer.restore_defaults', 'Restaurar Padrões Globais')}
              </button>
            </div>
          )}

          <div className="space-y-8 pb-20 pt-3">
            {editingFieldId === 'TABS' && (
              <DrawerTabsConfig
                currentFieldMeta={currentFieldMeta}
                updateMeta={updateMeta}
                editingTabId={editingTabId}
                config={config}
                setConfig={setConfig}
                models={models}
                t={t}
              />
            )}

            {editingFieldId !== 'TABS' && drawerActiveTab === 'geral' && (
              <DrawerGeneralTab
                currentFieldMeta={currentFieldMeta}
                updateMeta={updateMeta}
                editingFieldZone={editingFieldZone}
                editingFieldId={editingFieldId}
                models={models}
                enumerations={enumerations}
                config={config}
                getFieldName={getFieldName}
                t={t}
              />
            )}

            {editingFieldId !== 'TABS' && drawerActiveTab === 'logica' && (
              <DrawerFormulaTab
                currentFieldMeta={currentFieldMeta}
                updateMeta={updateMeta}
                models={models}
                relations={relations}
                config={config}
                editingFieldId={editingFieldId}
                t={t}
              />
            )}

            {editingFieldId !== 'TABS' && drawerActiveTab === 'estilos' && (
              <DrawerStylesTab
                currentFieldMeta={currentFieldMeta}
                updateMeta={updateMeta}
                handleApplyStylesToZone={handleApplyStylesToZone}
                editingFieldZone={editingFieldZone}
                t={t}
              />
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
