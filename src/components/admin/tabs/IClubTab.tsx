import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, X, AlertTriangle, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'
import { getLocalizedIClubRuleName } from '@/lib/iclub'
import { useIClubAdmin } from '../hooks/useIClubAdmin'

interface IClubTabProps {
  hook: ReturnType<typeof useIClubAdmin>
}

export function IClubTab({ hook }: IClubTabProps) {
  const { language } = useI18n()
  const {
    iclubRules,
    isLoadingRules,
    isRuleModalOpen,
    setIsRuleModalOpen,
    editingRule,
    ruleNamePt,
    setRuleNamePt,
    ruleNameEn,
    setRuleNameEn,
    ruleNameEs,
    setRuleNameEs,
    ruleBenefitType,
    setRuleBenefitType,
    ruleTargetCount,
    setRuleTargetCount,
    ruleRewardType,
    setRuleRewardType,
    ruleRewardValue,
    setRuleRewardValue,
    ruleIsActive,
    setRuleIsActive,
    isSavingRule,
    isDeleteRuleModalOpen,
    setIsDeleteRuleModalOpen,
    ruleToDelete,
    setRuleToDelete,
    isDeletingRule,
    openNewRuleModal,
    openEditRuleModal,
    handleSaveRule,
    handleConfirmDeleteRule
  } = hook

  return (
    <>
      <motion.div
        key="iclub"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {/* Header Banner */}
        <div className="flex justify-between items-center bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-xs font-bold text-neutral-500">Configure as regras de pontuação e fidelidade do iClub</span>
          <button
            type="button"
            onClick={openNewRuleModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/10 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Regra</span>
          </button>
        </div>

        {/* Rules Cards List */}
        {isLoadingRules ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem]">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Carregando regras...</span>
          </div>
        ) : iclubRules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {iclubRules.map(rule => {
              const currentName = getLocalizedIClubRuleName(rule.name, language)
              const nameObj = typeof rule.name === 'object' && rule.name !== null ? rule.name : null

              return (
                <div
                  key={rule.id}
                  className={cn(
                    "bg-white dark:bg-neutral-900/40 border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between relative backdrop-blur-sm",
                    rule.is_active ? "border-neutral-200 dark:border-neutral-850" : "border-dashed border-neutral-200 dark:border-neutral-800 opacity-60"
                  )}
                >
                  {!rule.is_active && (
                    <span className="absolute top-4 left-4 px-2 py-0.5 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-[8px] font-black uppercase tracking-wider rounded">Inativo</span>
                  )}

                  {/* Actions */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditRuleModal(rule)}
                      className="p-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-xl transition-all shadow-sm"
                      title="Editar regra"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRuleToDelete(rule)
                        setIsDeleteRuleModalOpen(true)
                      }}
                      className="p-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-400 hover:text-red-500 rounded-xl transition-all shadow-sm"
                      title="Excluir regra"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                        Tipo: {rule.benefit_type === 'volume_license' ? 'Volume de Licenças' : 'Indicação'}
                      </span>
                      <h4 className="text-xl font-black text-neutral-900 dark:text-white mt-1">{currentName}</h4>
                      {nameObj && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {nameObj.pt && <span className="text-[9px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 font-medium">🇧🇷 {nameObj.pt}</span>}
                          {nameObj.en && <span className="text-[9px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 font-medium">🇺🇸 {nameObj.en}</span>}
                          {nameObj.es && <span className="text-[9px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 font-medium">🇪🇸 {nameObj.es}</span>}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-350">
                      <p>
                        <span className="font-bold text-neutral-400">Meta: </span>
                        A cada <strong className="text-neutral-850 dark:text-white">{rule.target_count}</strong> {rule.benefit_type === 'volume_license' ? 'licenças contratadas' : 'indicações ativas'}
                      </p>
                      <p>
                        <span className="font-bold text-neutral-400">Recompensa: </span>
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {rule.reward_type === 'free_license'
                            ? `${Number(rule.reward_value)} Licença(s) Grátis`
                            : `${Number(rule.reward_value)}% de Desconto`}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-neutral-400 italic bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] text-xs">
            Nenhuma regra cadastrada no iClub.
          </div>
        )}
      </motion.div>

      {/* Save/Edit Rule Modal Dialog */}
      <AnimatePresence>
        {isRuleModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {editingRule ? 'Editar Regra iClub' : 'Nova Regra iClub'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveRule} className="flex-grow flex flex-col">
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Multilingual Names Section */}
                  <div className="space-y-3 p-4 bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-neutral-500 dark:text-neutral-400 tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-500" /> Nome da Regra (Multilíngue)
                      </span>
                      <span className="text-[9px] text-neutral-400 font-bold">PT / EN / ES</span>
                    </div>

                    {/* PT */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                          <span>🇧🇷</span> Português
                        </label>
                        <span className="text-[9px] text-indigo-500 font-bold uppercase">Principal</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Desconto por Indicação Ativa"
                        value={ruleNamePt}
                        onChange={(e) => setRuleNamePt(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>

                    {/* EN */}
                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                        <span>🇺🇸</span> English (Inglês)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Active Referral Discount"
                        value={ruleNameEn}
                        onChange={(e) => setRuleNameEn(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>

                    {/* ES */}
                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                        <span>🇪🇸</span> Español (Espanhol)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Descuento por Referido Activo"
                        value={ruleNameEs}
                        onChange={(e) => setRuleNameEs(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Benefit Type */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Tipo de Meta</label>
                      <select
                        value={ruleBenefitType}
                        onChange={(e) => setRuleBenefitType(e.target.value as any)}
                        className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      >
                        <option value="referral_discount">Indicação Convertida</option>
                        <option value="volume_license">Volume de Licenças</option>
                      </select>
                    </div>

                    {/* Target Count */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Quantidade Meta</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={ruleTargetCount}
                        onChange={(e) => setRuleTargetCount(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Reward Type */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Tipo de Recompensa</label>
                      <select
                        value={ruleRewardType}
                        onChange={(e) => setRuleRewardType(e.target.value as any)}
                        className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      >
                        <option value="percent_discount">Desconto em Porcentagem</option>
                        <option value="free_license">Licença Grátis</option>
                      </select>
                    </div>

                    {/* Reward Value */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Valor da Recompensa</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={ruleRewardValue}
                        onChange={(e) => setRuleRewardValue(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  {/* Is Active Status checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="ruleIsActive"
                      checked={ruleIsActive}
                      onChange={(e) => setRuleIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="ruleIsActive" className="text-xs font-bold text-neutral-700 dark:text-neutral-350">
                      Disponibilizar regra (Ativa)
                    </label>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRule}
                    className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
                  >
                    {isSavingRule ? 'Salvando...' : 'Salvar Regra'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Rule Modal */}
      <Modal
        isOpen={isDeleteRuleModalOpen}
        onClose={() => {
          if (!isDeletingRule) {
            setIsDeleteRuleModalOpen(false)
            setRuleToDelete(null)
          }
        }}
        title="Excluir Regra iClub"
        description="Esta ação removerá a regra permanentemente do iClub."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Você tem certeza absoluta?</p>
              <p className="text-xs opacity-90 mt-0.5">
                A regra <span className="font-bold">"{getLocalizedIClubRuleName(ruleToDelete?.name, language)}"</span> será removida permanentemente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingRule}
              onClick={() => {
                setIsDeleteRuleModalOpen(false)
                setRuleToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingRule}
              onClick={handleConfirmDeleteRule}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingRule ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
