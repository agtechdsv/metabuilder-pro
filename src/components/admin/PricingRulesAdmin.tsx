'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Loader2, Info, X, Check } from 'lucide-react'
import { getPricingRules, savePricingRules } from '@/app/actions/admin'
import { useToast } from '@/components/ui/Toast'

export function PricingRulesAdmin() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)

  const [basePrice, setBasePrice] = useState(450)
  
  const [volumeTiers, setVolumeTiers] = useState([
    { min_licenses: 3, discount_percent: 5 },
    { min_licenses: 5, discount_percent: 7 },
    { min_licenses: 10, discount_percent: 12 },
    { min_licenses: 20, discount_percent: 15 },
    { min_licenses: 30, discount_percent: 20 }
  ])

  const [cycleDiscounts, setCycleDiscounts] = useState<any>({
    monthly: 0,
    quarterly: 10,
    semiannual: 15,
    yearly: 20
  })

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const res = await getPricingRules()
      if (res.success && res.rules) {
        setBasePrice(Number(res.rules.base_price))
        setVolumeTiers(res.rules.volume_tiers || [])
        setCycleDiscounts(res.rules.cycle_discounts || { monthly: 0, quarterly: 10, semiannual: 15, yearly: 20 })
      }
      setIsLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    // Validação: a linha de cima deve ter pelo menos 1 a mais que a de baixo
    let isValid = true
    const sortedTiers = [...volumeTiers].sort((a, b) => a.min_licenses - b.min_licenses)
    
    for (let i = 1; i < sortedTiers.length; i++) {
      if (sortedTiers[i].min_licenses <= sortedTiers[i - 1].min_licenses) {
        isValid = false
        break
      }
    }

    if (!isValid) {
      toast('As regras de quantidade de licenças devem ser estritamente crescentes (a linha de baixo deve ter mais licenças que a de cima).', 'error')
      return
    }

    setIsSaving(true)
    const res = await savePricingRules({
      base_price: basePrice,
      volume_tiers: sortedTiers,
      cycle_discounts: cycleDiscounts
    })
    setIsSaving(false)

    if (res.success) {
      toast('Regras de precificação atualizadas com sucesso!', 'success')
      setVolumeTiers(sortedTiers)
    } else {
      toast(res.error || 'Erro ao salvar regras', 'error')
    }
  }

  const addTier = () => {
    const lastMin = volumeTiers.length > 0 ? Math.max(...volumeTiers.map(t => t.min_licenses)) : 0
    setVolumeTiers([...volumeTiers, { min_licenses: lastMin + 5, discount_percent: 0 }])
  }

  const removeTier = (index: number) => {
    setVolumeTiers(prev => prev.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, field: string, value: number) => {
    setVolumeTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white">Regras de Precificação Dinâmica</h2>
          <p className="text-sm text-neutral-500 mt-1">Configure o valor base e os descontos progressivos por volume e ciclo de pagamento.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-widest flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Regras
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Preço Base */}
        <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            Valor Base (Mensal)
          </h3>
          <p className="text-xs text-neutral-500">Este é o valor de 1 licença no ciclo mensal sem descontos.</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-neutral-500 font-bold">R$</span>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Descontos de Ciclo */}
        <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <h3 className="font-bold text-neutral-900 dark:text-white">Descontos por Ciclo de Renovação</h3>
          <p className="text-xs text-neutral-500">Porcentagem de desconto aplicada sobre o valor total em renovações mais longas.</p>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="w-1/4">
                <label className="text-sm font-semibold">Mensal</label>
              </div>
              <div className="flex flex-col text-right w-2/4 px-4">
                <span className="text-[11px] text-neutral-400">Total: {formatCurrency(basePrice * 1 * (1 - (cycleDiscounts.monthly || 0) / 100))}</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(basePrice * (1 - (cycleDiscounts.monthly || 0) / 100))} / mês</span>
              </div>
              <div className="flex items-center gap-1 w-1/4 justify-end">
                <input
                  type="number"
                  min={0}
                  value={cycleDiscounts.monthly || 0}
                  onChange={(e) => setCycleDiscounts({...cycleDiscounts, monthly: Math.max(0, Number(e.target.value))})}
                  className="w-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-indigo-500 font-bold"
                />
                <span className="text-neutral-500 font-bold">%</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="w-1/4">
                <label className="text-sm font-semibold">Trimestral</label>
              </div>
              <div className="flex flex-col text-right w-2/4 px-4">
                <span className="text-[11px] text-neutral-400">Total: {formatCurrency(basePrice * 3 * (1 - cycleDiscounts.quarterly / 100))}</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(basePrice * (1 - cycleDiscounts.quarterly / 100))} / mês</span>
              </div>
              <div className="flex items-center gap-1 w-1/4 justify-end">
                <input
                  type="number"
                  min={0}
                  value={cycleDiscounts.quarterly}
                  onChange={(e) => setCycleDiscounts({...cycleDiscounts, quarterly: Math.max(0, Number(e.target.value))})}
                  className="w-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-indigo-500 font-bold"
                />
                <span className="text-neutral-500 font-bold">%</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="w-1/4">
                <label className="text-sm font-semibold">Semestral</label>
              </div>
              <div className="flex flex-col text-right w-2/4 px-4">
                <span className="text-[11px] text-neutral-400">Total: {formatCurrency(basePrice * 6 * (1 - cycleDiscounts.semiannual / 100))}</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(basePrice * (1 - cycleDiscounts.semiannual / 100))} / mês</span>
              </div>
              <div className="flex items-center gap-1 w-1/4 justify-end">
                <input
                  type="number"
                  min={0}
                  value={cycleDiscounts.semiannual}
                  onChange={(e) => setCycleDiscounts({...cycleDiscounts, semiannual: Math.max(0, Number(e.target.value))})}
                  className="w-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-indigo-500 font-bold"
                />
                <span className="text-neutral-500 font-bold">%</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="w-1/4">
                <label className="text-sm font-semibold">Anual</label>
              </div>
              <div className="flex flex-col text-right w-2/4 px-4">
                <span className="text-[11px] text-neutral-400">Total: {formatCurrency(basePrice * 12 * (1 - cycleDiscounts.yearly / 100))}</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(basePrice * (1 - cycleDiscounts.yearly / 100))} / mês</span>
              </div>
              <div className="flex items-center gap-1 w-1/4 justify-end">
                <input
                  type="number"
                  min={0}
                  value={cycleDiscounts.yearly}
                  onChange={(e) => setCycleDiscounts({...cycleDiscounts, yearly: Math.max(0, Number(e.target.value))})}
                  className="w-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-indigo-500 font-bold"
                />
                <span className="text-neutral-500 font-bold">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Faixas de Volume */}
        <div className="md:col-span-2 bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Descontos por Volume (Licenças)</h3>
              <p className="text-xs text-neutral-500 mt-1">Configure faixas de desconto com base na quantidade de licenças adquiridas.</p>
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-500 p-2 rounded-lg mt-2 text-xs flex gap-2 items-start">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Regra de Ouro: A linha de baixo deve <strong>sempre</strong> exigir um número de licenças maior que a linha de cima. As faixas devem ser cadastradas de forma crescente.</p>
              </div>
            </div>
            <button
              onClick={addTier}
              className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Faixa
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-4 text-[10px] font-black uppercase text-neutral-400 px-2 items-center text-center">
              <div className="col-span-2 text-left">Licenças (≥)</div>
              <div className="col-span-2 text-left">Desconto</div>
              <div className="col-span-2">Mensal</div>
              <div className="col-span-2">Trimestral</div>
              <div className="col-span-2">Semestral</div>
              <div className="col-span-1">Anual</div>
              <div className="col-span-1 text-right">Ação</div>
            </div>
            
            <div className="space-y-2">

              {volumeTiers
                .map((tier, originalIndex) => ({ ...tier, originalIndex }))
                .sort((a, b) => a.min_licenses - b.min_licenses)
                .map((tier) => {
                  const idx = tier.originalIndex;
                  return (
                <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm text-center">
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-500">≥</span>
                    <input
                      type="number"
                      min={1}
                      value={tier.min_licenses}
                      onChange={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val) || val < 1) val = 1;
                        updateTier(idx, 'min_licenses', val);
                      }}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={tier.discount_percent}
                      onChange={(e) => {
                        let val = Number(e.target.value);
                        if (isNaN(val) || val < 0) val = 0;
                        updateTier(idx, 'discount_percent', val);
                      }}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-bold"
                    />
                    <span className="text-sm font-semibold text-neutral-500">%</span>
                  </div>
                  <div className="col-span-2 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(basePrice * (1 - tier.discount_percent / 100) * tier.min_licenses)}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-normal mt-0.5">
                      {formatCurrency(basePrice * (1 - tier.discount_percent / 100))} / licença
                    </span>
                  </div>
                  <div className="col-span-2 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.quarterly / 100) * tier.min_licenses * 3)}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-normal mt-0.5 flex flex-col">
                      <span>{formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.quarterly / 100) * tier.min_licenses)} / mês</span>
                      <span>{formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.quarterly / 100))} / licença</span>
                    </span>
                  </div>
                  <div className="col-span-2 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.semiannual / 100) * tier.min_licenses * 6)}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-normal mt-0.5 flex flex-col">
                      <span>{formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.semiannual / 100) * tier.min_licenses)} / mês</span>
                      <span>{formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.semiannual / 100))} / licença</span>
                    </span>
                  </div>
                  <div className="col-span-1 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.yearly / 100) * tier.min_licenses * 12)}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-normal mt-0.5 flex flex-col">
                      <span>{formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.yearly / 100) * tier.min_licenses)} / mês</span>
                      <span>{formatCurrency(basePrice * (1 - tier.discount_percent / 100) * (1 - cycleDiscounts.yearly / 100))} / licença</span>
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {confirmDeleteIdx === idx ? (
                      <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/30 p-1 rounded-lg">
                        <button
                          onClick={() => setConfirmDeleteIdx(null)}
                          className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            removeTier(idx)
                            setConfirmDeleteIdx(null)
                          }}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors"
                          title="Confirmar exclusão"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteIdx(idx)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                  )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
